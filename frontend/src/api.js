const API_URL = import.meta.env.VITE_API_URL;

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = res.status === 204 ? null : await res.json();

  if (!res.ok) {
    throw new Error(data?.message || 'Une erreur est survenue');
  }
  return data;
}

export function register({ email, password, fullName }) {
  return request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, fullName }) });
}

export function login({ email, password }) {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function logout() {
  return request('/auth/logout', { method: 'POST' });
}

export function fetchMe() {
  return request('/auth/me');
}

export function listClients() {
  return request('/clients');
}

export function createClient(payload) {
  return request('/clients', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateClient(id, payload) {
  return request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export function deleteClient(id) {
  return request(`/clients/${id}`, { method: 'DELETE' });
}
