<script>
  import { api } from '../../lib/api.js';
  import { toast } from '../../lib/stores.js';
  import StatusBadge from '../../components/StatusBadge.svelte';
  import ScoreRing from '../../components/ScoreRing.svelte';

  let reports = $state([]);
  let loading = $state(true);
  let deletingId = $state('');

  $effect(() => {
    api.getReports()
      .then(r => { reports = r; loading = false; })
      .catch(err => { toast(err.message, 'error'); loading = false; });
  });

  async function removeEvaluation(report) {
    if (!window.confirm(`Remove evaluation for "${report.program}"? This deletes the saved report and tracker entry.`)) return;

    deletingId = report.id;
    try {
      await api.deleteReport(report.id);
      reports = reports.filter((item) => item.id !== report.id);
      toast('Evaluation removed', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      deletingId = '';
    }
  }
</script>

<div class="page-header">
  <h1>Evaluation Reports</h1>
  <p>{reports.length} report{reports.length !== 1 ? 's' : ''} measuring which opportunities can fund the Main Street AI agenda.</p>
</div>

{#if loading}
  <div class="empty-state"><span class="spinner"></span></div>
{:else if reports.length === 0}
  <div class="card">
    <div class="empty-state">
      <h3>No reports yet</h3>
      <p>Evaluate grants from your <a href="#/grants/pipeline">pipeline</a> to generate reports.</p>
    </div>
  </div>
{:else}
  <div class="reports-grid">
    {#each reports as report}
      <div class="card report-card">
        <a href="#/grants/reports/{report.id}" class="report-link">
          <div class="report-header">
            <ScoreRing score={report.score} size={44} />
            <div class="report-info">
              <div class="report-program">{report.program}</div>
              <div class="report-agency">{report.agency}</div>
            </div>
          </div>
          <div class="report-meta">
            <StatusBadge status={report.status} />
            {#if report.deadline}
              <span class="report-deadline">{new Date(report.deadline).toLocaleDateString()}</span>
            {/if}
            {#if report.category}
              <span class="report-category">{report.category}</span>
            {/if}
          </div>
          <div class="report-date">#{String(report.entry_num).padStart(3, '0')} - {new Date(report.created_at).toLocaleDateString()}</div>
        </a>
        <button class="btn btn-sm btn-danger remove-btn" disabled={deletingId === report.id} onclick={() => removeEvaluation(report)}>
          {deletingId === report.id ? 'Removing...' : 'Remove'}
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .reports-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 1rem;
  }

  .report-card {
    color: var(--text);
    transition: box-shadow 0.15s, transform 0.15s;
  }

  .report-card:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
  }

  .report-link {
    display: block;
    text-decoration: none;
    color: inherit;
  }

  .report-link:hover {
    text-decoration: none;
  }

  .remove-btn {
    margin-top: 0.875rem;
  }

  .report-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .report-info {
    flex: 1;
    min-width: 0;
  }

  .report-program {
    font-weight: 600;
    font-size: 0.9375rem;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .report-agency {
    font-size: 0.8125rem;
    color: var(--primary);
    font-weight: 500;
  }

  .report-meta {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .report-deadline, .report-category {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .report-date {
    margin-top: 0.75rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-family: var(--font-mono);
  }
</style>
