import { Router } from 'express';

const router = Router();
const BUCKET = 'application-packets';
const SIGNED_URL_TTL = 60 * 60 * 24 * 7;

function packetTableMissing(error) {
  const message = error?.message || '';
  return error?.code === '42P01' || /application_packets|does not exist|schema cache/i.test(message);
}

function slugify(value) {
  return String(value || 'application')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'application';
}

function packetBasePath(orgId, report, opportunity, title) {
  const reportKey = report?.id ? `report-${report.id}` : `opportunity-${slugify(report?.opportunity_id || opportunity?.id || title)}`;
  return `${orgId}/reports/${reportKey}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function markdownToHtml(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const html = [];
  let listOpen = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (listOpen) {
        html.push('</ul>');
        listOpen = false;
      }
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      if (listOpen) {
        html.push('</ul>');
        listOpen = false;
      }
      const level = Math.min(heading[1].length + 1, 5);
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (!listOpen) {
        html.push('<ul>');
        listOpen = true;
      }
      html.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      continue;
    }

    if (listOpen) {
      html.push('</ul>');
      listOpen = false;
    }
    html.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  if (listOpen) html.push('</ul>');
  return html.join('\n');
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>');
}

function formatCurrency(n) {
  if (!n) return 'Not specified';
  return '$' + Number(n).toLocaleString();
}

function buildMarkdown({ report, opportunity, sections, budget }) {
  const synopsis = opportunity?.synopsis || {};
  const title = report?.program || opportunity?.opportunityTitle || synopsis.opportunityTitle || 'Grant Application Packet';
  const agency = report?.agency || synopsis.agencyName || opportunity?.owningAgencyCode || 'Unknown agency';
  const lines = [
    `# ${title}`,
    '',
    `**Agency:** ${agency}`,
    `**Opportunity ID:** ${report?.opportunity_id || opportunity?.id || 'Unknown'}`,
    `**Opportunity Number:** ${opportunity?.opportunityNumber || synopsis.opportunityNumber || 'Unknown'}`,
    `**Deadline:** ${report?.deadline || synopsis.closeDate || 'Not specified'}`,
    `**Funding Ceiling:** ${formatCurrency(report?.funding_ceiling || synopsis.awardCeiling)}`,
    `**Generated:** ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}`,
    '',
    '## Application Field Summary',
    '',
    `- Legal applicant and compliance fields are pulled from the organization profile.`,
    `- Narrative sections are AI-drafted and require human review before submission.`,
    `- This export is formatted so it can be uploaded into Google Docs or copied into a new document.`,
    '',
  ];

  for (const section of sections || []) {
    lines.push(`## ${section.label}`, '', section.content || '_No draft generated yet._', '');
  }

  lines.push('## Budget Draft', '');
  if (budget?.raw) {
    lines.push(budget.raw, '');
  } else if (budget) {
    lines.push('```json', JSON.stringify(budget, null, 2), '```', '');
  } else {
    lines.push('_No budget draft generated yet._', '');
  }

  return lines.join('\n');
}

function buildGoogleDocsHtml(markdown) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Grant Application Packet</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.5; color: #111; max-width: 760px; margin: 48px auto; }
    h1 { font-size: 28px; margin-bottom: 16px; }
    h2 { font-size: 20px; margin-top: 32px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
    h3, h4, h5 { font-size: 16px; margin-top: 20px; }
    p, li { font-size: 12pt; }
    ul { padding-left: 24px; }
  </style>
</head>
<body>
${markdownToHtml(markdown)}
</body>
</html>`;
}

async function ensureBucket(supabase) {
  const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
  if (error && !/already exists|Duplicate/i.test(error.message || '')) {
    throw error;
  }
}

async function uploadText(supabase, path, body, contentType) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, Buffer.from(body, 'utf8'), {
      contentType,
      upsert: true,
    });

  if (error) throw error;

  const { data, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);

  if (signedError) throw signedError;
  return data?.signedUrl || '';
}

function normalizePacket(row, urls = {}) {
  if (!row) return null;
  return {
    id: row.id,
    reportId: row.report_id,
    opportunityId: row.opportunity_id,
    title: row.title,
    sections: row.sections || [],
    budget: row.budget || null,
    markdown: row.markdown || '',
    html: row.html || '',
    bucket: row.bucket || BUCKET,
    markdownPath: row.markdown_path || '',
    googleDocsPath: row.google_docs_path || '',
    markdownUrl: urls.markdownUrl || '',
    googleDocsUrl: urls.googleDocsUrl || '',
    expiresInSeconds: urls.expiresInSeconds || SIGNED_URL_TTL,
    savedAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function packetFromStorage({ reportId, opportunityId, title, markdownPath, googleDocsPath, markdown, html, createdAt, urls = {} }) {
  return {
    id: null,
    reportId: reportId || null,
    opportunityId: opportunityId || '',
    title: title || '',
    sections: [],
    budget: null,
    markdown: markdown || '',
    html: html || '',
    bucket: BUCKET,
    markdownPath,
    googleDocsPath,
    markdownUrl: urls.markdownUrl || '',
    googleDocsUrl: urls.googleDocsUrl || '',
    expiresInSeconds: SIGNED_URL_TTL,
    savedAt: createdAt || null,
    updatedAt: createdAt || null,
  };
}

async function signedUrlForPath(supabase, path) {
  if (!path) return '';
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);

  if (error) throw error;
  return data?.signedUrl || '';
}

async function downloadText(supabase, path) {
  if (!path) return '';
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) return '';
  return data ? await data.text() : '';
}

async function latestPacketFromStorage(req, { reportId, opportunityId }) {
  if (!reportId && !opportunityId) return null;

  const prefix = reportId
    ? `${req.orgId}/reports/report-${reportId}`
    : `${req.orgId}/reports/opportunity-${slugify(opportunityId)}`;

  const { data, error } = await req.supabase.storage.from(BUCKET).list(prefix, {
    limit: 100,
    sortBy: { column: 'name', order: 'desc' },
  });

  if (error || !data?.length) return null;

  const markdownFile = data.find((item) => item.name.endsWith('.md'));
  if (!markdownFile) return null;

  const markdownPath = `${prefix}/${markdownFile.name}`;
  const stamp = markdownFile.name.replace(/\.md$/, '');
  const googleDocsPath = `${prefix}/${stamp}.html`;
  const [markdown, html, markdownUrl, googleDocsUrl] = await Promise.all([
    downloadText(req.supabase, markdownPath),
    downloadText(req.supabase, googleDocsPath),
    signedUrlForPath(req.supabase, markdownPath),
    signedUrlForPath(req.supabase, googleDocsPath),
  ]);

  return packetFromStorage({
    reportId,
    opportunityId,
    markdownPath,
    googleDocsPath,
    markdown,
    html,
    createdAt: markdownFile.created_at || markdownFile.updated_at || null,
    urls: { markdownUrl, googleDocsUrl },
  });
}

router.get('/', async (req, res, next) => {
  try {
    if (!req.orgId) return res.json([]);

    const reportId = req.query.report_id ? Number(req.query.report_id) : null;
    const opportunityId = req.query.opportunity_id ? String(req.query.opportunity_id) : '';

    let query = req.supabase
      .from('application_packets')
      .select('id, report_id, opportunity_id, title, sections, budget, markdown, html, bucket, markdown_path, google_docs_path, created_at, updated_at')
      .eq('org_id', req.orgId)
      .order('created_at', { ascending: false });

    if (reportId) query = query.eq('report_id', reportId);
    if (opportunityId) query = query.eq('opportunity_id', opportunityId);

    const { data, error } = await query.limit(25);
    if (error) {
      if (packetTableMissing(error)) return res.json([]);
      throw error;
    }

    res.json((data || []).map((row) => normalizePacket(row)));
  } catch (err) {
    next(err);
  }
});

router.get('/latest', async (req, res, next) => {
  try {
    if (!req.orgId) return res.status(404).json({ error: 'No organization profile found' });

    const reportId = req.query.report_id ? Number(req.query.report_id) : null;
    const opportunityId = req.query.opportunity_id ? String(req.query.opportunity_id) : '';

    if (!reportId && !opportunityId) {
      return res.status(400).json({ error: 'report_id or opportunity_id is required' });
    }

    let query = req.supabase
      .from('application_packets')
      .select('*')
      .eq('org_id', req.orgId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (reportId) query = query.eq('report_id', reportId);
    if (opportunityId) query = query.eq('opportunity_id', opportunityId);

    const { data, error } = await query.maybeSingle();
    if (error) {
      if (packetTableMissing(error)) {
        const storagePacket = await latestPacketFromStorage(req, { reportId, opportunityId });
        if (storagePacket) return res.json(storagePacket);
        return res.status(404).json({ error: 'No saved application packet found' });
      }
      throw error;
    }
    if (!data) {
      const storagePacket = await latestPacketFromStorage(req, { reportId, opportunityId });
      if (storagePacket) return res.json(storagePacket);
      return res.status(404).json({ error: 'No saved application packet found' });
    }

    const [markdownUrl, googleDocsUrl] = await Promise.all([
      signedUrlForPath(req.supabase, data.markdown_path),
      signedUrlForPath(req.supabase, data.google_docs_path),
    ]);

    res.json(normalizePacket(data, { markdownUrl, googleDocsUrl }));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    if (!req.orgId) return res.status(400).json({ error: 'Create an organization profile first' });

    const { report, opportunity, sections, budget } = req.body;
    if (!report?.id && !report?.opportunity_id) {
      return res.status(400).json({ error: 'A selected report is required' });
    }

    const markdown = buildMarkdown({ report, opportunity, sections, budget });
    const html = buildGoogleDocsHtml(markdown);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const title = report?.program || opportunity?.opportunityTitle || opportunity?.synopsis?.opportunityTitle || 'Grant Application Packet';
    const opportunityId = String(report?.opportunity_id || opportunity?.id || '');
    const base = `${packetBasePath(req.orgId, report, opportunity, title)}/${stamp}`;

    await ensureBucket(req.supabase);

    const markdownPath = `${base}.md`;
    const googleDocsPath = `${base}.html`;

    const [markdownUrl, googleDocsUrl] = await Promise.all([
      uploadText(req.supabase, markdownPath, markdown, 'text/markdown; charset=utf-8'),
      uploadText(req.supabase, googleDocsPath, html, 'text/html; charset=utf-8'),
    ]);

    const { data: packet, error: packetError } = await req.supabase
      .from('application_packets')
      .insert({
        org_id: req.orgId,
        report_id: report?.id || null,
        opportunity_id: opportunityId,
        title,
        sections: sections || [],
        budget: budget || null,
        markdown,
        html,
        bucket: BUCKET,
        markdown_path: markdownPath,
        google_docs_path: googleDocsPath,
      })
      .select('*')
      .single();

    if (packetError) {
      if (packetTableMissing(packetError)) {
        return res.json({
          ok: true,
          warning: 'Application packet database table is missing. Saved to Storage only. Run web/supabase/migrations/002_application_packets.sql in Supabase to enable database packet history.',
          ...packetFromStorage({
            reportId: report?.id || null,
            opportunityId,
            title,
            markdownPath,
            googleDocsPath,
            markdown,
            html,
            createdAt: new Date().toISOString(),
            urls: { markdownUrl, googleDocsUrl },
          }),
        });
      }
      throw packetError;
    }

    res.json({
      ok: true,
      ...normalizePacket(packet, { markdownUrl, googleDocsUrl }),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
