import { api, apiDownload, apiOpenPdf, apiUpload, Page } from './client'

export type Org = { id: number; name: string; role: string; base_currency: string; books_locked_through: string | null; expense_approval_required?: boolean; bill_approval_required?: boolean; approval_min_amount?: string }
export type LockChange = { id: number; at: string; old_value: string | null; new_value: string | null; source: string; reason: string; by: string | null }
export type Party = { id: number; name: string; kind: string }
export type Account = { id: number; code: string; name: string; type: string; system_code?: string | null; is_cash_bank: boolean; is_active?: boolean; parent?: number | null; parent_name?: string | null }
export type FiscalClose = { id: number; year_start: string; year_end: string; net_profit: string; previous_lock: string | null; closed_by_name: string | null; created_at: string; reopened_at?: string | null; reopen_reason?: string }

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
  setLock: (id: number, books_locked_through: string | null, lock_change_reason?: string) => api<Org>(`/organizations/${id}/`, { method: 'PATCH', body: { books_locked_through, lock_change_reason } }),
  lockHistory: (id: number) => api<LockChange[]>(`/organizations/${id}/lock-history/`),
  reopenYear: (id: number, year_end: string, reason: string) => api<FiscalClose>(`/organizations/${id}/reopen-year/`, { method: 'POST', body: { year_end, reason } }),
  setApproval: (id: number, body: { expense_approval_required: boolean; bill_approval_required: boolean; approval_min_amount: string }) => api<Org>(`/organizations/${id}/`, { method: 'PATCH', body }),
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
  suggestions: (id: number) => api<BankSuggestion[]>(`/bank-statements/${id}/suggestions/`),
  createFromLine: (id: number, body: { line: number; category: number; tax_rate?: string; narration?: string }) =>
    api<{ document: string; match: number; amount: string }>(`/bank-statements/${id}/create-from-line/`, { method: 'POST', body }),
  reportCsv: (id: number) => apiDownload(`/bank-statements/${id}/report/?fmt=csv`, `reconciliation-${id}.csv`),
  reportPdf: (id: number) => apiOpenPdf(`/bank-statements/${id}/report/`, { fmt: 'pdf' }),
}
export interface BankSuggestion { line: number; date: string; description: string; amount: string; rule: number | null; rule_name: string | null; category: number | null; category_name: string | null; tax_rate: string }
export interface BankRuleRow { id: number; name: string; account: number | null; direction: string; contains: string; category: number; category_name: string; tax_rate: string; priority: number; is_active: boolean }

/** Approve / reject a pending expense or purchase bill. */
export const approvals = {
  approve: (path: string, id: number) => api<any>(`/${path}/${id}/approve/`, { method: 'POST', body: {} }),
  reject: (path: string, id: number, reason: string) => api<any>(`/${path}/${id}/reject/`, { method: 'POST', body: { reason } }),
}
export type Refund = { id: number; number: string; date: string; amount: string; status: string }
export const refunds = (path: string) => ({
  credit: (id: number) => api<{ credit_available: string }>(`/${path}/${id}/credit/`),
  list: (id: number) => api<Refund[]>(`/${path}/${id}/refunds/`),
  create: (id: number, body: { cash_account: number; amount: string; date?: string; idempotency_key?: string }) => api<Refund>(`/${path}/${id}/refunds/`, { method: 'POST', body }),
  void: (id: number, refund: number) => api<Refund>(`/${path}/${id}/void-refund/`, { method: 'POST', body: { refund } }),
})
export type ReceiptFile = { id: number; name: string; size: number }

export const expenses = {
  receipts: (id: number) => api<ReceiptFile[]>(`/expenses/${id}/receipts/`),
  addReceipt: (id: number, file: File) => apiUpload<ReceiptFile>(`/expenses/${id}/receipts/`, file),
  getReceipt: (id: number, rid: number, name: string) => apiDownload(`/expenses/${id}/receipts/${rid}/`, name),
  deleteReceipt: (id: number, rid: number) => api<void>(`/expenses/${id}/receipts/${rid}/`, { method: 'DELETE' }),
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

export const bankRules = resource<BankRuleRow>('bank-rules')
