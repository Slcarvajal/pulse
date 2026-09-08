// API client — fetches /api/health and /api/live, with ?mock=1 short-circuit.
function isMock() {
  return new URLSearchParams(location.search).get('mock') === '1';
}

export async function getHealth({ refresh } = {}) {
  if (isMock()) {
    return (await import('./mock.json')).default;
  }
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

export async function getLive() {
  if (isMock()) {
    const { generatedAt, latestHr, hrDay } = (await import('./mock.json')).default;
    return { generatedAt, latestHr, hrDay };
  }
  const res = await fetch('/api/live');
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
