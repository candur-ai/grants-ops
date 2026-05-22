// Lightweight markdown to HTML renderer for reports
export function renderMarkdown(md) {
  if (!md) return '';

  let html = md
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

    // Headers
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')

    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')

    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')

    // Horizontal rules
    .replace(/^---+$/gm, '<hr>')

    // Code blocks
    .replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/```\w*\n?/, '').replace(/\n?```$/, '');
      return `<pre><code>${code}</code></pre>`;
    })

    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')

    // Unordered lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')

    // Paragraphs (lines not already wrapped)
    .replace(/^(?!<[hlupor]|<li|<hr|<pre)(.+)$/gm, '<p>$1</p>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  return html;
}

// Parse report header fields from markdown
export function parseReportHeader(md) {
  const fields = {};
  const lines = md.split('\n');

  for (const line of lines) {
    const match = line.match(/\*\*(.+?):\*\*\s*(.+)/);
    if (match) {
      const key = match[1].toLowerCase().replace(/\s+/g, '_');
      fields[key] = match[2].trim();
    }
    if (line.startsWith('# ')) {
      fields.title = line.slice(2).trim();
    }
  }

  return fields;
}
