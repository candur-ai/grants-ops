<script>
  import { api } from '../../lib/api.js';
  import { toast, CANONICAL_STATES } from '../../lib/stores.js';
  import StatusBadge from '../../components/StatusBadge.svelte';
  import ScoreRing from '../../components/ScoreRing.svelte';
  import DeadlineChip from '../../components/DeadlineChip.svelte';

  let apps = $state([]);
  let loading = $state(true);
  let filterStatus = $state('');
  let filterAgency = $state('');
  let sortBy = $state('entry_num');
  let sortDir = $state('desc');
  let editingId = $state(null);
  let editValue = $state('');
  let deletingReportId = $state('');

  async function loadApps() {
    try {
      apps = await api.getApplications();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      loading = false;
    }
  }

  $effect(() => { loadApps(); });

  let filtered = $derived(() => {
    let list = apps;
    if (filterStatus) list = list.filter(a => a.status === filterStatus);
    if (filterAgency) list = list.filter(a => a.agency.toLowerCase().includes(filterAgency.toLowerCase()));

    list = [...list].sort((a, b) => {
      let va = a[sortBy], vb = b[sortBy];
      if (sortBy === 'score') { va = Number(va) || 0; vb = Number(vb) || 0; }
      if (sortBy === 'deadline' || sortBy === 'date') { va = new Date(va || 0); vb = new Date(vb || 0); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  });

  function toggleSort(col) {
    if (sortBy === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = col;
      sortDir = 'desc';
    }
  }

  async function updateStatus(app, newStatus) {
    try {
      await api.updateApplication(app.id, { status: newStatus });
      app.status = newStatus;
      apps = [...apps];
      toast('Status updated', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
    editingId = null;
  }

  async function updateNotes(app) {
    try {
      await api.updateApplication(app.id, { notes: editValue });
      app.notes = editValue;
      apps = [...apps];
      toast('Notes updated', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
    editingId = null;
  }

  async function removeEvaluation(app) {
    if (!app.report_id) return;
    if (!window.confirm(`Remove evaluation for "${app.program}"? This deletes the saved report and tracker entry.`)) return;

    deletingReportId = app.report_id;
    try {
      await api.deleteReport(app.report_id);
      apps = apps.filter((item) => item.id !== app.id);
      toast('Evaluation removed', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      deletingReportId = '';
    }
  }
</script>

<div class="page-header">
  <h1>Application Tracker</h1>
  <p>{apps.length} grant{apps.length !== 1 ? 's' : ''} tracked</p>
</div>

<!-- Filters -->
<div class="card filter-bar">
  <select bind:value={filterStatus}>
    <option value="">All statuses</option>
    {#each CANONICAL_STATES as s}
      <option value={s.label}>{s.label}</option>
    {/each}
  </select>
  <input type="text" bind:value={filterAgency} placeholder="Filter by agency..." />
</div>

{#if loading}
  <div class="empty-state"><span class="spinner"></span></div>
{:else if apps.length === 0}
  <div class="card" style="margin-top:1rem">
    <div class="empty-state">
      <h3>No applications yet</h3>
      <p>Evaluate grants from your <a href="#/grants/pipeline">pipeline</a> or <a href="#/grants/search">search</a> for new ones.</p>
    </div>
  </div>
{:else}
  <div class="card table-card" style="margin-top:1rem">
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th class="sortable" onclick={() => toggleSort('entry_num')}>#</th>
            <th class="sortable" onclick={() => toggleSort('date')}>Date</th>
            <th>Agency</th>
            <th>Program</th>
            <th class="sortable" onclick={() => toggleSort('score')}>Score</th>
            <th>Status</th>
            <th class="sortable" onclick={() => toggleSort('deadline')}>Deadline</th>
            <th>Report</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each filtered() as app}
            <tr>
              <td class="num-cell">{String(app.entry_num).padStart(3, '0')}</td>
              <td>{new Date(app.date).toLocaleDateString()}</td>
              <td><span class="agency-tag">{app.agency}</span></td>
              <td class="program-cell">{app.program}</td>
              <td>
                {#if app.score !== null && app.score !== undefined}
                  <ScoreRing score={app.score} size={36} />
                {:else}
                  --
                {/if}
              </td>
              <td>
                {#if editingId === `status-${app.id}`}
                  <select
                    value={app.status}
                    onchange={(e) => updateStatus(app, e.target.value)}
                    onblur={() => editingId = null}
                  >
                    {#each CANONICAL_STATES as s}
                      <option value={s.label}>{s.label}</option>
                    {/each}
                  </select>
                {:else}
                  <button class="status-btn" onclick={() => editingId = `status-${app.id}`}>
                    <StatusBadge status={app.status} />
                  </button>
                {/if}
              </td>
              <td>
                {#if app.deadline}
                  <DeadlineChip deadline={app.deadline} />
                {:else}
                  --
                {/if}
              </td>
              <td>
                {#if app.report_id}
                  <a href="#/grants/reports/{app.report_id}" class="btn btn-sm btn-secondary">View</a>
                {:else}
                  --
                {/if}
              </td>
              <td class="notes-cell">
                {#if editingId === `notes-${app.id}`}
                  <input
                    type="text"
                    bind:value={editValue}
                    onblur={() => updateNotes(app)}
                    onkeydown={(e) => e.key === 'Enter' && updateNotes(app)}
                  />
                {:else}
                  <button
                    class="notes-btn"
                    onclick={() => { editingId = `notes-${app.id}`; editValue = app.notes || ''; }}
                  >
                    {app.notes || 'Add note...'}
                  </button>
                {/if}
              </td>
              <td>
                {#if app.report_id}
                  <button class="btn btn-sm btn-danger" disabled={deletingReportId === app.report_id} onclick={() => removeEvaluation(app)}>
                    {deletingReportId === app.report_id ? 'Removing...' : 'Remove'}
                  </button>
                {:else}
                  --
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}

<style>
  .filter-bar {
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
  }

  .filter-bar select, .filter-bar input {
    min-width: 160px;
  }

  .table-card {
    padding: 0;
    overflow: hidden;
  }

  .table-wrapper {
    overflow-x: auto;
  }

  .table-card table {
    min-width: 900px;
  }

  .sortable {
    cursor: pointer;
    user-select: none;
  }

  .sortable:hover {
    color: var(--primary);
  }

  .num-cell {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .agency-tag {
    font-weight: 600;
    color: var(--primary);
    font-size: 0.8125rem;
  }

  .program-cell {
    max-width: 250px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .status-btn {
    padding: 0;
  }

  .status-btn:hover {
    opacity: 0.8;
  }

  .notes-cell {
    max-width: 200px;
  }

  .notes-btn {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 180px;
    display: block;
  }

  .notes-btn:hover {
    color: var(--text);
  }

  .notes-cell input {
    width: 100%;
    font-size: 0.8125rem;
  }
</style>
