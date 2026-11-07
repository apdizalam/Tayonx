export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = localStorage.getItem('token');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let body = options.body;
  if (body !== undefined && !(body instanceof FormData) && typeof body !== 'string') {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, body });
  if (response.status === 204) return null;

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || result.message || 'The request could not be completed.');
    error.status = response.status;
    throw error;
  }
  return result;
}

export function getRequests(scope, options) {
  const query = scope ? `?scope=${encodeURIComponent(scope)}` : '';
  return apiRequest(`/api/requests${query}`, options);
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

export function createUser(values) {
  return apiRequest('/api/users', { method: 'POST', body: values });
}

export function updateUser(id, values) {
  return apiRequest(`/api/users/${encodeURIComponent(id)}`, { method: 'PUT', body: values });
}

export function deleteUser(id) {
  return apiRequest(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function getChatContacts(options) {
  return apiRequest('/api/chats/contacts', options);
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