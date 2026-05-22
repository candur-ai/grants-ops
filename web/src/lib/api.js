import { supabase } from './supabase.js';

const BASE = '/api/v1';

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return {};
  return { 'Authorization': `Bearer ${session.access_token}` };
}

async function request(method, path, body = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...await getAuthHeaders()
  };

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function streamRequest(method, path, body, onChunk) {
  const headers = {
    'Content-Type': 'application/json',
    ...await getAuthHeaders()
  };

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        try {
          onChunk(JSON.parse(data));
        } catch {}
      }
    }
  }
}

export const api = {
  // Dashboard
  getDashboard: () => request('GET', '/dashboard'),

  // Profile
  getProfile: () => request('GET', '/profile'),
  updateProfile: (data) => request('PUT', '/profile', data),
  createProfile: (data) => request('POST', '/profile', data),

  // Applications
  getApplications: (params = '') => request('GET', `/applications${params ? '?' + params : ''}`),
  updateApplication: (id, data) => request('PUT', `/applications/${id}`, data),

  // Pipeline
  getPipeline: () => request('GET', '/pipeline'),
  addToPipeline: (data) => request('POST', '/pipeline', data),
  updatePipelineItem: (id, data) => request('PUT', `/pipeline/${id}`, data),
  removePipelineItem: (id) => request('DELETE', `/pipeline/${id}`),

  // Grants.gov search
  searchGrants: (body) => request('POST', '/grants/search', body),
  getGrant: (opportunityId) => request('GET', `/grants/${opportunityId}`),

  // Reports
  getReports: () => request('GET', '/reports'),
  getReport: (id) => request('GET', `/reports/${id}`),
  deleteReport: (id) => request('DELETE', `/reports/${id}`),

  // Evaluation (streaming)
  evaluate: (body, onChunk) => streamRequest('POST', '/evaluate', body, onChunk),

  // Narrative (streaming)
  generateNarrative: (body, onChunk) => (
    typeof onChunk === 'function'
      ? streamRequest('POST', '/narrative', body, onChunk)
      : request('POST', '/narrative', body)
  ),

  // Budget
  buildBudget: (body) => request('POST', '/budget', body),

  // Application packets
  saveApplicationPacket: (body) => request('POST', '/application-packets', body),

  // States
  getStates: () => request('GET', '/states'),
};
