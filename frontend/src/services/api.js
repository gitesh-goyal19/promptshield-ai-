const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
let accessCode = "";

export function setAccessCode(code) {
  accessCode = code;
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (accessCode) {
    headers["X-App-Access-Code"] = accessCode;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  return res;
}

export async function getJSON(path) {
  const res = await request(path);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function postJSON(path, body) {
  const res = await request(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function patchJSON(path, body) {
  const res = await request(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function del(path) {
  const res = await request(path, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  health: () => getJSON("/health"),
  listProjects: () => getJSON("/projects"),
  createProject: (body) => postJSON("/projects", body),
  getProject: (id) => getJSON(`/projects/${id}`),
  updateProject: (id, body) => patchJSON(`/projects/${id}`, body),
  listPresets: () => getJSON("/presets"),
  getModels: () => getJSON("/models"),
  chat: (body) => postJSON("/playground/chat", body),
  listTests: (id) => getJSON(`/projects/${id}/tests`),
  generateTests: (id, body) => postJSON(`/projects/${id}/tests/generate`, body),
  updateTest: (id, body) => patchJSON(`/tests/${id}`, body),
  createRun: (id, body) => postJSON(`/projects/${id}/runs`, body),
  getRun: (id) => getJSON(`/runs/${id}`),
  cancelRun: (id) => postJSON(`/runs/${id}/cancel`, {}),
  getRunResults: (id) => getJSON(`/runs/${id}/results`),
  updateResultReview: (id, body) => patchJSON(`/results/${id}/review`, body),
  suggestPrompt: (id, body) => postJSON(`/projects/${id}/prompts/suggest`, body),
  getMetrics: (id) => getJSON(`/projects/${id}/metrics`),
  compareRuns: (id, runA, runB) => getJSON(`/projects/${id}/compare?run_a=${runA}&run_b=${runB}`),
};
