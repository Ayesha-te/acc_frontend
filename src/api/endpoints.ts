import { api, Page } from './client'

export type Org = { id: number; name: string; role: string; base_currency: string }
export type Party = { id: number; name: string; kind: string }
export type Account = { id: number; code: string; name: string; type: string; is_cash_bank: boolean }

export const auth = {
  login: (username: string, password: string) => api<{ token: string }>('/auth/login/', { method: 'POST', body: { username, password } }),
  logout: () => api('/auth/logout/', { method: 'POST' }),
}
export const orgs = {
  list: () => api<Page<Org>>('/organizations/'),
  create: (name: string, base_currency: string) => api<Org>('/organizations/', { method: 'POST', body: { name, base_currency } }),
}
export const parties = {
  list: (query?: Record<string, string>) => api<Page<Party>>('/parties/', { query: { page_size: 200, ...query } }),
  create: (body: Partial<Party>) => api<Party>('/parties/', { method: 'POST', body }),
}
export const accounts = { list: () => api<Account[]>('/accounts/') }

/** Generic list/create/void for a document register. Each module passes its own path. */
export const documents = (path: string) => ({
  list: (query: Record<string, string | number | undefined>) => api<Page<any>>(`/${path}/`, { query }),
  get: (id: number) => api<any>(`/${path}/${id}/`),
  create: (body: unknown) => api<any>(`/${path}/`, { method: 'POST', body }),
  void: (id: number) => api<any>(`/${path}/${id}/void/`, { method: 'POST' }),
})

/** Generic list/create/update for simple setup resources (items, vehicles, tax rates, branches...). */
export const resource = <T = any>(path: string) => ({
  list: (query?: Record<string, string | number | undefined>) => api<any>(`/${path}/`, { query: { page_size: 200, ...query } }).then((r) => (Array.isArray(r) ? r : r.results) as T[]),
  page: (query?: Record<string, string | number | undefined>) => api<Page<T>>(`/${path}/`, { query }),
  create: (body: unknown) => api<T>(`/${path}/`, { method: 'POST', body }),
  update: (id: number, body: unknown) => api<T>(`/${path}/${id}/`, { method: 'PATCH', body }),
  act: (id: number, action: string, body?: unknown) => api<any>(`/${path}/${id}/${action}/`, { method: 'POST', body }),
})

export const report = (name: string, query: Record<string, string | number | undefined>) => api<any>(`/reports/${name}/`, { query })
export type TaxRate = { id: number; name: string; rate: string; is_default: boolean; is_active: boolean }
export type Item = { id: number; sku: string; name: string; kind: 'raw_material' | 'finished_good'; unit: string; is_active: boolean }
export type Location = { id: number; name: string; kind: string; is_active: boolean }
