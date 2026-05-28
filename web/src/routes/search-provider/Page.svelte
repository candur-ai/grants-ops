<script>
  import { toast } from '../../lib/stores.js';

  let query = $state('federal funding for youth financial literacy and AI workforce readiness');
  let profiles = $state([]);
  let sources = $state([]);
  let selectedProfiles = $state(new Set(['global_web', 'us_web']));
  let selectedSources = $state(new Set(['grant_portals', 'reddit', 'claude', 'openai', 'twitter', 'tiktok', 'google', 'brave']));
  let profileLens = $state({
    occupation: 'grant strategist',
    location: 'United States',
    interests: ['public funding', 'education', 'AI'],
    custom_note: 'Prioritize source material that could inform a grant strategy or agent debate.',
  });
  let searching = $state(false);
  let expanded = $state(null);
  let panels = $state({});
  let results = $state([]);
  let activeSource = null;

  $effect(() => {
    Promise.all([
      fetch('/api/v1/search-provider/profiles').then((res) => res.json()),
      fetch('/api/v1/search-provider/sources').then((res) => res.json()),
    ])
      .then(([profileData, sourceData]) => {
        profiles = profileData;
        sources = sourceData;
      })
      .catch(() => {
        profiles = [];
        sources = [];
      });
  });

  function toggleProfile(id) {
    const next = new Set(selectedProfiles);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedProfiles = next;
  }

  function toggleSource(id) {
    const next = new Set(selectedSources);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedSources = next;
  }

  function panelTitle(source) {
    if (source === 'synthesis') return 'AI Briefing';
    const fixed = sources.find((item) => item.id === source);
    if (fixed) return fixed.displayName;
    const [provider, id] = source.split(':');
    const profile = profiles.find((p) => p.id === id);
    const providerName = provider === 'brave' ? 'Brave' : 'Google';
    return `${providerName} - ${profile?.displayName || id}`;
  }

  function ensurePanel(source, displayName = '') {
    if (panels[source]) return;
    panels = {
      ...panels,
      [source]: { source, displayName: displayName || panelTitle(source), loading: false, items: [], error: '' },
    };
  }

  function setPanel(source, patch) {
    ensurePanel(source);
    panels = { ...panels, [source]: { ...panels[source], ...patch } };
  }

  function addResult(result) {
    ensurePanel(result.source);
    const current = panels[result.source];
    panels = {
      ...panels,
      [result.source]: { ...current, items: [...current.items, result], loading: false },
    };
    if (result.source !== 'synthesis') {
      results = [...results, result];
      localStorage.setItem('candor_search_context', JSON.stringify([result, ...results].slice(0, 18)));
    }
  }

  function buildURL() {
    const params = new URLSearchParams({ q: query });
    if (selectedProfiles.size) params.set('profiles', [...selectedProfiles].join(','));
    if (selectedSources.size) params.set('sources', [...selectedSources].join(','));
    params.set('profile', encodeURIComponent(JSON.stringify(profileLens)));
    return `/api/v1/search-provider/stream?${params}`;
  }

  function startSearch() {
    if (!query.trim()) return;
    if (activeSource) activeSource.close();
    panels = {};
    results = [];
    expanded = null;
    searching = true;

    activeSource = new EventSource(buildURL());
    activeSource.addEventListener('query_ready', (event) => expanded = JSON.parse(event.data));
    activeSource.addEventListener('source_start', (event) => {
      const data = JSON.parse(event.data);
      ensurePanel(data.source, data.display_name);
      setPanel(data.source, { loading: true });
    });
    activeSource.addEventListener('result', (event) => addResult(JSON.parse(event.data)));
    activeSource.addEventListener('source_error', (event) => {
      const data = JSON.parse(event.data);
      ensurePanel(data.source);
      setPanel(data.source, { loading: false, error: data.message });
    });
    activeSource.addEventListener('synthesis_start', () => {
      ensurePanel('synthesis', 'AI Briefing');
      setPanel('synthesis', { loading: true });
    });
    activeSource.addEventListener('done', () => {
      searching = false;
      panels = Object.fromEntries(
        Object.entries(panels).map(([source, panel]) => [source, { ...panel, loading: false }])
      );
      activeSource.close();
      activeSource = null;
    });
    activeSource.onerror = () => {
      searching = false;
      activeSource?.close();
      activeSource = null;
      toast('Search connection closed', 'error');
    };
  }

  function useForDebate() {
    localStorage.setItem('candor_search_context', JSON.stringify(results.slice(0, 18)));
    window.location.hash = '#/debate';
  }
</script>

<section class="tool-page">
  <div class="tool-header">
    <p class="eyebrow">Candur Search Provider</p>
    <h1>Search becomes the evidence layer for bringing AI to Main Street.</h1>
    <p>Use source panels to research AI tutors, Main Street business adoption, health care independence, nonprofit funding, and practical AI by profession. Save the strongest context for grant work or agent debate.</p>
  </div>

  <form class="search-console" onsubmit={(e) => { e.preventDefault(); startSearch(); }}>
    <label for="query">Research query</label>
    <div class="query-row">
      <input id="query" bind:value={query} />
      <button class="console-button primary" disabled={searching}>{searching ? 'Searching' : 'Search'}</button>
      <button class="console-button" type="button" disabled={!results.length} onclick={useForDebate}>Send to debate</button>
    </div>

    <div class="controls-grid">
      <div>
        <span class="control-label">Providers</span>
        <div class="profile-list">
          {#each sources as source}
            <button
              type="button"
              class:selected={selectedSources.has(source.id)}
              class:unavailable={!source.enabled}
              onclick={() => toggleSource(source.id)}
              title={source.enabled ? source.displayName : source.reason}
            >
              {source.displayName}
            </button>
          {/each}
        </div>

        <span class="control-label profile-heading">Source profiles</span>
        <div class="profile-list">
          {#each profiles as profile}
            <button
              type="button"
              class:selected={selectedProfiles.has(profile.id)}
              onclick={() => toggleProfile(profile.id)}
              title={profile.googleOnly ? 'Google-only mode' : 'Profile-aware web search when available'}
            >
              {profile.displayName}
            </button>
          {/each}
        </div>
      </div>

      <div class="lens-box">
        <span class="control-label">Search lens</span>
        <input bind:value={profileLens.occupation} placeholder="Occupation" />
        <input bind:value={profileLens.location} placeholder="Location" />
        <textarea bind:value={profileLens.custom_note} rows="3" placeholder="Angle"></textarea>
      </div>
    </div>
  </form>

  {#if expanded}
    <div class="query-brief">
      <strong>{expanded.summary}</strong>
      <span>{expanded.web_query}</span>
    </div>
  {/if}

  <section class="results-grid">
    {#each Object.values(panels) as panel}
      <article class="source-panel" class:synthesis={panel.source === 'synthesis'}>
        <header>
          <h2>{panel.displayName}</h2>
          <span>{panel.loading ? 'live' : `${panel.items.length} results`}</span>
        </header>
        {#if panel.error}
          <p class="panel-error">{panel.error}</p>
        {/if}
        {#each panel.items as item}
          <div class="result-card">
            <h3>
              {#if item.url}
                <a href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
              {:else}
                {item.title}
              {/if}
            </h3>
            <p>{item.snippet || item.briefing?.narrative}</p>
          </div>
        {/each}
      </article>
    {/each}
  </section>
</section>

<style>
  .tool-page {
    padding: clamp(2rem, 5vw, 4rem);
    background: var(--paper);
    min-height: calc(100vh - 72px);
  }

  .tool-header {
    max-width: 920px;
  }

  .eyebrow {
    color: var(--rust);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    text-transform: uppercase;
    font-weight: 900;
  }

  h1 {
    font-family: var(--font-display);
    font-size: clamp(2.7rem, 6vw, 5.8rem);
    line-height: 0.9;
    margin-top: 0.75rem;
    max-width: 980px;
  }

  .tool-header p:last-child {
    margin-top: 1rem;
    max-width: 680px;
    color: var(--muted);
    font-size: 1.05rem;
  }

  .search-console,
  .query-brief,
  .source-panel {
    border: 1px solid var(--line);
    background: #fffdf8;
  }

  .search-console {
    margin-top: 2rem;
    padding: clamp(1rem, 3vw, 1.5rem);
  }

  label,
  .control-label {
    display: block;
    font-size: 0.78rem;
    font-weight: 900;
    color: var(--muted);
    text-transform: uppercase;
    margin-bottom: 0.5rem;
  }

  .query-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 0.75rem;
  }

  .query-row input,
  .lens-box input,
  .lens-box textarea {
    min-height: 44px;
    border-radius: 0;
    border-color: var(--line);
    background: white;
  }

  .console-button {
    min-height: 44px;
    padding: 0 1rem;
    border: 1px solid var(--ink);
    background: white;
    color: var(--ink);
    font-weight: 900;
    white-space: nowrap;
  }

  .console-button.primary {
    background: var(--ink);
    color: var(--paper);
    min-width: 88px;
  }

  .console-button.primary:hover:not(:disabled) {
    background: var(--sage);
    border-color: var(--sage);
    color: var(--card);
  }

  .console-button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .controls-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
    gap: 1.25rem;
    margin-top: 1.25rem;
  }

  .profile-list {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .profile-list button {
    border: 1px solid var(--line);
    background: white;
    padding: 0.45rem 0.65rem;
    font-size: 0.82rem;
    font-weight: 800;
  }

  .profile-list button.selected {
    background: var(--signal);
    border-color: var(--ink);
  }

  .profile-list button.unavailable {
    opacity: 0.48;
    border-style: dashed;
  }

  .profile-heading {
    margin-top: 1rem;
  }

  .lens-box {
    display: grid;
    gap: 0.65rem;
  }

  .query-brief {
    margin-top: 1rem;
    padding: 1rem;
    display: grid;
    gap: 0.35rem;
  }

  .query-brief span {
    color: var(--muted);
  }

  .results-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }

  .source-panel {
    min-height: 180px;
  }

  .source-panel.synthesis {
    grid-column: 1 / -1;
    background: var(--ink);
    color: var(--nav-text);
  }

  .source-panel header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.9rem 1rem;
    border-bottom: 1px solid var(--line);
  }

  .source-panel h2 {
    font-family: var(--font-display);
    font-size: 1.15rem;
  }

  .source-panel header span {
    font-family: var(--font-mono);
    color: var(--rust);
    font-size: 0.74rem;
    text-transform: uppercase;
  }

  .result-card {
    padding: 1rem;
    border-bottom: 1px solid var(--line);
  }

  .result-card h3 {
    font-size: 1rem;
    line-height: 1.2;
  }

  .result-card p {
    margin-top: 0.5rem;
    color: color-mix(in srgb, currentColor 68%, transparent);
    font-size: 0.9rem;
  }

  .panel-error {
    padding: 1rem;
    color: var(--danger);
  }

  @media (max-width: 860px) {
    .query-row,
    .controls-grid,
    .results-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
