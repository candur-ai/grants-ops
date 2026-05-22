const GRANTS_API_BASE = 'https://api.grants.gov/v1/api';

export async function searchGrants(params) {
  const body = {
    keyword: params.keyword || '',
    oppStatuses: 'posted',
    rows: params.rows || 25,
    startRecord: params.startRecord || 1,
  };

  if (params.agencies) body.agencies = params.agencies;
  if (params.eligibilities) body.eligibilities = params.eligibilities;
  if (params.fundingCategories) body.fundingCategories = params.fundingCategories;

  const res = await fetch(`${GRANTS_API_BASE}/search2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Grants.gov API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export async function fetchOpportunity(opportunityId) {
  const res = await fetch(`${GRANTS_API_BASE}/fetchOpportunity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ opportunityId: String(opportunityId) }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Grants.gov API error: ${res.status} ${res.statusText}`);
  }

  const result = await res.json();
  if (result?.errorcode && result.errorcode !== 0) {
    throw new Error(result.msg || `Grants.gov API error code ${result.errorcode}`);
  }
  if (result?.data?.message && !result?.data?.id && !result?.data?.synopsis) {
    throw new Error(result.data.message);
  }
  return result;
}

// Entity type to Grants.gov eligibility code
export const ENTITY_ELIGIBILITY_MAP = {
  nonprofit_501c3: '12',
  nonprofit_non501c3: '13',
  state_govt: '00',
  county_govt: '01',
  city_govt: '02',
  special_district: '04',
  independent_school: '05',
  higher_ed: '06',
  tribal: '07',
  for_profit: '22',
  small_business: '23',
  individual: '21',
  other: '25',
};
