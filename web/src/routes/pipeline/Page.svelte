<script>
  import { api } from '../../lib/api.js';
  import { toast } from '../../lib/stores.js';
  import DeadlineChip from '../../components/DeadlineChip.svelte';

  let items = $state([]);
  let loading = $state(true);
  let addUrl = $state('');
  let adding = $state(false);

  async function loadPipeline() {
    try {
      items = await api.getPipeline();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      loading = false;
    }
  }

  $effect(() => { loadPipeline(); });

  let pending = $derived(items.filter(i => i.status === 'pending'));
  let processed = $derived(items.filter(i => i.status !== 'pending'));

  function daysLeft(deadline) {
    if (!deadline) return null;
    return Math.ceil((new Date(deadline) - new Date()) / (24 * 60 * 60 * 1000));
  }

  async function addFromUrl() {
    if (!addUrl.trim()) return;
    adding = true;

    // Extract opportunity ID from URL
    const match = addUrl.match(/(\d{5,})/);
    if (!match) {
      toast('Could not find opportunity ID in URL', 'error');
      adding = false;
      return;
    }

    try {
      // Fetch details from Grants.gov
      const opp = await api.getGrant(match[1]);
      const data = opp.opportunity || opp;

      await api.addToPipeline({
        url: addUrl.trim(),
        opportunity_id: match[1],
        agency: data.agencyCode || '',
        title: data.title || data.opportunityTitle || '',
        deadline: data.closeDateStr || data.closeDate || null,
        award_ceiling: data.awardCeiling || null,
      });

      toast('Added to pipeline', 'success');
      addUrl = '';
      await loadPipeline();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      adding = false;
    }
  }

  async function removeItem(id) {
    try {
      await api.removePipelineItem(id);
      items = items.filter(i => i.id !== id);
      toast('Removed from pipeline', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function evaluateItem(item) {
    window.location.hash = `#/grants/evaluate/${item.opportunity_id}`;
  }
</script>

<div class="page-header">
  <h1>Pipeline</h1>
  <p>Grant opportunities queued for evaluation</p>
</div>

<!-- Add URL -->
<div class="card add-row">
  <form onsubmit={(e) => { e.preventDefault(); addFromUrl(); }}>
    <input
      type="text"
      bind:value={addUrl}
      placeholder="Paste Grants.gov URL..."
      style="flex:1"
    />
    <button type="submit" class="btn btn-primary" disabled={adding}>
      {adding ? 'Adding...' : 'Add to Pipeline'}
    </button>
  </form>
</div>

{#if loading}
  <div class="empty-state"><span class="spinner"></span></div>
{:else}
  <!-- Pending -->
  <div class="card" style="margin-top:1rem">
    <h2 class="section-title">Pending ({pending.length})</h2>
    {#if pending.length === 0}
      <div class="empty-state">
        <p>No pending items. <a href="#/grants/search">Search for grants</a> to add to your pipeline.</p>
      </div>
    {:else}
      <div class="pipeline-list">
        {#each pending as item}
          <div class="pipeline-item">
            <div class="pipeline-info">
              <div class="pipeline-title">{item.title || 'Unknown'}</div>
              <div class="pipeline-meta">
                <span class="agency-tag">{item.agency}</span>
                <span>#{item.opportunity_id}</span>
                {#if item.award_ceiling}
                  <span>Up to ${Number(item.award_ceiling).toLocaleString()}</span>
                {/if}
              </div>
            </div>
            <div class="pipeline-deadline">
              <DeadlineChip deadline={item.deadline} />
            </div>
            <div class="pipeline-actions">
              <button class="btn btn-sm btn-primary" onclick={() => evaluateItem(item)}>Evaluate</button>
              <a
                href="https://www.grants.gov/search-results-detail/{item.opportunity_id}"
                target="_blank"
                rel="noopener"
                class="btn btn-sm btn-secondary"
              >Grants.gov</a>
              <button class="btn btn-sm btn-danger" onclick={() => removeItem(item.id)}>Remove</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Processed -->
  {#if processed.length > 0}
    <div class="card" style="margin-top:1rem">
      <h2 class="section-title">Processed ({processed.length})</h2>
      <div class="pipeline-list">
        {#each processed as item}
          <div class="pipeline-item processed">
            <div class="pipeline-info">
              <div class="pipeline-title">{item.title || 'Unknown'}</div>
              <div class="pipeline-meta">
                <span class="agency-tag">{item.agency}</span>
                <span class="badge badge-neutral">{item.status}</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
{/if}

<style>
  .add-row form {
    display: flex;
    gap: 0.75rem;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  .pipeline-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .pipeline-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.875rem 1rem;
    border: 1px solid var(--border-light);
    border-radius: var(--radius);
    transition: background 0.15s;
  }

  .pipeline-item:hover {
    background: var(--bg);
  }

  .pipeline-item.processed {
    opacity: 0.6;
  }

  .pipeline-info {
    flex: 1;
    min-width: 0;
  }

  .pipeline-title {
    font-weight: 500;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pipeline-meta {
    display: flex;
    gap: 0.75rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
  }

  .agency-tag {
    font-weight: 600;
    color: var(--primary);
  }

  .pipeline-deadline {
    flex-shrink: 0;
  }

  .pipeline-actions {
    display: flex;
    gap: 0.375rem;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .pipeline-item {
      flex-direction: column;
      align-items: flex-start;
    }

    .pipeline-actions {
      width: 100%;
    }
  }
</style>
