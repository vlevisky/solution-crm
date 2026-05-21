import type { BootstrapData, User } from '../types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Erro ao processar solicitacao')
  return body as T
}

export const api = {
  me: () => request<{ user: User }>('/api/auth/me'),
  login: (payload: { email: string; password: string }) => request<{ user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  register: (payload: { name: string; email: string; password: string; title: string; specialty?: string; crm?: string; departmentId?: string }) => request<{ user: User }>('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  bootstrap: () => request<BootstrapData>('/api/bootstrap'),
  create: <T>(resource: string, payload: unknown) => request<T>(`/api/${resource}`, { method: 'POST', body: JSON.stringify(payload) }),
  update: <T>(resource: string, id: string, payload: unknown) => request<T>(`/api/${resource}/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  remove: (resource: string, id: string) => request<{ ok: boolean }>(`/api/${resource}/${id}`, { method: 'DELETE' }),
  moveCard: (id: string, payload: { stageId: string; position: number }) => request(`/api/cards/${id}/move`, { method: 'PUT', body: JSON.stringify(payload) }),
  duplicateFunnel: (id: string) => request(`/api/funnels/${id}/duplicate`, { method: 'POST' }),
  sendMessage: (payload: unknown) => request('/api/messages/send', { method: 'POST', body: JSON.stringify(payload) }),
  simulateCampaign: (id: string) => request(`/api/campaigns/${id}/simulate-send`, { method: 'POST' }),
  sendCampaignTest: (id: string, phone: string) => request(`/api/campaigns/${id}/send-test`, { method: 'POST', body: JSON.stringify({ phone }) }),
  updateSettings: <T>(payload: unknown) => request<T>('/api/settings', { method: 'PUT', body: JSON.stringify(payload) }),
}
