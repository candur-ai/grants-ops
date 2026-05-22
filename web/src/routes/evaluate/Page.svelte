<script>
  import { onMount } from 'svelte';
  import { api } from '../../lib/api.js';
  import { toast } from '../../lib/stores.js';
  import { renderMarkdown } from '../../lib/markdown.js';
  import ScoreRing from '../../components/ScoreRing.svelte';
  import StatusBadge from '../../components/StatusBadge.svelte';

  let { opportunityId = '' } = $props();

  let inputId = $state('');
  let evaluating = $state(false);
  let streamText = $state('');
  let result = $state(null);
  let error = $state('');

  async function startEvaluation(targetId = inputId) {
    const opportunityIdToEvaluate = String(targetId || '').trim();
    if (!opportunityIdToEvaluate) return;

    inputId = opportunityIdToEvaluate;
    evaluating = true;
    streamText = '';
    result = null;
    error = '';

    try {
      await api.evaluate(
        { opportunity_id: opportunityIdToEvaluate },
        (chunk) => {
          if (chunk.type === 'text') {
            streamText += chunk.text;
          } else if (chunk.type === 'result') {
            result = chunk;
          } else if (chunk.type === 'error') {
            error = chunk.error;
          }
        }
      );
    } catch (err) {
      error = err.message;
      if (err.message.includes('Already evaluated')) {
        toast('This grant has already been evaluated. Check your reports.', 'info');
      }
    } finally {
      evaluating = false;
    }
  }

  let parsedEval = $derived(() => {
    if (!result?.evaluation) return null;
    return result.evaluation;
  });

  let reportHtml = $derived(() => {
    const ev = parsedEval();
    if (ev?.report_md) return renderMarkdown(ev.report_md);
    if (streamText) return renderMarkdown(streamText);
    return '';
  });

  function isPositiveEligibilityCheck(check) {
    const name = String(check?.name || '').toLowerCase();
    const detail = String(check?.detail || '').toLowerCase();
    if (!name.includes('deadline')) return Boolean(check?.passed);

    if (
      detail.includes('not passed') ||
      detail.includes('has not passed') ||
      detail.includes('hasn\'t passed') ||
      detail.includes('future') ||
      detail.includes('upcoming') ||
      detail.includes('still open') ||
      detail.includes('remains open')
    ) {
      return true;
    }

    if (
      detail.includes('has passed') ||
      detail.includes('deadline passed') ||
      detail.includes('closed') ||
      detail.includes('expired') ||
      detail.includes('past deadline')
    ) {
      return false;
    }

    return Boolean(check?.passed);
  }

  onMount(() => {
    if (opportunityId) {
      startEvaluation(opportunityId);
    }
  });
</script>

<div class="page-header">
  <h1>Evaluate Grant</h1>
  <p>AI-powered grant evaluation using your organization's profile</p>
</div>

<!-- Input -->
<div class="card">
  <form onsubmit={(e) => { e.preventDefault(); startEvaluation(); }}>
    <div class="eval-input-row">
      <input
        type="text"
        bind:value={inputId}
        placeholder="Enter Grants.gov Opportunity ID (e.g., 361808)"
        style="flex:1"
        disabled={evaluating}
      />
      <button type="submit" class="btn btn-primary" disabled={evaluating || !inputId.trim()}>
        {#if evaluating}<span class="spinner"></span> Evaluating...{:else}Evaluate{/if}
      </button>
    </div>
  </form>
</div>

{#if error}
  <div class="card error-card" style="margin-top:1rem">
    <p>{error}</p>
  </div>
{/if}

<!-- Streaming output -->
{#if evaluating || streamText}
  <div class="card" style="margin-top:1rem">
    {#if evaluating}
      <div class="eval-status">
        <span class="spinner"></span>
        <span>Evaluating grant against your organization profile...</span>
      </div>
    {/if}

    {#if streamText && !result}
      <div class="stream-output">
        <pre>{streamText}</pre>
      </div>
    {/if}
  </div>
{/if}

<!-- Result -->
{#if result}
  {@const ev = parsedEval()}
  <div class="card result-card" style="margin-top:1rem">
    {#if ev}
      <div class="result-header">
        <ScoreRing score={ev.global_score} size={80} />
        <div class="result-summary">
          <h2>{ev.recommendation || 'Evaluated'}</h2>
          <StatusBadge status={ev.status} />
          <p class="result-text">{ev.summary || ''}</p>
        </div>
      </div>

      <!-- Eligibility Gate -->
      {#if ev.eligibility?.checks}
        <div class="eligibility-section">
          <h3>Eligibility Gate</h3>
          <div class="checks-grid">
            {#each ev.eligibility.checks as check}
              {@const positive = isPositiveEligibilityCheck(check)}
              <div class="check-item" class:passed={positive} class:failed={!positive}>
                <span class="check-icon">{positive ? '+' : 'x'}</span>
                <div>
                  <div class="check-name">{check.name}</div>
                  <div class="check-detail">{check.detail}</div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Dimension Scores -->
      {#if ev.scores}
        <div class="scores-section">
          <h3>Scoring Breakdown</h3>
          <div class="scores-grid">
            {#each Object.entries(ev.scores) as [key, dim]}
              <div class="score-dim">
                <div class="dim-header">
                  <span class="dim-name">{key.replace(/_/g, ' ')}</span>
                  <ScoreRing score={dim.score} size={32} />
                </div>
                <p class="dim-rationale">{dim.rationale}</p>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/if}

    <!-- Full Report -->
    {#if reportHtml()}
      <div class="report-body" style="margin-top:1.5rem">
        <h3>Full Report</h3>
        {@html reportHtml()}
      </div>
    {/if}

    {#if result.report_id}
      <div style="margin-top:1rem">
        <a href="#/grants/reports/{result.report_id}" class="btn btn-primary">View Saved Report</a>
        <a href="#/grants/tracker" class="btn btn-secondary" style="margin-left:0.5rem">Go to Tracker</a>
      </div>
    {/if}
  </div>
{/if}

<style>
  .eval-input-row {
    display: flex;
    gap: 0.75rem;
  }

  .error-card {
    background: var(--danger-light);
    color: var(--danger);
    border-color: var(--danger);
  }

  .eval-status {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--text-secondary);
    margin-bottom: 1rem;
  }

  .stream-output pre {
    font-size: 0.8125rem;
    font-family: var(--font-mono);
    white-space: pre-wrap;
    word-break: break-word;
    background: var(--bg);
    padding: 1rem;
    border-radius: var(--radius);
    max-height: 400px;
    overflow-y: auto;
  }

  .result-header {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--border-light);
  }

  .result-summary {
    flex: 1;
  }

  .result-summary h2 {
    font-size: 1.25rem;
    margin-bottom: 0.375rem;
  }

  .result-text {
    margin-top: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.9375rem;
    line-height: 1.5;
  }

  .eligibility-section, .scores-section {
    margin-top: 1.5rem;
  }

  .eligibility-section h3, .scores-section h3 {
    font-size: 1rem;
    margin-bottom: 0.75rem;
  }

  .checks-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .check-item {
    display: flex;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    border-radius: var(--radius);
    font-size: 0.875rem;
  }

  .check-item.passed {
    background: var(--success-light);
  }

  .check-item.failed {
    background: var(--danger-light);
  }

  .check-icon {
    font-weight: 700;
    flex-shrink: 0;
    width: 1.25rem;
    text-align: center;
  }

  .passed .check-icon { color: var(--success); }
  .failed .check-icon { color: var(--danger); }

  .check-name {
    font-weight: 500;
  }

  .check-detail {
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .scores-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 0.75rem;
  }

  .score-dim {
    padding: 0.75rem;
    border: 1px solid var(--border-light);
    border-radius: var(--radius);
  }

  .dim-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.375rem;
  }

  .dim-name {
    font-weight: 500;
    text-transform: capitalize;
    font-size: 0.875rem;
  }

  .dim-rationale {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .report-body {
    line-height: 1.7;
    font-size: 0.9375rem;
  }

  .report-body :global(h2) { font-size: 1.125rem; margin: 1.25rem 0 0.625rem; }
  .report-body :global(h3) { font-size: 1rem; margin: 1rem 0 0.5rem; }
  .report-body :global(p) { margin-bottom: 0.75rem; }
  .report-body :global(ul) { margin: 0.5rem 0 1rem 1.25rem; }
  .report-body :global(li) { margin-bottom: 0.375rem; }
</style>
