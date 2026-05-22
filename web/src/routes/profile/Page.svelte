<script>
  import { api } from '../../lib/api.js';
  import { profile, toast, ENTITY_TYPES, FUNDING_CATEGORIES } from '../../lib/stores.js';

  let activeTab = $state('org');
  let saving = $state(false);
  let isNew = $state(false);
  let hydratedProfileId = $state('');

  function defaultForm() {
    return {
      legal_name: '',
      ein: '',
      uei: '',
      entity_type: 'nonprofit_501c3',
      address: { street: '', city: '', state: '', zip: '', country: 'USA' },
      founded_year: null,
      staff_size: 0,
      annual_budget: 0,
      sam_registration: { status: 'not_registered', expiration_date: '' },
      contacts: {
        authorized_representative: { name: '', title: '', email: '', phone: '' },
        e_business_poc: { name: '', email: '' },
        grants_manager: { name: '', email: '' },
      },
      target_grants: { focus_areas: [], eligible_categories: [], preferred_agencies: [] },
      compliance: {
        indirect_cost_rate: { type: 'de_minimis_10', rate: 10 },
        single_audit: { status: 'not_applicable' },
      },
      budget_defaults: { escalation_rate: 3, equipment_threshold: 5000, fringe_rate: 30, travel_per_diem: { domestic: 200, lodging: 150 } },
      narrative: { mission: '', differentiator: '' },
      profile_md: '',
    };
  }

  function normalizeForm(data = {}) {
    const defaults = defaultForm();
    return {
      ...defaults,
      ...data,
      address: { ...defaults.address, ...(data.address || {}) },
      sam_registration: { ...defaults.sam_registration, ...(data.sam_registration || {}) },
      contacts: {
        authorized_representative: { ...defaults.contacts.authorized_representative, ...(data.contacts?.authorized_representative || {}) },
        e_business_poc: { ...defaults.contacts.e_business_poc, ...(data.contacts?.e_business_poc || {}) },
        grants_manager: { ...defaults.contacts.grants_manager, ...(data.contacts?.grants_manager || {}) },
      },
      target_grants: { ...defaults.target_grants, ...(data.target_grants || {}) },
      compliance: {
        indirect_cost_rate: { ...defaults.compliance.indirect_cost_rate, ...(data.compliance?.indirect_cost_rate || {}) },
        single_audit: { ...defaults.compliance.single_audit, ...(data.compliance?.single_audit || {}) },
      },
      budget_defaults: {
        ...defaults.budget_defaults,
        ...(data.budget_defaults || {}),
        travel_per_diem: { ...defaults.budget_defaults.travel_per_diem, ...(data.budget_defaults?.travel_per_diem || {}) },
      },
      narrative: { ...defaults.narrative, ...(data.narrative || {}) },
    };
  }

  // Form state — populated once per loaded profile
  let form = $state(defaultForm());

  let focusAreasText = $state('');

  $effect(() => {
    const loadedProfile = $profile;
    const profileKey = loadedProfile?.id || 'new';
    if (hydratedProfileId === profileKey) return;

    hydratedProfileId = profileKey;
    if (loadedProfile) {
      form = normalizeForm(loadedProfile);
      focusAreasText = (loadedProfile.target_grants?.focus_areas || []).join('\n');
      isNew = false;
    } else {
      form = defaultForm();
      focusAreasText = '';
      isNew = true;
    }
  });

  const tabs = [
    { id: 'org', label: 'Organization' },
    { id: 'sam', label: 'SAM / Compliance' },
    { id: 'contacts', label: 'Contacts' },
    { id: 'grants', label: 'Target Grants' },
    { id: 'budget', label: 'Budget Defaults' },
    { id: 'narrative', label: 'Narrative' },
    { id: 'dealbreakers', label: 'Deal-Breakers' },
  ];

  async function save() {
    saving = true;
    try {
      const payload = normalizeForm({
        ...form,
        target_grants: {
          ...form.target_grants,
          focus_areas: focusAreasText.split('\n').map(s => s.trim()).filter(Boolean),
        },
      });

      if (!$profile?.id) {
        const data = await api.createProfile(payload);
        profile.set(data);
        hydratedProfileId = data?.id || 'new';
        isNew = false;
      } else {
        const data = await api.updateProfile(payload);
        profile.set(data);
        hydratedProfileId = data?.id || hydratedProfileId;
      }
      toast('Profile saved', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      saving = false;
    }
  }

  function toggleCategory(code, name) {
    const cats = form.target_grants.eligible_categories || [];
    const idx = cats.findIndex(c => c.code === code);
    if (idx >= 0) {
      cats.splice(idx, 1);
    } else {
      cats.push({ code, name });
    }
    form.target_grants.eligible_categories = [...cats];
  }

  function hasCategory(code) {
    return (form.target_grants.eligible_categories || []).some(c => c.code === code);
  }

  function useApplicationReadyDefaults() {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    form.ein = form.ein || '12-3456789';
    form.uei = form.uei || 'PRETENDUEI12';
    form.sam_registration = {
      ...form.sam_registration,
      status: 'active',
      expiration_date: nextYear.toISOString().slice(0, 10),
      uei: form.uei || 'PRETENDUEI12',
    };
    toast('SAM.gov, EIN, and UEI set to application-ready placeholders', 'info');
  }
</script>

<div class="page-header">
  <h1>{isNew ? 'Set Up Your Organization' : 'Organization Profile'}</h1>
  <p>{isNew ? 'Tell us about your organization to get started' : 'Manage your organization details and grant preferences'}</p>
</div>

<!-- Tabs -->
<div class="tabs">
  {#each tabs as tab}
    <button
      class="tab"
      class:active={activeTab === tab.id}
      onclick={() => activeTab = tab.id}
    >{tab.label}</button>
  {/each}
</div>

<div class="card" style="margin-top:1rem">
  <!-- Organization -->
  {#if activeTab === 'org'}
    <div class="form-grid">
      <div class="form-group full">
        <label>Legal Name *</label>
        <input type="text" bind:value={form.legal_name} required />
      </div>
      <div class="form-group">
        <label>EIN</label>
        <input type="text" bind:value={form.ein} placeholder="XX-XXXXXXX" />
      </div>
      <div class="form-group">
        <label>UEI</label>
        <input type="text" bind:value={form.uei} placeholder="12 characters" maxlength="12" />
      </div>
      <div class="form-group">
        <label>Entity Type *</label>
        <select bind:value={form.entity_type}>
          {#each ENTITY_TYPES as t}
            <option value={t.value}>{t.label}</option>
          {/each}
        </select>
      </div>
      <div class="form-group">
        <label>Founded Year</label>
        <input type="number" bind:value={form.founded_year} />
      </div>
      <div class="form-group">
        <label>Staff Size</label>
        <input type="number" bind:value={form.staff_size} />
      </div>
      <div class="form-group">
        <label>Annual Budget ($)</label>
        <input type="number" bind:value={form.annual_budget} />
      </div>
      <div class="form-group full">
        <label>Street Address</label>
        <input type="text" bind:value={form.address.street} />
      </div>
      <div class="form-group">
        <label>City</label>
        <input type="text" bind:value={form.address.city} />
      </div>
      <div class="form-group">
        <label>State</label>
        <input type="text" bind:value={form.address.state} maxlength="2" />
      </div>
      <div class="form-group">
        <label>ZIP</label>
        <input type="text" bind:value={form.address.zip} />
      </div>
    </div>

  <!-- SAM / Compliance -->
  {:else if activeTab === 'sam'}
    <div class="inline-action">
      <button class="btn btn-secondary" onclick={useApplicationReadyDefaults}>
        Use application-ready placeholders
      </button>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label>SAM.gov Status</label>
        <select bind:value={form.sam_registration.status}>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="expired">Expired</option>
          <option value="not_registered">Not Registered</option>
        </select>
      </div>
      <div class="form-group">
        <label>SAM Expiration Date</label>
        <input type="date" bind:value={form.sam_registration.expiration_date} />
      </div>
      <div class="form-group">
        <label>Indirect Cost Rate Type</label>
        <select bind:value={form.compliance.indirect_cost_rate.type}>
          <option value="de_minimis_10">De minimis (10%)</option>
          <option value="negotiated">Negotiated</option>
          <option value="none">None</option>
        </select>
      </div>
      <div class="form-group">
        <label>Rate (%)</label>
        <input type="number" bind:value={form.compliance.indirect_cost_rate.rate} />
      </div>
      <div class="form-group">
        <label>Single Audit Status</label>
        <select bind:value={form.compliance.single_audit.status}>
          <option value="compliant">Compliant</option>
          <option value="needed">Needed</option>
          <option value="not_applicable">Not Applicable</option>
        </select>
      </div>
    </div>

  <!-- Contacts -->
  {:else if activeTab === 'contacts'}
    <h3 class="subsection">Authorized Representative</h3>
    <div class="form-grid">
      <div class="form-group"><label>Name</label><input type="text" bind:value={form.contacts.authorized_representative.name} /></div>
      <div class="form-group"><label>Title</label><input type="text" bind:value={form.contacts.authorized_representative.title} /></div>
      <div class="form-group"><label>Email</label><input type="email" bind:value={form.contacts.authorized_representative.email} /></div>
      <div class="form-group"><label>Phone</label><input type="tel" bind:value={form.contacts.authorized_representative.phone} /></div>
    </div>
    <h3 class="subsection">E-Business POC</h3>
    <div class="form-grid">
      <div class="form-group"><label>Name</label><input type="text" bind:value={form.contacts.e_business_poc.name} /></div>
      <div class="form-group"><label>Email</label><input type="email" bind:value={form.contacts.e_business_poc.email} /></div>
    </div>
    <h3 class="subsection">Grants Manager</h3>
    <div class="form-grid">
      <div class="form-group"><label>Name</label><input type="text" bind:value={form.contacts.grants_manager.name} /></div>
      <div class="form-group"><label>Email</label><input type="email" bind:value={form.contacts.grants_manager.email} /></div>
    </div>

  <!-- Target Grants -->
  {:else if activeTab === 'grants'}
    <div class="form-grid">
      <div class="form-group full">
        <label>Focus Areas (one per line)</label>
        <textarea rows="5" bind:value={focusAreasText} placeholder="youth financial literacy&#10;AI education&#10;small business development"></textarea>
      </div>
      <div class="form-group full">
        <label>Eligible Categories</label>
        <div class="category-grid">
          {#each FUNDING_CATEGORIES as cat}
            <label class="checkbox-label">
              <input type="checkbox" checked={hasCategory(cat.code)} onchange={() => toggleCategory(cat.code, cat.name)} />
              <span>{cat.code} - {cat.name}</span>
            </label>
          {/each}
        </div>
      </div>
    </div>

  <!-- Budget Defaults -->
  {:else if activeTab === 'budget'}
    <div class="form-grid">
      <div class="form-group">
        <label>Escalation Rate (%)</label>
        <input type="number" bind:value={form.budget_defaults.escalation_rate} />
      </div>
      <div class="form-group">
        <label>Equipment Threshold ($)</label>
        <input type="number" bind:value={form.budget_defaults.equipment_threshold} />
      </div>
      <div class="form-group">
        <label>Fringe Rate (%)</label>
        <input type="number" bind:value={form.budget_defaults.fringe_rate} />
      </div>
      <div class="form-group">
        <label>Domestic Per Diem ($/day)</label>
        <input type="number" bind:value={form.budget_defaults.travel_per_diem.domestic} />
      </div>
      <div class="form-group">
        <label>Lodging ($/night)</label>
        <input type="number" bind:value={form.budget_defaults.travel_per_diem.lodging} />
      </div>
    </div>

  <!-- Narrative -->
  {:else if activeTab === 'narrative'}
    <div class="form-grid">
      <div class="form-group full">
        <label>Mission Statement</label>
        <textarea rows="4" bind:value={form.narrative.mission} placeholder="Your organization's mission in ~100 words..."></textarea>
      </div>
      <div class="form-group full">
        <label>Differentiator</label>
        <textarea rows="3" bind:value={form.narrative.differentiator} placeholder="What makes your organization unique? 2-3 sentences..."></textarea>
      </div>
    </div>

  <!-- Deal-Breakers -->
  {:else if activeTab === 'dealbreakers'}
    <div class="form-group full">
      <label>Custom Profile & Deal-Breakers (Markdown)</label>
      <p class="form-help">Define adaptive framing, deal-breakers, boilerplate sections. This is your _profile.md equivalent.</p>
      <textarea rows="12" bind:value={form.profile_md} placeholder="## Deal-Breakers&#10;- No cost share above 25%&#10;- No grants under $50K&#10;&#10;## Geographic Focus&#10;Kentucky statewide, Appalachian ARC counties..."></textarea>
    </div>
  {/if}

  <!-- Save Button -->
  <div class="form-actions">
    <button class="btn btn-primary" onclick={save} disabled={saving}>
      {#if saving}<span class="spinner"></span>{:else}{isNew ? 'Create Profile' : 'Save Changes'}{/if}
    </button>
  </div>
</div>

<style>
  .tabs {
    display: flex;
    gap: 0.25rem;
    overflow-x: auto;
    border-bottom: 2px solid var(--border);
    padding-bottom: 0;
  }

  .tab {
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-secondary);
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    white-space: nowrap;
    transition: all 0.15s;
  }

  .tab:hover {
    color: var(--text);
  }

  .tab.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
  }

  .inline-action {
    display: flex;
    justify-content: flex-start;
    margin-bottom: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .form-group.full {
    grid-column: 1 / -1;
  }

  .form-group label {
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .form-help {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  textarea {
    font-family: var(--font);
    font-size: 0.875rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.5rem 0.75rem;
    resize: vertical;
    background: var(--bg-card);
    color: var(--text);
    outline: none;
    width: 100%;
  }

  textarea:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .subsection {
    font-size: 0.9375rem;
    font-weight: 600;
    margin: 1.5rem 0 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-light);
  }

  .subsection:first-child {
    margin-top: 0;
    padding-top: 0;
    border-top: none;
  }

  .category-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.375rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: var(--radius-sm);
  }

  .checkbox-label:hover {
    background: var(--bg);
  }

  .form-actions {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-light);
  }
</style>
