import { api, apiDownload, apiUpload, Page } from './client'

export type Org = { id: number; name: string; role: string; base_currency: string; books_locked_through: string | null }
export type Party = { id: number; name: string; kind: string }
export type Account = { id: number; code: string; name: string; type: string; system_code?: string | null; is_cash_bank: boolean }
export type FiscalClose = { id: number; year_start: string; year_end: string; net_profit: string; previous_lock: string | null; closed_by_name: string | null; created_at: string }

export const auth = {
  login: (username: string, password: string) => api<{ token: string }>('/auth/login/', { method: 'POST', body: { username, password } }),
  logout: () => api('/auth/logout/', { method: 'POST' }),
}
export const orgs = {
  list: () => api<Page<Org>>('/organizations/'),
  create: (name: string, base_currency: string) => api<Org>('/organizations/', { method: 'POST', body: { name, base_currency } }),
  /** Owner/admin only (enforced by the API). `null` reopens all periods. */
  fiscalYears: (id: number) => api<{ fiscal_year_start_month: number; next_year_end: string | null; closes: FiscalClose[] }>(`/organizations/${id}/fiscal-years/`),
  closeYear: (id: number, year_end: string) => api<FiscalClose>(`/organizations/${id}/close-year/`, { method: 'POST', body: { year_end } }),
  setLock: (id: number, books_locked_through: string | null) => api<Org>(`/organizations/${id}/`, { method: 'PATCH', body: { books_locked_through } }),
}
export const parties = {
  list: (query?: Record<string, string>) => api<Page<Party>>('/parties/', { query: { page_size: 200, ...query } }),
  create: (body: Partial<Party>) => api<Party>('/parties/', { method: 'POST', body }),
}
export const accounts = { list: () => api<Account[]>('/accounts/') }

/** Generic list/create/void for a document register. Each module passes its own path. */
export type BankSummary = {
  line_count: number; matched_lines: number; partial_lines: number; unmatched_lines: number; stale_matches: number
  statement_net: string; matched_net: string; difference: string; can_complete: boolean
  book_balance_at_period_end: string; uncleared_book_items: number; uncleared_book_net: string
}
export type BankStatement = {
  id: number; account: number; account_name: string; file_name: string; period_start: string; period_end: string
  opening_balance: string; closing_balance: string; status: 'in_progress' | 'reconciled'; reconciled_by_name: string | null
  line_count?: number; summary?: BankSummary; skipped_duplicates?: number; warnings?: string[]
}
export type BankMatch = { id: number; journal_line: number; amount: string; reference: string; ledger_date: string; source_type: string; method: string; stale: boolean }
export type BankLine = { id: number; row: number; date: string; description: string; reference: string; amount: string; matched_amount: string; status: 'matched' | 'partial' | 'unmatched'; matches: BankMatch[] }
export type BankCandidate = { journal_line: number; date: string; reference: string; narration: string; source_type: string; party: string | null; amount: string; remaining: string; direction: 'in' | 'out'; exact: boolean }
export const banking = {
  list: () => api<Page<BankStatement>>('/bank-statements/', { query: { page_size: 100 } }),
  get: (id: number) => api<BankStatement>(`/bank-statements/${id}/`),
  lines: (id: number) => api<BankLine[]>(`/bank-statements/${id}/lines/`),
  candidates: (id: number, line: number, days = 30) => api<BankCandidate[]>(`/bank-statements/${id}/candidates/`, { query: { line, days } }),
  import: (file: File, fields: Record<string, string>) => apiUpload<BankStatement>('/bank-statements/import/', file, fields),
  match: (id: number, line: number, journal_line: number, amount?: string) => api<BankMatch>(`/bank-statements/${id}/match/`, { method: 'POST', body: { line, journal_line, amount } }),
  unmatch: (id: number, match: number) => api<{ removed: number }>(`/bank-statements/${id}/unmatch/`, { method: 'POST', body: { match } }),
  autoMatch: (id: number) => api<{ matched: number; ambiguous: number; no_candidate: number }>(`/bank-statements/${id}/auto-match/`, { method: 'POST', body: {} }),
  complete: (id: number) => api<BankStatement>(`/bank-statements/${id}/complete/`, { method: 'POST', body: {} }),
  reopen: (id: number) => api<BankStatement>(`/bank-statements/${id}/reopen/`, { method: 'POST', body: {} }),
  discard: (id: number) => api<void>(`/bank-statements/${id}/discard/`, { method: 'POST', body: {} }),
}

export const expenses = {
  uploadReceipt: (id: number, file: File) => apiUpload<any>(`/expenses/${id}/receipt/`, file),
  downloadReceipt: (id: number, number: string) => apiDownload(`/expenses/${id}/receipt/`, `${number}-receipt`),
}

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
