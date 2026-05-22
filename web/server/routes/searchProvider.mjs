import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

const PROFILES = [
  { id: 'global_web', displayName: 'Global - Web', googleOnly: false, gl: '', hl: 'en', tbm: '', kl: 'wt-wt' },
  { id: 'us_web', displayName: 'US - Web', googleOnly: false, gl: 'us', hl: 'en', tbm: '', kl: 'us-en' },
  { id: 'us_news', displayName: 'US - News', googleOnly: true, gl: 'us', hl: 'en', tbm: 'nws', kl: 'us-en' },
  { id: 'us_shopping', displayName: 'US - Shopping', googleOnly: true, gl: 'us', hl: 'en', tbm: 'shop', kl: 'us-en' },
  { id: 'uk_web', displayName: 'UK - Web', googleOnly: false, gl: 'gb', hl: 'en', tbm: '', kl: 'uk-en' },
  { id: 'eu_news', displayName: 'EU - News', googleOnly: true, gl: 'de', hl: 'en', tbm: 'nws', kl: 'de-de' },
  { id: 'jp_web', displayName: 'Japan - Web', googleOnly: false, gl: 'jp', hl: 'ja', tbm: '', kl: 'jp-ja' },
  { id: 'in_web', displayName: 'India - Web', googleOnly: false, gl: 'in', hl: 'en', tbm: '', kl: 'in-en' },
];

const PROFILE_FIELDS = [
  { id: 'occupation', label: 'Occupation', type: 'text', placeholder: 'e.g. grantmaker, analyst, founder' },
  { id: 'location', label: 'Location', type: 'text', placeholder: 'e.g. Toronto, New York, remote' },
  { id: 'interests', label: 'Interests', type: 'tags', placeholder: 'Add and press Enter' },
  { id: 'custom_note', label: 'Search lens', type: 'textarea', placeholder: 'What should the search understand about your angle?' },
];

const FIXED_SOURCES = [
  {
    id: 'reddit',
    displayName: 'Reddit',
    enabled: hasUsableKey(process.env.REDDIT_CLIENT_ID) && hasUsableKey(process.env.REDDIT_CLIENT_SECRET),
    reason: 'Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET',
  },
  { id: 'claude', displayName: 'Claude (AI)', enabled: hasUsableKey(process.env.ANTHROPIC_API_KEY), reason: 'Set ANTHROPIC_API_KEY' },
  { id: 'openai', displayName: 'OpenAI (AI)', enabled: hasUsableKey(process.env.OPENAI_API_KEY), reason: 'Set OPENAI_API_KEY' },
  { id: 'twitter', displayName: 'X / Twitter', enabled: hasUsableKey(process.env.TWITTER_BEARER_TOKEN), reason: 'Set TWITTER_BEARER_TOKEN' },
  {
    id: 'tiktok',
    displayName: 'TikTok',
    enabled: hasUsableKey(process.env.TIKTOK_CLIENT_KEY) && hasUsableKey(process.env.TIKTOK_CLIENT_SECRET),
    reason: 'Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET',
  },
];

function hasUsableKey(value) {
  return Boolean(value && !String(value).includes('your-') && !String(value).includes('...'));
}

function writeSSE(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function withTimeout(signal, ms = 12000) {
  const timeout = AbortSignal.timeout(ms);
  if (!signal) return timeout;
  return AbortSignal.any([signal, timeout]);
}

function decodeProfile(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return {};
  }
}

function describeProfile(profile) {
  const parts = [];
  if (profile.occupation) parts.push(`works as ${profile.occupation}`);
  if (profile.location) parts.push(`based in ${profile.location}`);
  if (Array.isArray(profile.interests) && profile.interests.length) parts.push(`interested in ${profile.interests.join(', ')}`);
  if (profile.custom_note) parts.push(profile.custom_note);
  return parts.join('; ');
}

async function googleSearch(query, profile, signal) {
  if (!process.env.SERPAPI_KEY) return [];
  const params = new URLSearchParams({
    engine: 'google',
    q: query,
    hl: profile.hl,
    num: '10',
    api_key: process.env.SERPAPI_KEY,
  });
  if (profile.gl) params.set('gl', profile.gl);
  if (profile.tbm) params.set('tbm', profile.tbm);

  const response = await fetch(`https://serpapi.com/search.json?${params}`, { signal });
  if (!response.ok) throw new Error(`SerpAPI returned ${response.status}`);
  const payload = await response.json();
  const results = [];
  const answer = payload.answer_box?.answer || payload.answer_box?.snippet;
  if (answer) {
    results.push({ source: `google:${profile.id}`, title: 'Featured Answer', snippet: answer, is_ai: false });
  }
  for (const item of payload.organic_results || []) {
    results.push({
      source: `google:${profile.id}`,
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      is_ai: false,
    });
  }
  return results.slice(0, 8);
}

async function braveSearch(query, profile, signal) {
  if (!hasUsableKey(process.env.BRAVE_API_KEY)) return [];
  const params = new URLSearchParams({ q: query, count: '10', result_filter: 'web' });
  if (profile.gl) params.set('country', profile.gl.toUpperCase());
  if (profile.hl) params.set('search_lang', profile.hl);

  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    signal,
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': process.env.BRAVE_API_KEY,
    },
  });
  if (response.status === 401) throw new Error('Brave Search API key invalid or missing');
  if (response.status === 429) throw new Error('Brave Search rate limit reached');
  if (!response.ok) throw new Error(`Brave returned ${response.status}`);
  const payload = await response.json();
  return (payload.web?.results || []).slice(0, 10).map((item) => ({
    source: `brave:${profile.id}`,
    title: item.title,
    url: item.url,
    snippet: item.description,
    published_at: item.age || '',
    is_ai: false,
  }));
}

function truncate(text, max = 300) {
  if (!text || text.length <= max) return text || '';
  return `${text.slice(0, max).trim()}...`;
}

let redditToken = null;
async function getRedditToken(signal) {
  if (redditToken && Date.now() < redditToken.expiresAt) return redditToken.value;
  if (!hasUsableKey(process.env.REDDIT_CLIENT_ID) || !hasUsableKey(process.env.REDDIT_CLIENT_SECRET)) {
    throw new Error('Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET');
  }

  const credentials = Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString('base64');
  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    signal,
    headers: {
      authorization: `Basic ${credentials}`,
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': process.env.REDDIT_USER_AGENT || 'candor-search/1.0',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'read',
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Reddit OAuth returned ${response.status}${text ? `: ${truncate(text, 160)}` : ''}`);
  }

  const payload = await response.json();
  if (!payload.access_token) throw new Error('Reddit OAuth did not return an access token');
  redditToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(60, (payload.expires_in || 3600) - 60) * 1000,
  };
  return redditToken.value;
}

async function redditSearch(query, signal) {
  const token = await getRedditToken(signal);
  const params = new URLSearchParams({
    q: query,
    sort: 'relevance',
    limit: '20',
    t: 'year',
    type: 'link',
    raw_json: '1',
  });
  const response = await fetch(`https://oauth.reddit.com/search?${params}`, {
    signal,
    headers: {
      authorization: `Bearer ${token}`,
      'user-agent': process.env.REDDIT_USER_AGENT || 'candor-search/1.0',
    },
  });
  if (!response.ok) throw new Error(`Reddit returned ${response.status}`);
  const payload = await response.json();
  return (payload.data?.children || [])
    .map((child) => child.data)
    .filter((item) => item?.title && item?.permalink && item.score >= 0)
    .slice(0, 12)
    .map((item) => ({
      source: 'reddit',
      title: item.title,
      url: `https://reddit.com${item.permalink}`,
      external_url: !item.is_self && item.url && !item.url.includes('reddit.com') ? item.url : '',
      snippet: item.is_self ? truncate(String(item.selftext || '').replace(/\n/g, ' ')) : '',
      author: item.author ? `u/${item.author}` : '',
      subreddit: item.subreddit || '',
      score: item.score || 0,
      num_comments: item.num_comments || 0,
      published_at: item.created_utc ? new Date(item.created_utc * 1000).toISOString() : '',
      is_ai: false,
    }));
}

async function twitterSearch(query, signal) {
  if (!hasUsableKey(process.env.TWITTER_BEARER_TOKEN)) return [];
  const params = new URLSearchParams({
    query,
    max_results: '10',
    'tweet.fields': 'text,author_id,created_at,public_metrics',
    expansions: 'author_id',
    'user.fields': 'username,name',
  });
  const response = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
    signal,
    headers: { Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}` },
  });
  if (response.status === 401) throw new Error('X/Twitter bearer token invalid');
  if (response.status === 402 || response.status === 403) throw new Error('X/Twitter search requires paid API access');
  if (!response.ok) throw new Error(`X/Twitter returned ${response.status}`);
  const payload = await response.json();
  const users = new Map((payload.includes?.users || []).map((user) => [user.id, user.username]));
  return (payload.data || []).map((tweet) => {
    const username = users.get(tweet.author_id) || tweet.author_id;
    return {
      source: 'twitter',
      title: tweet.text,
      url: `https://twitter.com/${username}/status/${tweet.id}`,
      author: username ? `@${username}` : '',
      score: tweet.public_metrics?.like_count || 0,
      published_at: tweet.created_at || '',
      is_ai: false,
    };
  });
}

async function claudeSearch(query, signal) {
  if (!hasUsableKey(process.env.ANTHROPIC_API_KEY)) return [];
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Search query: "${query}"\n\nProvide a concise, factual answer with a direct answer, key facts, and caveats.`,
      }],
    }),
  });
  if (!response.ok) throw new Error(`Anthropic returned ${response.status}`);
  const payload = await response.json();
  return [{
    source: 'claude',
    title: "Claude's Answer",
    snippet: payload.content?.[0]?.text || '',
    is_ai: true,
  }];
}

async function openAISearch(query, signal) {
  if (!hasUsableKey(process.env.OPENAI_API_KEY)) return [];
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: 'You are a search assistant. Answer concisely and factually with key bullet points.' },
        { role: 'user', content: query },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
  const payload = await response.json();
  return [{
    source: 'openai',
    title: 'OpenAI Answer',
    snippet: payload.choices?.[0]?.message?.content || '',
    is_ai: true,
  }];
}

let tiktokToken = null;
async function getTikTokToken(signal) {
  if (tiktokToken && Date.now() < tiktokToken.expiresAt) return tiktokToken.value;
  const body = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY,
    client_secret: process.env.TIKTOK_CLIENT_SECRET,
    grant_type: 'client_credentials',
  });
  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) throw new Error(`TikTok auth returned ${response.status}`);
  const payload = await response.json();
  if (payload.error?.code && payload.error.code !== 'ok') throw new Error(`TikTok auth: ${payload.error.message}`);
  tiktokToken = {
    value: payload.data.access_token,
    expiresAt: Date.now() + Math.max(60, payload.data.expires_in - 60) * 1000,
  };
  return tiktokToken.value;
}

async function tiktokSearch(query, signal) {
  if (!hasUsableKey(process.env.TIKTOK_CLIENT_KEY) || !hasUsableKey(process.env.TIKTOK_CLIENT_SECRET)) return [];
  const token = await getTikTokToken(signal);
  const fields = 'id,create_time,username,region_code,video_description,like_count,comment_count,share_count,view_count';
  const response = await fetch(`https://open.tiktokapis.com/v2/research/video/query/?fields=${fields}`, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      query: { and: [{ operation: 'IN', field_name: 'keyword', field_values: [query] }] },
      max_count: 20,
    }),
  });
  if (!response.ok) throw new Error(`TikTok returned ${response.status}`);
  const payload = await response.json();
  if (payload.error?.code && payload.error.code !== 'ok') throw new Error(`TikTok: ${payload.error.message}`);
  return (payload.data?.videos || []).map((video) => ({
    source: 'tiktok',
    title: video.video_description,
    url: `https://www.tiktok.com/@${video.username}/video/${video.id}`,
    snippet: `${video.view_count} views · ${video.like_count} likes · ${video.comment_count} comments · ${video.share_count} shares · ${video.region_code}`,
    author: video.username ? `@${video.username}` : '',
    score: video.like_count || 0,
    num_comments: video.comment_count || 0,
    published_at: video.create_time ? new Date(video.create_time * 1000).toISOString() : '',
    is_ai: false,
  }));
}

function fallbackExpandedQuery(q, profileDesc) {
  return {
    original: q,
    web_query: q,
    reddit_query: `${q} reddit discussion`,
    twitter_query: `${q} expert thread`,
    summary: profileDesc ? `Searching with lens: ${profileDesc}` : 'Searching across configured source profiles.',
    persona_desc: profileDesc,
  };
}

async function synthesize(query, results, profileDesc) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('...') || results.length < 3) return null;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: 900,
    system: 'You create concise research briefings from search results. Return plain JSON only.',
    messages: [{
      role: 'user',
      content: `Query: ${query}\nLens: ${profileDesc || 'none'}\n\nResults:\n${JSON.stringify(results.slice(0, 18), null, 2)}\n\nReturn JSON: {"narrative":"short synthesis","picks":[{"title":"...","url":"...","source":"...","reason":"..."}]}`,
    }],
  });
  try {
    return JSON.parse(response.content[0].text);
  } catch {
    return { narrative: response.content[0].text, picks: [] };
  }
}

router.get('/profiles', (_req, res) => {
  res.json(PROFILES.map(({ id, displayName, googleOnly }) => ({ id, displayName, googleOnly })));
});

router.get('/sources', (_req, res) => {
  const profiled = [
    { id: 'google', displayName: 'Google profiles', enabled: hasUsableKey(process.env.SERPAPI_KEY), reason: 'Set SERPAPI_KEY' },
    { id: 'brave', displayName: 'Brave profiles', enabled: hasUsableKey(process.env.BRAVE_API_KEY), reason: 'Set BRAVE_API_KEY' },
  ];
  res.json([...profiled, ...FIXED_SOURCES]);
});

router.get('/profile-fields', (_req, res) => {
  res.json(PROFILE_FIELDS);
});

router.get('/stream', async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (!query) return res.status(400).json({ error: 'q is required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const selected = String(req.query.profiles || 'global_web')
    .split(',')
    .map((id) => PROFILES.find((profile) => profile.id === id.trim()))
    .filter(Boolean);
  const selectedSources = new Set(
    String(req.query.sources || 'reddit,claude,openai,twitter,tiktok,google,brave')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  );
  const profileDesc = describeProfile(decodeProfile(String(req.query.profile || '')));
  const expanded = fallbackExpandedQuery(query, profileDesc);
  writeSSE(res, 'query_ready', expanded);

  const controller = new AbortController();
  req.on('close', () => controller.abort());
  const collected = [];

  for (const profile of selected) {
    const tasks = [];
    if (selectedSources.has('google') && hasUsableKey(process.env.SERPAPI_KEY)) {
      tasks.push({ id: `google:${profile.id}`, name: `Google - ${profile.displayName}`, run: googleSearch });
    }
    if (selectedSources.has('brave') && !profile.googleOnly && hasUsableKey(process.env.BRAVE_API_KEY)) {
      tasks.push({ id: `brave:${profile.id}`, name: `Brave - ${profile.displayName}`, run: braveSearch });
    }

    for (const source of tasks) {
      writeSSE(res, 'source_start', { source: source.id, display_name: source.name });
      try {
        const results = await source.run(expanded.web_query, profile, withTimeout(controller.signal));
        for (const result of results) {
          collected.push(result);
          writeSSE(res, 'result', result);
        }
      } catch (error) {
        if (!controller.signal.aborted) writeSSE(res, 'source_error', { source: source.id, message: error.message });
      }
    }
  }

  const fixedTasks = [
    {
      id: 'reddit',
      name: 'Reddit',
      enabled: selectedSources.has('reddit') && hasUsableKey(process.env.REDDIT_CLIENT_ID) && hasUsableKey(process.env.REDDIT_CLIENT_SECRET),
      run: () => redditSearch(expanded.reddit_query, withTimeout(controller.signal)),
    },
    { id: 'twitter', name: 'X / Twitter', enabled: selectedSources.has('twitter') && hasUsableKey(process.env.TWITTER_BEARER_TOKEN), run: () => twitterSearch(expanded.twitter_query, withTimeout(controller.signal)) },
    { id: 'claude', name: 'Claude (AI)', enabled: selectedSources.has('claude') && hasUsableKey(process.env.ANTHROPIC_API_KEY), run: () => claudeSearch(query, withTimeout(controller.signal, 30000)) },
    { id: 'openai', name: 'OpenAI (AI)', enabled: selectedSources.has('openai') && hasUsableKey(process.env.OPENAI_API_KEY), run: () => openAISearch(query, withTimeout(controller.signal, 30000)) },
    { id: 'tiktok', name: 'TikTok', enabled: selectedSources.has('tiktok') && hasUsableKey(process.env.TIKTOK_CLIENT_KEY) && hasUsableKey(process.env.TIKTOK_CLIENT_SECRET), run: () => tiktokSearch(query, withTimeout(controller.signal, 20000)) },
  ];

  for (const source of fixedTasks) {
    if (!source.enabled) continue;
    writeSSE(res, 'source_start', { source: source.id, display_name: source.name });
    try {
      const results = await source.run();
      for (const result of results) {
        collected.push(result);
        writeSSE(res, 'result', result);
      }
    } catch (error) {
      if (!controller.signal.aborted) writeSSE(res, 'source_error', { source: source.id, message: error.message });
    }
  }

  try {
    const briefing = await synthesize(query, collected, profileDesc);
    if (briefing) {
      writeSSE(res, 'synthesis_start', {});
      writeSSE(res, 'result', {
        source: 'synthesis',
        title: 'Briefing',
        snippet: briefing.narrative,
        is_ai: true,
        briefing,
      });
    }
  } catch (error) {
    writeSSE(res, 'source_error', { source: 'synthesis', message: error.message });
  }

  writeSSE(res, 'done', { count: collected.length });
  res.end();
});

export default router;
