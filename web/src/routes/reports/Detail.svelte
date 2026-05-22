<script>
  import { api } from '../../lib/api.js';
  import { toast } from '../../lib/stores.js';
  import { renderMarkdown, parseReportHeader } from '../../lib/markdown.js';
  import StatusBadge from '../../components/StatusBadge.svelte';
  import ScoreRing from '../../components/ScoreRing.svelte';

  let { id } = $props();
  let report = $state(null);
  let loading = $state(true);
  let deleting = $state(false);

  $effect(() => {
    if (id) {
      loading = true;
      api.getReport(id)
        .then(r => { report = r; loading = false; })
        .catch(err => { toast(err.message, 'error'); loading = false; });
    }
  });

  let bodyHtml = $derived(report ? renderMarkdown(report.body_md) : '');

  function formatCurrency(n) {
    if (!n) return '--';
    return '$' + Number(n).toLocaleString();
  }

  async function removeEvaluation() {
    if (!report) return;
    if (!window.confirm(`Remove evaluation for "${report.program}"? This deletes the saved report and tracker entry.`)) return;

    deleting = true;
    try {
      await api.deleteReport(report.id);
      toast('Evaluation removed', 'success');
      window.location.hash = '#/grants/reports';
    } catch (err) {
      toast(err.message, 'error');
      deleting = false;
    }
  }
</script>

<div class="page-header">
  <a href="#/grants/reports" class="back-link">Reports</a>
  {#if report}
    <h1>{report.program}</h1>
    <p>{report.agency} | #{String(report.entry_num).padStart(3, '0')}</p>
  {/if}
</div>

{#if loading}
  <div class="empty-state"><span class="spinner"></span></div>
{:else if report}
  <!-- Header Card -->
  <div class="card report-summary">
    <div class="summary-main">
      <ScoreRing score={report.score} size={72} />
      <div class="summary-details">
        <div class="summary-row">
          <span class="summary-label">Status</span>
          <StatusBadge status={report.status} />
        </div>
        <div class="summary-row">
          <span class="summary-label">Category</span>
          <span>{report.category || '--'}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Deadline</span>
          <span>{report.deadline ? new Date(report.deadline).toLocaleDateString() : '--'}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Funding</span>
          <span>{formatCurrency(report.funding_floor)} - {formatCurrency(report.funding_ceiling)}</span>
        </div>
      </div>
    </div>
    {#if report.url}
      <a href={report.url} target="_blank" rel="noopener" class="btn btn-secondary" style="margin-top:1rem">
        View on Grants.gov
      </a>
    {/if}
    <button class="btn btn-danger" disabled={deleting} onclick={removeEvaluation} style="margin-top:0.75rem">
      {deleting ? 'Removing...' : 'Remove Evaluation'}
    </button>
  </div>

  <!-- Report Body -->
  <div class="card report-body" style="margin-top:1rem">
    {@html bodyHtml}
  </div>
{:else}
  <div class="card">
    <div class="empty-state">
      <h3>Report not found</h3>
      <a href="#/grants/reports">Back to reports</a>
    </div>
  </div>
{/if}

<style>
  .back-link {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    display: inline-block;
    margin-bottom: 0.5rem;
  }

  .back-link:hover {
    color: var(--primary);
  }

  .report-summary {
    display: flex;
    flex-direction: column;
  }

  .summary-main {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
  }

  .summary-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .summary-row {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .summary-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-secondary);
    min-width: 80px;
  }

  .report-body {
    line-height: 1.7;
    font-size: 0.9375rem;
  }

  .report-body :global(h1) { font-size: 1.375rem; margin: 1.5rem 0 0.75rem; }
  .report-body :global(h2) { font-size: 1.125rem; margin: 1.25rem 0 0.625rem; color: var(--text); }
  .report-body :global(h3) { font-size: 1rem; margin: 1rem 0 0.5rem; }
  .report-body :global(p) { margin-bottom: 0.75rem; }
  .report-body :global(ul) { margin: 0.5rem 0 1rem 1.25rem; }
  .report-body :global(li) { margin-bottom: 0.375rem; }
  .report-body :global(strong) { font-weight: 600; }
  .report-body :global(hr) { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }
  .report-body :global(table) { margin: 1rem 0; }
  .report-body :global(pre) {
    background: var(--bg);
    padding: 1rem;
    border-radius: var(--radius);
    overflow-x: auto;
    font-size: 0.8125rem;
  }
  .report-body :global(code) {
    font-family: var(--font-mono);
    font-size: 0.85em;
    background: var(--bg);
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
  }
</style>
