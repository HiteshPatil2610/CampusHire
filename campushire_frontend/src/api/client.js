/* ============================================================
   API client — production-ready fetch wrapper with Bearer token
   attachment and error handling.
   ============================================================ */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const AUTH_STORAGE_KEY = 'ch_auth_session_v1';

function getAuthToken() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.token || null;
    }
  } catch {
    return null;
  }
  return null;
}

async function request(path, { method = 'GET', body, headers = {}, ...rest } = {}) {
  const token = getAuthToken();
  const requestHeaders = { ...headers };

  // Only attach Content-Type: application/json if body is not FormData
  const isFormData = body instanceof FormData;
  if (!isFormData && !requestHeaders['Content-Type'] && body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  if (token && !requestHeaders['Authorization']) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: requestHeaders,
      body: isFormData ? body : (body !== undefined && typeof body === 'object' ? JSON.stringify(body) : body),
      ...rest,
    });
  } catch (netErr) {
    throw new Error(`Network error: Unable to reach backend API at ${BASE_URL}. (${netErr.message})`);
  }

  if (res.status === 401) {
    // Session expired or invalid
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('ch:unauthorized'));
  }

  if (!res.ok) {
    let errorDetail;
    try {
      const errorJson = await res.json();
      errorDetail = errorJson?.message || errorJson?.error || JSON.stringify(errorJson);
    } catch {
      errorDetail = await res.text().catch(() => res.statusText);
    }
    throw new Error(errorDetail || `Request failed with status ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';
  return contentType.includes('application/json') ? res.json() : res.text();
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
};
