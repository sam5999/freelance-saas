export const API_URL = import.meta.env.VITE_API_URL;

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

export function listAgreements() {
  return request('/agreements');
}

export function createAgreement(payload) {
  return request('/agreements', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateAgreement(id, payload) {
  return request(`/agreements/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export function deleteAgreement(id) {
  return request(`/agreements/${id}`, { method: 'DELETE' });
}

export function sendAgreement(id) {
  return request(`/agreements/${id}/send`, { method: 'POST' });
}

export function getPublicAgreement(token) {
  return request(`/public/agreements/${token}`);
}

export function confirmPublicAgreement(token) {
  return request(`/public/agreements/${token}/confirm`, { method: 'POST' });
}

export function listInvoices() {
  return request('/invoices');
}

export function createInvoice(payload) {
  return request('/invoices', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateInvoice(id, payload) {
  return request(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export function deleteInvoice(id) {
  return request(`/invoices/${id}`, { method: 'DELETE' });
}

export function markInvoicePaid(id) {
  return request(`/invoices/${id}/mark-paid`, { method: 'POST' });
}

export function markInvoicePending(id) {
  return request(`/invoices/${id}/mark-pending`, { method: 'POST' });
}

export function invoicePdfUrl(id) {
  return `${API_URL}/invoices/${id}/pdf`;
}

export function getDashboardSummary() {
  return request('/dashboard/summary');
}
