import { writable, derived } from 'svelte/store';
import { supabase } from './supabase.js';

// Auth
export const user = writable(null);
export const session = writable(null);
export const authLoading = writable(true);

// Org profile
export const profile = writable(null);
export const hasProfile = derived(profile, $p => $p !== null);

// App data
export const applications = writable([]);
export const pipelineItems = writable([]);
export const reports = writable([]);
export const states = writable([]);

// UI
export const currentRoute = writable('dashboard');
export const toasts = writable([]);

// Navigation
export function navigate(route) {
  window.location.hash = `#/${route}`;
}

// Toast helpers
let toastId = 0;
export function toast(message, type = 'info', duration = 3000) {
  const id = ++toastId;
  toasts.update(t => [...t, { id, message, type }]);
  setTimeout(() => {
    toasts.update(t => t.filter(item => item.id !== id));
  }, duration);
}

// Init auth listener
supabase.auth.getSession().then(({ data: { session: s } }) => {
  session.set(s);
  user.set(s?.user ?? null);
  authLoading.set(false);
});

supabase.auth.onAuthStateChange((_event, s) => {
  session.set(s);
  user.set(s?.user ?? null);
});

// Canonical states data (from templates/states.yml)
export const CANONICAL_STATES = [
  { id: 'discovered', label: 'Discovered', group: 'discovered', color: 'info' },
  { id: 'evaluated', label: 'Evaluated', group: 'evaluated', color: 'info' },
  { id: 'preparing', label: 'Preparing', group: 'preparing', color: 'warning' },
  { id: 'applied', label: 'Applied', group: 'applied', color: 'success' },
  { id: 'under_review', label: 'Under Review', group: 'under_review', color: 'warning' },
  { id: 'awarded', label: 'Awarded', group: 'awarded', color: 'success' },
  { id: 'not_funded', label: 'Not Funded', group: 'not_funded', color: 'danger' },
  { id: 'withdrawn', label: 'Withdrawn', group: 'withdrawn', color: 'neutral' },
  { id: 'skip', label: 'SKIP', group: 'skip', color: 'neutral' },
];

// Entity type options
export const ENTITY_TYPES = [
  { value: 'nonprofit_501c3', label: 'Nonprofit 501(c)(3)', code: '12' },
  { value: 'nonprofit_non501c3', label: 'Nonprofit (other)', code: '13' },
  { value: 'state_govt', label: 'State government', code: '00' },
  { value: 'county_govt', label: 'County government', code: '01' },
  { value: 'city_govt', label: 'City/township government', code: '02' },
  { value: 'special_district', label: 'Special district', code: '04' },
  { value: 'independent_school', label: 'Independent school district', code: '05' },
  { value: 'higher_ed', label: 'Public/state higher ed', code: '06' },
  { value: 'tribal', label: 'Native American tribal', code: '07' },
  { value: 'for_profit', label: 'For-profit', code: '22' },
  { value: 'small_business', label: 'Small business', code: '23' },
  { value: 'individual', label: 'Individual', code: '21' },
  { value: 'other', label: 'Other', code: '25' },
];

// Grants.gov funding categories
export const FUNDING_CATEGORIES = [
  { code: 'AG', name: 'Agriculture' },
  { code: 'AR', name: 'Arts' },
  { code: 'BC', name: 'Business and Commerce' },
  { code: 'CD', name: 'Community Development' },
  { code: 'CP', name: 'Consumer Protection' },
  { code: 'DPR', name: 'Disaster Prevention and Relief' },
  { code: 'ED', name: 'Education' },
  { code: 'ELT', name: 'Employment, Labor and Training' },
  { code: 'EN', name: 'Energy' },
  { code: 'ENV', name: 'Environment' },
  { code: 'FN', name: 'Food and Nutrition' },
  { code: 'HL', name: 'Health' },
  { code: 'HO', name: 'Housing' },
  { code: 'HU', name: 'Humanities' },
  { code: 'IS', name: 'Income Security and Social Services' },
  { code: 'ISS', name: 'Information and Statistics' },
  { code: 'LJL', name: 'Law, Justice and Legal Services' },
  { code: 'NR', name: 'Natural Resources' },
  { code: 'O', name: 'Other' },
  { code: 'RD', name: 'Regional Development' },
  { code: 'ST', name: 'Science and Technology' },
  { code: 'T', name: 'Transportation' },
];
