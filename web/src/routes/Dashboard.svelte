<script>
  import { api } from '../lib/api.js';
  import { profile } from '../lib/stores.js';
  import StatusBadge from '../components/StatusBadge.svelte';
  import DeadlineChip from '../components/DeadlineChip.svelte';

  let data = $state(null);
  let loading = $state(true);

  $effect(() => {
    api.getDashboard()
      .then(d => { data = d; loading = false; })
      .catch(() => { loading = false; });
  });

  const statusOrder = ['Discovered', 'Evaluated', 'Preparing', 'Applied', 'Under Review', 'Awarded', 'Not Funded', 'SKIP'];
</script>

<div class="page-header">
  <h1>Dashboard</h1>
  {#if $profile}
    <p>{$profile.legal_name} · Funding pipeline for practical AI programs on Main Street.</p>
  {/if}
</div>

{#if loading}
  <div class="empty-state"><span class="spinner"></span></div>
{:else if !data?.has_profile}
  <div class="card">
    <div class="empty-state">
      <h3>Welcome to Grants-Ops</h3>
      <p>Set up your organization profile to find and apply for grants that advance education, career paths, small business, health care, and community AI work.</p>
      <a href="#/grants/profile" class="btn btn-primary" style="margin-top:1rem">Create Profile</a>
    </div>
  </div>
{:else}
  <!-- Compliance Alerts -->
  {#if data.compliance_alerts?.length > 0}
    <div class="alerts">
      {#each data.compliance_alerts as alert}
        <div class="alert alert-{alert.type}">
          {alert.message}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Stats Row -->
  <div class="stats-grid">
    <div class="card stat-card">
      <div class="stat-value">{data.total_applications || 0}</div>
      <div class="stat-label">Total Grants Tracked</div>
    </div>
    <div class="card stat-card">
      <div class="stat-value">{data.pipeline_pending || 0}</div>
      <div class="stat-label">Pipeline Queue</div>
    </div>
    <div class="card stat-card">
      <div class="stat-value">{data.win_rate ? `${data.win_rate}%` : '--'}</div>
      <div class="stat-label">Win Rate</div>
    </div>
    <div class="card stat-card">
      <div class="stat-value">{data.upcoming_deadlines?.length || 0}</div>
      <div class="stat-label">Upcoming Deadlines</div>
    </div>
  </div>

  <!-- Status Breakdown -->
  <div class="card" style="margin-top:1.5rem">
    <h2 class="section-title">Applications by Status</h2>
    <div class="status-grid">
      {#each statusOrder as status}
        {@const count = data.counts?.[status] || 0}
        {#if count > 0}
          <div class="status-item">
            <StatusBadge {status} />
            <span class="status-count">{count}</span>
          </div>
        {/if}
      {/each}
      {#if Object.keys(data.counts || {}).length === 0}
        <p class="text-secondary">No applications yet. <a href="#/grants/search">Search for grants</a> to get started.</p>
      {/if}
    </div>
  </div>

  <!-- Upcoming Deadlines -->
  {#if data.upcoming_deadlines?.length > 0}
    <div class="card" style="margin-top:1.5rem">
      <h2 class="section-title">Upcoming Deadlines</h2>
      <table>
        <thead>
          <tr>
            <th>Program</th>
            <th>Agency</th>
            <th>Status</th>
            <th>Deadline</th>
          </tr>
        </thead>
        <tbody>
          {#each data.upcoming_deadlines as item}
            <tr>
              <td>{item.program}</td>
              <td>{item.agency}</td>
              <td><StatusBadge status={item.status} /></td>
              <td>
                <DeadlineChip deadline={item.deadline} />
                <span class="deadline-date">{new Date(item.deadline).toLocaleDateString()}</span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- Recent Activity -->
  {#if data.recent?.length > 0}
    <div class="card" style="margin-top:1.5rem">
      <h2 class="section-title">Recent Activity</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Agency</th>
            <th>Program</th>
            <th>Score</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {#each data.recent as item}
            <tr>
              <td>{new Date(item.date).toLocaleDateString()}</td>
              <td>{item.agency}</td>
              <td>{item.program}</td>
              <td>{item.score ? `${item.score}/5` : '--'}</td>
              <td><StatusBadge status={item.status} /></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- Quick Actions -->
  <div class="quick-actions" style="margin-top:1.5rem">
    <a href="#/grants/search" class="btn btn-primary">Search Grants</a>
    <a href="#/grants/pipeline" class="btn btn-secondary">View Pipeline</a>
    <a href="#/grants/tracker" class="btn btn-secondary">View Tracker</a>
  </div>
{/if}

<style>
  .alerts {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .alert {
    padding: 0.75rem 1rem;
    border-radius: var(--radius);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .alert-danger {
    background: var(--danger-light);
    color: var(--danger);
  }

  .alert-warning {
    background: var(--warning-light);
    color: var(--warning);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
  }

  .stat-card {
    text-align: center;
    padding: 1.25rem;
  }

  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text);
  }

  .stat-label {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  .status-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-count {
    font-weight: 700;
    font-size: 1.125rem;
  }

  .deadline-date {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin-left: 0.5rem;
  }

  .text-secondary {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .quick-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
</style>
