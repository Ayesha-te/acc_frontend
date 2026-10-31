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
