// Single HTTP entry point. Feature modules import from here, never call fetch directly.
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://api-acc.stride-events.net/api/v1'

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public body?: unknown) {
    super(message)
  }
}

export const session = {
  get token() { return localStorage.getItem('token') },
  set token(v: string | null) { v ? localStorage.setItem('token', v) : localStorage.removeItem('token') },
  get orgId() { return localStorage.getItem('orgId') },
  set orgId(v: string | null) { v ? localStorage.setItem('orgId', v) : localStorage.removeItem('orgId') },
}

export type Page<T> = { count: number; next: string | null; previous: string | null; results: T[] }

function describe(body: any): string {
  if (!body) return 'Request failed'
  if (typeof body.detail === 'string') return body.detail
  return Object.entries(body).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : JSON.stringify(v)}`).join('; ')
}

/** Multipart upload (browser sets the boundary, so no JSON content type). */
export async function apiUpload<T = unknown>(path: string, file: File, fields: Record<string, string> = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (session.token) headers.Authorization = `Token ${session.token}`
  if (session.orgId) headers['X-Organization-ID'] = session.orgId
  const form = new FormData()
  Object.entries(fields).forEach(([k, v]) => form.append(k, v))
  form.append('file', file)
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: form })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, describe(data), data?.code, data)
  return data as T
}

/** Authenticated file download (the token cannot ride on a plain link). */
export async function apiDownload(path: string, filename: string): Promise<void> {
  const headers: Record<string, string> = {}
  if (session.token) headers.Authorization = `Token ${session.token}`
  if (session.orgId) headers['X-Organization-ID'] = session.orgId
  const res = await fetch(`${BASE}${path}`, { headers })
  if (!res.ok) throw new ApiError(res.status, 'Could not download the receipt')
  const url = URL.createObjectURL(await res.blob())
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

/** Authenticated PDF: fetched with the token, then opened in a new tab (a plain link could not carry the token). */
export async function apiOpenPdf(path: string, query: Record<string, string | undefined> = {}): Promise<void> {
  const headers: Record<string, string> = {}
  if (session.token) headers.Authorization = `Token ${session.token}`
  if (session.orgId) headers['X-Organization-ID'] = session.orgId
  const qs = '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v) as [string, string][])
  const res = await fetch(`${BASE}${path}${qs}`, { headers })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new ApiError(res.status, describe(data) || 'Could not open the PDF', data?.code, data)
  }
  const url = URL.createObjectURL(await res.blob())
  const w = window.open(url, '_blank')
  if (!w) Object.assign(document.createElement('a'), { href: url, download: 'document.pdf' }).click()  // pop-up blocked: download instead
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {}): Promise<T> {
  const qs = opts.query ? '?' + new URLSearchParams(Object.entries(opts.query).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])) : ''
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (session.token) headers.Authorization = `Token ${session.token}`
  if (session.orgId) headers['X-Organization-ID'] = session.orgId
  const res = await fetch(`${BASE}${path}${qs}`, { method: opts.method ?? 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (res.status === 401) { session.token = null; window.dispatchEvent(new Event('auth:expired')) }
  if (!res.ok) throw new ApiError(res.status, describe(data), data?.code, data)
  return data as T
}
