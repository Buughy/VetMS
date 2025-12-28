import type { Settings } from './types-extended';

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export const api = {
  dashboard: () => request('/api/dashboard'),
  stats: (params: { from: string; to: string }) =>
    request(`/api/stats?from=${encodeURIComponent(params.from)}&to=${encodeURIComponent(params.to)}`),
  recentInvoices: () => request('/api/invoices/recent'),
  allInvoices: () => request('/api/invoices'),
  getInvoice: (id: number) => request(`/api/invoices/${id}`),
  updateInvoice: (id: number, body: unknown) => request(`/api/invoices/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  products: (query?: string) =>
    request(`/api/products${query ? `?query=${encodeURIComponent(query)}` : ''}`),
  upsertProduct: (body: { name: string; price: number }) =>
    request('/api/products', { method: 'POST', body: JSON.stringify(body) }),
  updateProduct: (id: number, body: { name: string; price: number }) =>
    request(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteProduct: (id: number) => request(`/api/products/${id}`, { method: 'DELETE' }),
  importProductsCsv: (csv: string) =>
    request('/api/products/import-csv', { method: 'POST', body: JSON.stringify({ csv }) }),
  clients: (query?: string) =>
    request(`/api/clients${query && query.trim() ? `?query=${encodeURIComponent(query)}` : ''}`),
  createClient: (body: { name: string; contactInfo?: string }) =>
    request('/api/clients', { method: 'POST', body: JSON.stringify(body) }),
  updateClient: (id: number, body: { name: string; contactInfo?: string }) =>
    request(`/api/clients/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteClient: (id: number) => request(`/api/clients/${id}`, { method: 'DELETE' }),
  pets: (clientId: number) => request(`/api/pets?clientId=${clientId}`),
  createInvoice: (body: unknown) => request('/api/invoices', { method: 'POST', body: JSON.stringify(body) }),
  deleteInvoice: (id: number) => request(`/api/invoices/${id}`, { method: 'DELETE' }),
  getSettings: () => request<Settings>('/api/settings'),
  updateSetting: (key: string, value: string) => request(`/api/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),

  // Bank transactions
  transactions: (params?: { from?: string; to?: string; search?: string; type?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.from) searchParams.set('from', params.from);
    if (params?.to) searchParams.set('to', params.to);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.type) searchParams.set('type', params.type);
    const qs = searchParams.toString();
    return request(`/api/transactions${qs ? `?${qs}` : ''}`);
  },
  transactionStats: (params?: { from?: string; to?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.from) searchParams.set('from', params.from);
    if (params?.to) searchParams.set('to', params.to);
    const qs = searchParams.toString();
    return request(`/api/transactions/stats${qs ? `?${qs}` : ''}`);
  },
  uploadTransactions: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/api/transactions/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Upload failed: ${res.status}`);
    }
    return res.json();
  },
};
