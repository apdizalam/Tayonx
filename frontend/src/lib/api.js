export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// When the backend is briefly down (e.g. nodemon restarting it after a save), the dev proxy
// answers 503 and direct requests fail with a network error. Read-only GET requests are
// retried a few times (~4 s in total) so a page loaded during a restart still works.
// Requests that change data (POST/PUT/PATCH/DELETE) are never retried.
const RESTART_RETRY_DELAYS = [400, 800, 1200, 1600];
const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason || new DOMException('Aborted', 'AbortError')); }, { once: true });
});

async function fetchWithRestartRetry(url, init) {
  const canRetry = !init.method || init.method.toUpperCase() === 'GET';
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(url, init);
      const restarting = [502, 503, 504].includes(response.status);
      if (!canRetry || !restarting || attempt >= RESTART_RETRY_DELAYS.length) return response;
    } catch (error) {
      if (error.name === 'AbortError' || !canRetry || attempt >= RESTART_RETRY_DELAYS.length) throw error;
    }
    await sleep(RESTART_RETRY_DELAYS[attempt], init.signal);
  }
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = localStorage.getItem('token');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let body = options.body;
  if (body !== undefined && !(body instanceof FormData) && typeof body !== 'string') {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }

  const response = await fetchWithRestartRetry(`${API_BASE_URL}${path}`, { ...options, headers, body });
  if (response.status === 204) return null;

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    // A 404 with no JSON message means the running server has no such route (an outdated backend).
    const missingRoute = response.status === 404 && !result.error && !result.message;
    const fallback = missingRoute
      ? 'This action is not available on the server yet. Restart the backend so it loads the latest update, then try again.'
      : 'The request could not be completed.';
    const error = new Error(result.error || result.message || fallback);
    error.status = response.status;
    error.missingRoute = missingRoute;
    if (typeof result.field === 'string') error.field = result.field;
    throw error;
  }
  return result;
}

export function getRequests(scope, options) {
  const query = scope ? `?scope=${encodeURIComponent(scope)}` : '';
  return apiRequest(`/api/requests${query}`, options);
}

// Verified cargo companies / providers (public profile fields only — no verification documents).
export function getProviders(options) {
  return apiRequest('/api/providers', options);
}

export function getProvider(id, options) {
  return apiRequest(`/api/providers/${encodeURIComponent(id)}`, options);
}

export function createRequest(values) {
  return apiRequest('/api/requests', { method: 'POST', body: values });
}

export function updateRequest(id, values) {
  return apiRequest(`/api/requests/${encodeURIComponent(id)}`, { method: 'PUT', body: values });
}

export function deleteRequest(id) {
  return apiRequest(`/api/requests/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function updateShipmentStatus(id, status) {
  return apiRequest(`/api/requests/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } });
}

export function declineRequest(id) {
  return apiRequest(`/api/requests/${encodeURIComponent(id)}/decline`, { method: 'POST' });
}

export function getOffers(options) {
  return apiRequest('/api/requests/offers', options);
}

export function createOffer(requestId, values) {
  return apiRequest(`/api/requests/${encodeURIComponent(requestId)}/offers`, { method: 'POST', body: values });
}

export function updateOffer(id, values) {
  return apiRequest(`/api/requests/offers/${encodeURIComponent(id)}`, { method: 'PUT', body: values });
}

export function deleteOffer(id) {
  return apiRequest(`/api/requests/offers/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function respondToOffer(id, status) {
  return apiRequest(`/api/requests/offers/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } });
}

export function getUsers(options) {
  return apiRequest('/api/users', options);
}

export function getUserDetails(id, options) {
  return apiRequest(`/api/users/${encodeURIComponent(id)}`, options);
}

export function createUser(values) {
  return apiRequest('/api/users', { method: 'POST', body: values });
}

export function updateUser(id, values) {
  return apiRequest(`/api/users/${encodeURIComponent(id)}`, { method: 'PUT', body: values });
}

export function deleteUser(id) {
  return apiRequest(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// `include` re-opens a closed thread the user is navigating to (e.g. an offer's Chat button).
export function getChatContacts(options = {}) {
  const { include, ...rest } = options;
  return apiRequest(`/api/chats/contacts${include ? `?include=${encodeURIComponent(include)}` : ''}`, rest);
}

/** Close (hide) a chat thread for the current user until a new message arrives or it is reopened. */
export function closeChat(userId) {
  return apiRequest(`/api/chats/${encodeURIComponent(userId)}/close`, { method: 'POST' });
}

/** Delete the conversation history for the current user only (the other side keeps theirs). */
export function deleteChat(userId) {
  return apiRequest(`/api/chats/${encodeURIComponent(userId)}`, { method: 'DELETE' });
}

export function getChatHistory(userId, options) {
  return apiRequest(`/api/chats/${encodeURIComponent(userId)}`, options);
}

export function reportChat(userId, values) {
  return apiRequest(`/api/chats/${encodeURIComponent(userId)}/report`, { method: 'POST', body: values });
}

export function getAdminChats(options) {
  return apiRequest('/api/admin/chats', options);
}

export function getAdminConversation(firstUserId, secondUserId, options) {
  return apiRequest(`/api/admin/chats/conversations/${encodeURIComponent(firstUserId)}/${encodeURIComponent(secondUserId)}`, options);
}

export function updateChatReport(reportId, values) {
  return apiRequest(`/api/admin/chats/reports/${encodeURIComponent(reportId)}`, { method: 'PATCH', body: values });
}

export function getAdminSettings(options) {
  return apiRequest('/api/admin/settings', options);
}

export function updateAdminSettings(values) {
  return apiRequest('/api/admin/settings', { method: 'PUT', body: values });
}

export function getMyVerification(options) {
  return apiRequest('/api/verification/me', options);
}

export function submitVerification(formData) {
  return apiRequest('/api/verification', { method: 'POST', body: formData });
}

export function getVerificationRequests(status = 'all', options) {
  return apiRequest(`/api/verification/requests?status=${encodeURIComponent(status)}`, options);
}

export function reviewVerification(id, decision, note = '') {
  return apiRequest(`/api/verification/requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: { decision, note } });
}

// Uploaded files need the bearer token, so load them as a blob and return an object URL.
// The caller must URL.revokeObjectURL() it when done.
export async function loadFileUrl(fileId, options = {}) {
  const headers = new Headers();
  const token = localStorage.getItem('token');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetchWithRestartRetry(`${API_BASE_URL}/api/files/${encodeURIComponent(fileId)}`, { ...options, headers });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    const error = new Error(result.error || 'The file could not be loaded.');
    error.status = response.status;
    throw error;
  }
  return URL.createObjectURL(await response.blob());
}
