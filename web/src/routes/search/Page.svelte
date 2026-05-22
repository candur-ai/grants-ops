<script>
  import { api } from '../../lib/api.js';
  import { get } from 'svelte/store';
  import { profile, ENTITY_TYPES, FUNDING_CATEGORIES, toast } from '../../lib/stores.js';
  import DeadlineChip from '../../components/DeadlineChip.svelte';

  let initialProfile = get(profile);
  let keyword = $state(initialProfile?.target_grants?.focus_areas?.[0] || '');
  let selectedAgency = $state('');
  let results = $state([]);
  let loading = $state(false);
  let hitCount = $state(0);
  let page = $state(1);
  let useProfileFilters = $state(false);
  let detailModal = $state(null);
  let loadingDetailIds = $state(new Set());
  let addingIds = $state(new Set());

  function getOpportunityId(opp) {
    return opp.id || opp.opportunityId || opp.opportunity_id;
  }

  function getOpportunityNumber(opp) {
    return opp.number || opp.opportunityNumber || opp.opportunity_number || getOpportunityId(opp);
  }

  function getOpportunityTitle(opp) {
    return opp.title || opp.opportunityTitle || opp.opportunity_title || 'Untitled opportunity';
  }

  function getDeadline(opp) {
    return opp.closeDateStr || opp.closeDate || opp.close_date || '';
  }

  function normalizeGrantResults(res) {
    const payload = res?.data || res || {};
    const items = payload.oppHits || payload.opportunities || payload.results || [];
    return {
      items: Array.isArray(items) ? items : [],
      count: payload.hitCount ?? payload.totalRecords ?? payload.total ?? items.length ?? 0,
    };
  }

  let detail = $derived(detailModal?.data || detailModal || null);
  let detailSynopsis = $derived(detail?.synopsis || {});
  let detailTitle = $derived(detail?.opportunityTitle || detailSynopsis?.opportunityTitle || detailSynopsis?.title || 'Grant Details');

  function stripHtml(html = '') {
    if (!html) return '';
    return String(html)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&mdash;/g, '-')
      .replace(/&#8209;/g, '-')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function asList(items = []) {
    return Array.isArray(items) ? items.map(i => i.description || i.programTitle || i.cfdaNumber || i.id).filter(Boolean).join(', ') : '';
  }

  let agencies = $derived($profile?.target_grants?.preferred_agencies || []);
  let entityCode = $derived(
    ENTITY_TYPES.find(e => e.value === $profile?.entity_type)?.code || ''
  );
  let categoryCodes = $derived(
    ($profile?.target_grants?.eligible_categories || []).map(c => c.code)
  );

  async function search() {
    loading = true;
    try {
      const body = {
        keyword,
        oppStatuses: 'posted',
        rows: 25,
        startRecord: (page - 1) * 25 + 1,
      };
      if (selectedAgency) body.agencies = selectedAgency;
      if (useProfileFilters) {
        if (entityCode) body.eligibilities = [entityCode];
        if (categoryCodes.length) body.fundingCategories = categoryCodes;
      }

      const res = await api.searchGrants(body);
      const normalized = normalizeGrantResults(res);
      results = normalized.items;
      hitCount = normalized.count || results.length;
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      loading = false;
    }
  }

  async function addToPipeline(opp) {
    const id = getOpportunityId(opp);
    addingIds = new Set([...addingIds, id]);

    try {
      await api.addToPipeline({
        url: `https://www.grants.gov/search-results-detail/${id}`,
        opportunity_id: String(id),
        agency: opp.agency || opp.agencyCode || '',
        title: getOpportunityTitle(opp),
        deadline: getDeadline(opp) || null,
        award_ceiling: opp.awardCeiling || null,
      });
      toast('Added to pipeline', 'success');
    } catch (err) {
      if (err.message.includes('Already')) {
        toast(err.message, 'info');
      } else {
        toast(err.message, 'error');
      }
    }
  }

  async function viewDetails(opp) {
    const id = getOpportunityId(opp);
    loadingDetailIds = new Set([...loadingDetailIds, id]);
    try {
      detailModal = await api.getGrant(id);
    } catch (err) {
      toast(`Failed to fetch details: ${err.message}`, 'error');
    } finally {
      loadingDetailIds = new Set([...loadingDetailIds].filter(item => item !== id));
    }
  }

  function evaluateOpportunity(opp) {
    const id = getOpportunityId(opp);
    if (!id) {
      toast('Missing opportunity ID', 'error');
      return;
    }
    window.location.hash = `#/grants/evaluate/${id}`;
  }

  function formatCurrency(n) {
    if (!n) return '--';
    return '$' + Number(n).toLocaleString();
  }
</script>

<div class="page-header">
  <h1>Search Grants</h1>
  <p>Find federal funding for the Main Street AI agenda: education, career paths, small business, health care, nonprofits, community organizations, and practical AI training.</p>
</div>

<!-- Search Form -->
<div class="card search-form">
  <form onsubmit={(e) => { e.preventDefault(); page = 1; search(); }}>
    <div class="search-row">
      <div class="search-field" style="flex:2">
        <label for="keyword">Keywords</label>
        <input id="keyword" type="text" bind:value={keyword} placeholder="e.g., youth financial literacy" />
      </div>
      <div class="search-field" style="flex:1">
        <label for="agency">Agency</label>
        <select id="agency" bind:value={selectedAgency}>
          <option value="">All agencies</option>
          {#each agencies as a}
            <option value={a.code}>{a.code} - {a.name}</option>
          {/each}
        </select>
      </div>
      <div class="search-field" style="align-self:flex-end">
        <button type="submit" class="btn btn-primary" disabled={loading}>
          {#if loading}<span class="spinner"></span>{:else}Search{/if}
        </button>
      </div>
    </div>
    {#if categoryCodes.length || entityCode}
      <div class="search-meta">
        <label class="filter-toggle">
          <input type="checkbox" bind:checked={useProfileFilters} />
          Use profile filters
        </label>
        {#if useProfileFilters}
          <span>
            {#if categoryCodes.length}Categories: {categoryCodes.join(', ')}{/if}
            {#if entityCode} Eligibility: {ENTITY_TYPES.find(e => e.code === entityCode)?.label}{/if}
          </span>
        {:else}
          <span>Profile filters are available but off, so broad searches can return matches.</span>
        {/if}
      </div>
    {/if}
  </form>
</div>

<!-- Results -->
{#if results.length > 0}
  <div class="card" style="margin-top:1rem">
    <div class="results-header">
      <span>{hitCount} results found</span>
      {#if hitCount > 25}
        <div class="pagination">
          <button class="btn btn-sm btn-secondary" disabled={page <= 1} onclick={() => { page--; search(); }}>Prev</button>
          <span>Page {page}</span>
          <button class="btn btn-sm btn-secondary" disabled={page * 25 >= hitCount} onclick={() => { page++; search(); }}>Next</button>
        </div>
      {/if}
    </div>

    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Agency</th>
          <th>Funding</th>
          <th>Deadline</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each results as opp}
          {@const id = getOpportunityId(opp)}
          <tr>
            <td class="title-cell">
              <div class="opp-title">{getOpportunityTitle(opp)}</div>
              <div class="opp-id">{getOpportunityNumber(opp)} · #{id}</div>
            </td>
            <td>{opp.agency || opp.agencyCode || '--'}</td>
            <td>
              {#if opp.awardCeiling}
                {formatCurrency(opp.awardFloor)} - {formatCurrency(opp.awardCeiling)}
              {:else}
                --
              {/if}
            </td>
            <td>
              <DeadlineChip deadline={getDeadline(opp)} />
            </td>
            <td class="actions-cell">
              <button class="btn btn-sm btn-primary" onclick={() => evaluateOpportunity(opp)}>
                Evaluate
              </button>
              <button class="btn btn-sm btn-primary" onclick={() => addToPipeline(opp)}>
                {addingIds.has(id) ? 'Added' : '+ Pipeline'}
              </button>
              <button class="btn btn-sm btn-secondary" disabled={loadingDetailIds.has(id)} onclick={() => viewDetails(opp)}>
                {loadingDetailIds.has(id) ? 'Loading...' : 'Details'}
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else if !loading && keyword}
  <div class="card" style="margin-top:1rem">
    <div class="empty-state">
      <h3>No results found</h3>
      <p>Try different keywords or broaden your filters.</p>
    </div>
  </div>
{/if}

<!-- Detail Modal -->
{#if detailModal}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" role="dialog" aria-modal="true" onclick={() => detailModal = null}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-card" role="document" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>{detailTitle}</h2>
        <button class="btn btn-sm btn-secondary" onclick={() => detailModal = null}>Close</button>
      </div>
      <div class="modal-body">
        <section class="detail-summary">
          <div>
            <span>Opportunity #</span>
            <strong>{detail.opportunityNumber || detailSynopsis.opportunityNumber || '--'}</strong>
          </div>
          <div>
            <span>Agency</span>
            <strong>{detailSynopsis.agencyName || detail.owningAgencyCode || '--'}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{detail.ost || detailSynopsis.oppStatus || 'Posted'}</strong>
          </div>
          <div>
            <span>Deadline</span>
            <strong>{detailSynopsis.responseDate || detailSynopsis.responseDateDesc || '--'}</strong>
          </div>
        </section>

        <section class="detail-section">
          <h3>Funding</h3>
          <dl>
            <div><dt>Award floor</dt><dd>{formatCurrency(detailSynopsis.awardFloor)}</dd></div>
            <div><dt>Award ceiling</dt><dd>{formatCurrency(detailSynopsis.awardCeiling)}</dd></div>
            <div><dt>Estimated funding</dt><dd>{formatCurrency(detailSynopsis.estimatedFunding)}</dd></div>
            <div><dt>Expected awards</dt><dd>{detailSynopsis.numberOfAwards || '--'}</dd></div>
            <div><dt>Cost sharing</dt><dd>{detailSynopsis.costSharing === true ? 'Required' : detailSynopsis.costSharing === false ? 'Not required' : '--'}</dd></div>
          </dl>
        </section>

        <section class="detail-section">
          <h3>Eligibility</h3>
          <p class="detail-text">{stripHtml(detailSynopsis.applicantEligibilityDesc) || asList(detailSynopsis.applicantTypes) || '--'}</p>
        </section>

        <section class="detail-section">
          <h3>Description</h3>
          <p class="detail-text">{stripHtml(detailSynopsis.synopsisDesc) || '--'}</p>
        </section>

        <section class="detail-section">
          <h3>Program Details</h3>
          <dl>
            <div><dt>Funding instruments</dt><dd>{asList(detailSynopsis.fundingInstruments) || '--'}</dd></div>
            <div><dt>Categories</dt><dd>{asList(detailSynopsis.fundingActivityCategories) || '--'}</dd></div>
            <div><dt>Assistance listings</dt><dd>{(detail.cfdas || []).map(c => [c.cfdaNumber, c.programTitle].filter(Boolean).join(' - ')).filter(Boolean).join(', ') || '--'}</dd></div>
            <div><dt>Posted</dt><dd>{detailSynopsis.postingDate || '--'}</dd></div>
            <div><dt>Archive date</dt><dd>{detailSynopsis.archiveDate || '--'}</dd></div>
          </dl>
        </section>

        <section class="detail-section">
          <h3>Contact</h3>
          <dl>
            <div><dt>Name</dt><dd>{detailSynopsis.agencyContactName || '--'}</dd></div>
            <div><dt>Email</dt><dd>{detailSynopsis.agencyContactEmail || '--'}</dd></div>
            <div><dt>Phone</dt><dd>{detailSynopsis.agencyContactPhone || '--'}</dd></div>
          </dl>
        </section>

        {#if detailSynopsis.fundingDescLinkUrl || detail.opportunityPkgs?.length || detail.synopsisAttachmentFolders?.length}
          <section class="detail-section">
            <h3>Links</h3>
            <div class="detail-links">
              {#if detailSynopsis.fundingDescLinkUrl}
                <a href={detailSynopsis.fundingDescLinkUrl} target="_blank" rel="noreferrer">{detailSynopsis.fundingDescLinkDesc || 'Funding announcement'}</a>
              {/if}
              {#each detail.opportunityPkgs || [] as pkg}
                <a href="https://www.grants.gov/search-results-detail/{detail.id}" target="_blank" rel="noreferrer">
                  Application package {pkg.packageId || pkg.opportunityNumber || ''}
                </a>
              {/each}
              <a href="https://www.grants.gov/search-results-detail/{detail.id}" target="_blank" rel="noreferrer">Open on Grants.gov</a>
            </div>
          </section>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .search-form form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .search-row {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
  }

  .search-field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .search-field label {
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .search-field input, .search-field select {
    width: 100%;
  }

  .search-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-top: 0.75rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .filter-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-weight: 500;
    color: var(--text);
  }

  .filter-toggle input {
    width: auto;
  }

  .results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .pagination {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
  }

  .title-cell {
    max-width: 400px;
  }

  .opp-title {
    font-weight: 500;
    line-height: 1.3;
  }

  .opp-id {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-family: var(--font-mono);
  }

  .actions-cell {
    display: flex;
    gap: 0.375rem;
    white-space: nowrap;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 2rem;
  }

  .modal-card {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    max-width: 980px;
    width: 100%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-lg);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border);
  }

  .modal-header h2 {
    font-size: 1.125rem;
    flex: 1;
    margin-right: 1rem;
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
  }

  .detail-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }

  .detail-summary div,
  .detail-section {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem;
  }

  .detail-summary span {
    display: block;
    color: var(--text-secondary);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    margin-bottom: 0.35rem;
  }

  .detail-summary strong {
    font-size: 0.9rem;
  }

  .detail-section {
    margin-top: 1rem;
  }

  .detail-section h3 {
    font-size: 1rem;
    margin-bottom: 0.75rem;
  }

  .detail-section dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem 1rem;
  }

  .detail-section dl div {
    min-width: 0;
  }

  .detail-section dt {
    color: var(--text-secondary);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .detail-section dd {
    margin-top: 0.2rem;
    overflow-wrap: anywhere;
  }

  .detail-text {
    white-space: pre-wrap;
    color: var(--text);
    font-size: 0.9rem;
    line-height: 1.55;
    max-height: 20rem;
    overflow: auto;
  }

  .detail-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .detail-links a {
    display: inline-flex;
    padding: 0.45rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    font-size: 0.85rem;
  }

  @media (max-width: 768px) {
    .search-row {
      flex-direction: column;
    }

    .detail-summary,
    .detail-section dl {
      grid-template-columns: 1fr;
    }
  }
</style>
