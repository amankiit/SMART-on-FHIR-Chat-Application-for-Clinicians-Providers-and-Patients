const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!res.ok) {
    let payload = null;
    try {
      payload = await res.json();
    } catch (e) {
      payload = { error: 'Request failed' };
    }
    const error = new Error(payload?.error || 'Request failed');
    error.payload = payload;
    throw error;
  }

  if (res.status === 204) return null;
  return res.json();
}

export { API_BASE, apiFetch };
