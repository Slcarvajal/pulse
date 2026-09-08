// API client — fetches /api/health, normalises 401 into a needsAuth shape.
export async function getHealth({ refresh } = {}) {
  const res = await fetch('/api/health' + (refresh ? '?refresh=1' : ''));
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) {
    return { needsAuth: true, authUrl: body.auth };
  }
  if (!res.ok) {
    const err = new Error(body.message || `Request failed with status ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return body;
}
