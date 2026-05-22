import { Router } from 'express';

const router = Router();
const BUCKET = 'application-packets';
const SIGNED_URL_TTL = 60 * 60 * 24 * 7;

function slugify(value) {
  return String(value || 'application')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'application';
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
    const base = `${req.orgId}/${slugify(report?.program || opportunity?.opportunityTitle)}/${stamp}`;

    await ensureBucket(req.supabase);

    const markdownPath = `${base}.md`;
    const googleDocsPath = `${base}.html`;

    const [markdownUrl, googleDocsUrl] = await Promise.all([
      uploadText(req.supabase, markdownPath, markdown, 'text/markdown; charset=utf-8'),
      uploadText(req.supabase, googleDocsPath, html, 'text/html; charset=utf-8'),
    ]);

    res.json({
      ok: true,
      bucket: BUCKET,
      markdownPath,
      googleDocsPath,
      markdownUrl,
      googleDocsUrl,
      markdown,
      html,
      expiresInSeconds: SIGNED_URL_TTL,
      savedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
