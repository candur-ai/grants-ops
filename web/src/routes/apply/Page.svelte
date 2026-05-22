<script>
  import { onMount } from 'svelte';
  import { api } from '../../lib/api.js';
  import { profile, toast } from '../../lib/stores.js';
  import { renderMarkdown } from '../../lib/markdown.js';
  import DeadlineChip from '../../components/DeadlineChip.svelte';
  import ScoreRing from '../../components/ScoreRing.svelte';

  const sections = [
    {
      id: 'project_summary',
      label: 'Project Summary',
      instructions: 'Write a concise application-ready project summary with problem, proposed intervention, target population, geography, and expected results.',
    },
    {
      id: 'needs_statement',
      label: 'Need Statement',
      instructions: 'Write the statement of need. Tie the need to the grant goals and the organization profile. Avoid unsupported statistics unless the source is named in the profile or report.',
    },
    {
      id: 'project_design',
      label: 'Project Design',
      instructions: 'Write the program design, activities, workplan, staffing approach, and deliverables in a federal grant application style.',
    },
    {
      id: 'organizational_capacity',
      label: 'Organizational Capacity',
      instructions: 'Write the organizational capability section using the profile, compliance posture, partnerships, and differentiator.',
    },
    {
      id: 'evaluation_plan',
      label: 'Evaluation Plan',
      instructions: 'Write a practical evaluation plan with outputs, outcomes, data collection, cadence, and how results will improve the program.',
    },
    {
      id: 'sustainability',
      label: 'Sustainability',
      instructions: 'Write a sustainability plan for continuing the work after the grant period.',
    },
  ];

  let reports = $state([]);
  let selectedReportId = $state('');
  let selectedReport = $derived(reports.find((report) => String(report.id) === String(selectedReportId)) || null);
  let opportunity = $state(null);
  let loading = $state(true);
  let loadingSavedPacket = $state(false);
  let generating = $state(false);
  let saving = $state(false);
  let generated = $state({});
  let budget = $state(null);
  let exportInfo = $state(null);
  let error = $state('');

  onMount(async () => {
    try {
      reports = await api.getReports();
      selectedReportId = reports[0]?.id || '';
      if (selectedReportId) await loadOpportunity();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      loading = false;
    }
  });

  async function loadOpportunity() {
    opportunity = null;
    budget = null;
    generated = {};
    exportInfo = null;
    error = '';
    if (!selectedReport?.opportunity_id) return;

    try {
      opportunity = await api.getGrant(selectedReport.opportunity_id);
      await loadSavedPacket();
    } catch (err) {
      toast(`Could not load opportunity details: ${err.message}`, 'error');
    }
  }

  async function loadSavedPacket() {
    if (!selectedReport?.id) return;

    loadingSavedPacket = true;
    try {
      const packet = await api.getLatestApplicationPacket(`report_id=${encodeURIComponent(selectedReport.id)}`);
      applySavedPacket(packet);
    } catch (err) {
      if (!/No saved application packet/i.test(err.message)) {
        toast(err.message, 'error');
      }
    } finally {
      loadingSavedPacket = false;
    }
  }

  function applySavedPacket(packet) {
    if (!packet) return;

    const nextGenerated = {};
    for (const section of packet.sections || []) {
      if (section?.id) nextGenerated[section.id] = section.content || '';
    }

    generated = nextGenerated;
    budget = packet.budget || null;
    exportInfo = packet;
  }

  async function generatePacket() {
    if (!selectedReport?.opportunity_id) return;

    generating = true;
    generated = {};
    budget = null;
    error = '';

    try {
      const nextGenerated = {};
      for (const section of sections) {
        const result = await api.generateNarrative({
          opportunity_id: selectedReport.opportunity_id,
          section: section.label,
          instructions: section.instructions,
        });
        nextGenerated[section.id] = result.narrative;
        generated = { ...nextGenerated };
      }

      const nextBudget = await api.buildBudget({
        opportunity_id: selectedReport.opportunity_id,
        parameters: {
          project_period_months: 12,
          requested_amount: selectedReport.funding_ceiling || opportunity?.synopsis?.awardCeiling || null,
          cost_share: opportunity?.synopsis?.costSharing === true ? 'required_if_applicable' : 'none_assumed',
        },
      });
      budget = nextBudget;

      await savePacket(nextGenerated, nextBudget);

      toast('Application packet drafted', 'success');
    } catch (err) {
      error = err.message;
      toast(err.message, 'error');
    } finally {
      generating = false;
    }
  }

  async function savePacket(sectionDrafts = generated, budgetDraft = budget) {
    if (!selectedReport) return;

    saving = true;
    error = '';
    try {
      const packet = await api.saveApplicationPacket({
        report: selectedReport,
        opportunity,
        sections: sections.map((section) => ({
          id: section.id,
          label: section.label,
          content: sectionDrafts[section.id] || '',
        })),
        budget: budgetDraft,
      });
      applySavedPacket(packet);
      toast('Application packet saved', 'success');
    } catch (err) {
      error = err.message;
      toast(err.message, 'error');
    } finally {
      saving = false;
    }
  }

  async function copyPacketForGoogleDocs() {
    const text = exportInfo?.markdown || buildLocalPacketMarkdown();
    if (!text.trim()) {
      toast('Generate or save a packet first', 'error');
      return;
    }

    try {
      if (exportInfo?.html && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([exportInfo.html], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      toast('Packet copied. Paste it into a new Google Doc.', 'success');
    } catch {
      toast('Could not copy packet text', 'error');
    }
  }

  function buildLocalPacketMarkdown() {
    const title = selectedReport?.program || opportunity?.opportunityTitle || 'Grant Application Packet';
    const synopsis = opportunity?.synopsis || {};
    const lines = [
      `# ${title}`,
      '',
      `**Agency:** ${selectedReport?.agency || synopsis.agencyName || 'Unknown agency'}`,
      `**Opportunity ID:** ${selectedReport?.opportunity_id || opportunity?.id || 'Unknown'}`,
      `**Opportunity Number:** ${opportunity?.opportunityNumber || synopsis.opportunityNumber || 'Unknown'}`,
      `**Deadline:** ${selectedReport?.deadline || synopsis.closeDate || 'Not specified'}`,
      `**Funding Ceiling:** ${formatCurrency(selectedReport?.funding_ceiling || synopsis.awardCeiling)}`,
      '',
      '## Application Field Summary',
      '',
      ...sf424Fields.map(([label, value]) => `- **${label}:** ${value}`),
      '',
    ];

    for (const section of sections) {
      lines.push(`## ${section.label}`, '', generated[section.id] || '_No draft generated yet._', '');
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

  function formatCurrency(n) {
    if (!n) return '--';
    return '$' + Number(n).toLocaleString();
  }

  let sf424Fields = $derived([
    ['Legal name', $profile?.legal_name || 'Missing'],
    ['EIN', $profile?.ein || 'Missing'],
    ['UEI', $profile?.uei || 'Missing'],
    ['Entity type', $profile?.entity_type || 'Missing'],
    ['SAM.gov status', $profile?.sam_registration?.status || 'Missing'],
    ['Applicant address', [$profile?.address?.street, $profile?.address?.city, $profile?.address?.state, $profile?.address?.zip].filter(Boolean).join(', ') || 'Missing'],
    ['Authorized representative', [$profile?.contacts?.authorized_representative?.name, $profile?.contacts?.authorized_representative?.title].filter(Boolean).join(', ') || 'Missing'],
    ['Opportunity number', opportunity?.opportunityNumber || opportunity?.synopsis?.opportunityNumber || selectedReport?.opportunity_id || 'Missing'],
    ['Opportunity title', opportunity?.opportunityTitle || selectedReport?.program || 'Missing'],
    ['Agency', opportunity?.synopsis?.agencyName || selectedReport?.agency || 'Missing'],
    ['Funding request', formatCurrency(selectedReport?.funding_ceiling || opportunity?.synopsis?.awardCeiling)],
  ]);

  let checklist = $derived([
    { label: 'Organization profile complete', done: Boolean($profile?.legal_name && $profile?.entity_type) },
    { label: 'EIN present', done: Boolean($profile?.ein) },
    { label: 'UEI present', done: Boolean($profile?.uei) },
    { label: 'SAM.gov active', done: $profile?.sam_registration?.status === 'active' },
    { label: 'Grant evaluated', done: Boolean(selectedReport) },
    { label: 'Opportunity details loaded', done: Boolean(opportunity) },
    { label: 'Narrative sections drafted', done: sections.every((section) => Boolean(generated[section.id])) },
    { label: 'Budget draft created', done: Boolean(budget) },
    { label: 'Human review complete before submission', done: false },
  ]);

  let savedPacketLabel = $derived(exportInfo?.savedAt
    ? `Saved ${new Date(exportInfo.savedAt).toLocaleString()}`
    : '');
</script>

<div class="page-header">
  <h1>Application Builder</h1>
  <p>Draft application materials for Main Street AI programs, from one-on-one AI tutoring to small-business adoption, community health care tools, and nonprofit operating capacity. Review everything before submitting externally.</p>
</div>

{#if loading}
  <div class="empty-state"><span class="spinner"></span></div>
{:else if reports.length === 0}
  <div class="card">
    <div class="empty-state">
      <h3>No evaluated grants yet</h3>
      <p>Evaluate a grant first, then return here to draft application materials.</p>
      <a class="btn btn-primary" href="#/grants/search">Find Grants</a>
    </div>
  </div>
{:else}
  <div class="card builder-controls">
    <div class="control-group">
      <label for="report">Evaluated opportunity</label>
      <select id="report" bind:value={selectedReportId} onchange={loadOpportunity}>
        {#each reports as report}
          <option value={report.id}>#{String(report.entry_num).padStart(3, '0')} - {report.program}</option>
        {/each}
      </select>
    </div>
    <button class="btn btn-primary" disabled={generating || !selectedReport} onclick={generatePacket}>
      {generating ? 'Drafting...' : 'Generate Application Packet'}
    </button>
    <button
      class="btn btn-secondary"
      disabled={saving || generating || !Object.keys(generated).length}
      onclick={() => savePacket()}
    >
      {saving ? 'Saving...' : 'Save & Export'}
    </button>
  </div>

  {#if loadingSavedPacket}
    <div class="card muted saved-loading">Loading saved application packet...</div>
  {/if}

  {#if selectedReport}
    <div class="overview-grid">
      <section class="card">
        <h2>Selected Grant</h2>
        <div class="grant-summary">
          <ScoreRing score={selectedReport.score} size={52} />
          <div>
            <strong>{selectedReport.program}</strong>
            <p>{selectedReport.agency}</p>
            <DeadlineChip deadline={selectedReport.deadline} />
          </div>
        </div>
      </section>

      <section class="card">
        <h2>Readiness Checklist</h2>
        <div class="checklist">
          {#each checklist as item}
            <div class:done={item.done} class:missing={!item.done}>
              <span>{item.done ? '+' : 'x'}</span>
              <p>{item.label}</p>
            </div>
          {/each}
        </div>
      </section>
    </div>

    {#if error}
      <div class="card error-card">{error}</div>
    {/if}

    {#if exportInfo}
      <section class="card export-card">
        <div>
          <h2>Saved Export</h2>
          <p class="muted">{savedPacketLabel}. Stored in the private Supabase Storage bucket <strong>{exportInfo.bucket}</strong>. Links expire in 7 days.</p>
        </div>
        <div class="export-actions">
          <button class="btn btn-primary" type="button" onclick={copyPacketForGoogleDocs}>Copy for Google Docs</button>
          <a class="btn btn-secondary" href={exportInfo.markdownUrl} target="_blank" rel="noreferrer">Markdown</a>
          <a class="btn btn-secondary" href={exportInfo.googleDocsUrl} target="_blank" rel="noreferrer">HTML Preview</a>
          <a class="btn btn-secondary" href="https://docs.new" target="_blank" rel="noreferrer">Open Blank Doc</a>
        </div>
      </section>
    {/if}

    <section class="card">
      <h2>Auto-Filled Application Fields</h2>
      <div class="field-grid">
        {#each sf424Fields as [label, value]}
          <div class:value-missing={value === 'Missing'}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        {/each}
      </div>
    </section>

    <section class="card">
      <h2>Narrative Drafts</h2>
      {#if Object.keys(generated).length === 0}
        <p class="muted">Generate the packet to draft narrative sections.</p>
      {:else}
        <div class="narrative-list">
          {#each sections as section}
            <article>
              <h3>{section.label}</h3>
              {@html renderMarkdown(generated[section.id] || '')}
            </article>
          {/each}
        </div>
      {/if}
    </section>

    <section class="card">
      <h2>Budget Draft</h2>
      {#if !budget}
        <p class="muted">Generate the packet to draft a budget.</p>
      {:else if budget.raw}
        <pre class="raw-budget">{budget.raw}</pre>
      {:else}
        <div class="budget-totals">
          <div><span>Federal</span><strong>{formatCurrency(budget.total_federal)}</strong></div>
          <div><span>Cost share</span><strong>{formatCurrency(budget.total_cost_share)}</strong></div>
          <div><span>Total project</span><strong>{formatCurrency(budget.total_project)}</strong></div>
          <div><span>Period</span><strong>{budget.period_months || '--'} months</strong></div>
        </div>
        {#each budget.line_items || [] as group}
          <div class="budget-group">
            <h3>{group.category}</h3>
            {#each group.items || [] as item}
              <div class="budget-item">
                <strong>{item.description}</strong>
                <span>{formatCurrency(item.federal)} federal / {formatCurrency(item.cost_share)} cost share</span>
                <p>{item.justification}</p>
              </div>
            {/each}
          </div>
        {/each}
      {/if}
    </section>
  {/if}
{/if}

<style>
  .builder-controls,
  .overview-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 1rem;
    align-items: end;
  }

  .overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
    margin-top: 1rem;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .control-group label,
  .field-grid span,
  .budget-totals span {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .grant-summary {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
  }

  .grant-summary p {
    margin: 0.25rem 0 0.5rem;
    color: var(--text-secondary);
  }

  .export-card {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
    margin-top: 1rem;
  }

  .saved-loading {
    margin-top: 1rem;
  }

  .export-card h2 {
    margin-bottom: 0.35rem;
  }

  .export-card p {
    margin: 0;
  }

  .export-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .checklist {
    display: grid;
    gap: 0.5rem;
  }

  .checklist div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.625rem;
    border-radius: var(--radius);
  }

  .checklist p {
    margin: 0;
    font-size: 0.875rem;
  }

  .checklist .done {
    background: var(--success-light);
  }

  .checklist .missing {
    background: var(--danger-light);
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.75rem;
  }

  .field-grid div,
  .budget-totals div,
  .budget-item {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.75rem;
    background: var(--bg);
  }

  .field-grid strong {
    display: block;
    margin-top: 0.25rem;
    word-break: break-word;
  }

  .value-missing strong {
    color: var(--danger);
  }

  .narrative-list {
    display: grid;
    gap: 1rem;
  }

  .narrative-list article {
    border-top: 1px solid var(--border);
    padding-top: 1rem;
  }

  .narrative-list h3,
  .budget-group h3 {
    font-size: 1rem;
    margin-bottom: 0.5rem;
  }

  .budget-totals {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .budget-totals strong {
    display: block;
    margin-top: 0.25rem;
  }

  .budget-group {
    border-top: 1px solid var(--border);
    padding-top: 1rem;
    margin-top: 1rem;
  }

  .budget-item {
    margin-top: 0.5rem;
  }

  .budget-item span {
    display: block;
    color: var(--text-secondary);
    font-size: 0.8125rem;
    margin-top: 0.25rem;
  }

  .raw-budget {
    white-space: pre-wrap;
    background: var(--bg);
    padding: 1rem;
    border-radius: var(--radius);
  }

  .muted {
    color: var(--text-secondary);
  }

  .error-card {
    margin-top: 1rem;
    background: var(--danger-light);
    color: var(--danger);
  }

  @media (max-width: 820px) {
    .builder-controls,
    .overview-grid,
    .export-card,
    .budget-totals {
      grid-template-columns: 1fr;
    }

    .export-card {
      align-items: stretch;
    }

    .export-actions {
      justify-content: flex-start;
    }
  }
</style>
