import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, apiOpenPdf } from '../../api/client'
import { documents, report } from '../../api/endpoints'
import { BarChart, Donut } from '../../components/charts'
import { DetailDrawer } from '../../components/DetailDrawer'
import { Icon } from '../../components/icons'
import { Badge, Button, Card, CardTitle, DateRange, Dropdown, EmptyState, ErrorBox, KpiCard, Pagination, SearchInput, Skeleton, Spinner, Tabs, Trend } from '../../components/ui'
import { downloadCsv } from '../../lib/csv'
import { money, periodPresets, todayDubai } from '../../lib/format'
import { useDebounced } from '../../lib/useDebounced'
import { useFetch } from '../../lib/useFetch'
import { useToast } from '../../lib/toast'
import { useAuth } from '../auth/AuthContext'

type Tab = 'all' | 'paid' | 'settled' | 'pending' | 'overdue'
const TABS: Tab[] = ['paid', 'settled', 'pending', 'overdue']
type OpenInv = { id: number; number: string; party: number; date: string; due_date: string | null; total: string; outstanding: string }
type SummaryRow = { key: string | number; label: string; invoices: number; sales_total: string }
type Summary = { rows: SummaryRow[]; totals: { invoices: number; sales_total: string } }

const PAGE_SIZE = 10
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const COLORS = { paid: '#22c55e', settled: '#94a3b8', pending: '#8b5cf6', overdue: '#f59e0b' }
const n = (v: string | number | null | undefined) => Number(v ?? 0)
const ymd = (y: number, m: number, d = 1) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const effDue = (r: { due_date: string | null; date: string }) => r.due_date ?? r.date
const fmtDate = (d?: string | null) => d ? new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—'
const inRange = (d: string, from: string, to: string) => (!from || d >= from) && (!to || d <= to)
const initials = (s: string) => s.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?'
const AVATAR = ['bg-indigo-100 text-indigo-700', 'bg-rose-100 text-rose-700', 'bg-amber-100 text-amber-700', 'bg-emerald-100 text-emerald-700', 'bg-sky-100 text-sky-700']

/** Monthly Billing periods: label -> [from, to, months]. */
function billingPeriods() {
  const [y, m] = todayDubai().split('-').map(Number)
  const back = (k: number) => { const t = y * 12 + (m - 1) - k; return [Math.floor(t / 12), (t % 12) + 1] as const }
  const [sy, sm] = back(11)
  return {
    year: { label: 'This Year', from: ymd(y, 1), to: todayDubai(), start: [y, 1] as const, count: m },
    last12: { label: 'Last 12 Months', from: ymd(sy, sm), to: todayDubai(), start: [sy, sm] as const, count: 12 },
    lastyear: { label: 'Last Year', from: ymd(y - 1, 1), to: ymd(y - 1, 12, 31), start: [y - 1, 1] as const, count: 12 },
  }
}

/**
 * Sales invoices workspace. Every figure comes from existing read-only endpoints:
 *  - sales-summary report (posted invoice totals, by month and by customer)
 *  - receipts/open-invoices (outstanding balance per open invoice: allocations, returns, credits, refunds)
 *  - sales/invoices list with the read-only `payment_status` filter for the tabs
 * Paid = posted invoice totals minus the totals of invoices that still have a balance. Voided invoices never count.
 */
export function SalesInvoicesPage() {
  const { org } = useAuth()
  const canWrite = !!org && org.role !== 'viewer'
  const cur = org?.base_currency ?? ''
  const cash = (v: number | string) => `${cur} ${money(v)}`.trim()
  /** Amount with the currency code as a small prefix (keeps big figures on one line). */
  const Amt = ({ v }: { v: number | string }) => <span className="whitespace-nowrap">{cur && <span className="mr-1 text-[0.55em] font-bold text-slate-500">{cur}</span>}{money(v)}</span>
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const presets = useMemo(() => periodPresets(), [])
  const year = presets.find((p) => p.key === 'year')!

  const [tab, setTabState] = useState<Tab>(() => (TABS.includes(params.get('status') as Tab) ? params.get('status') as Tab : 'all'))
  const setTab = (t: Tab) => { setTabState(t); setParams(t === 'all' ? {} : { status: t }, { replace: true }) }
  useEffect(() => { const s = params.get('status'); if (s && s !== tab && TABS.includes(s as Tab)) setTabState(s as Tab) }, [params]) // eslint-disable-line react-hooks/exhaustive-deps
  const [from, setFrom] = useState(year.from)
  const [to, setTo] = useState(year.to)
  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [ordering, setOrdering] = useState('-date')
  const [page, setPage] = useState(1)
  const [version, setVersion] = useState(0)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [open, setOpen] = useState<any | null>(null)
  const [billing, setBilling] = useState<keyof ReturnType<typeof billingPeriods>>('year')
  const [exporting, setExporting] = useState(false)
  useEffect(() => setPage(1), [q, from, to, tab, ordering])
  useEffect(() => setSelected(new Set()), [q, from, to, tab, ordering, page, version])

  // KPIs, donut, customers: all scoped to the selected date range.
  const summary = useFetch(async () => {
    const range = { date_from: from || undefined, date_to: to || undefined }
    // Invoices closed purely by sales returns (no payment): shown as "Settled", never counted as Paid.
    const settledRows = async () => {
      let all: any[] = []
      for (let p = 1; ; p++) {
        const r = await documents('sales/invoices').list({ kind: 'invoice', payment_status: 'settled', date__gte: from || undefined, date__lte: to || undefined, page: p, page_size: 200 })
        all = all.concat(r.results)
        if (!r.next) return all
      }
    }
    const [s, openRows, byCustomer, customers, settled] = await Promise.all([
      report('sales-summary', { ...range, group_by: 'month' }) as Promise<Summary>,
      api<OpenInv[]>('/receipts/open-invoices/'),
      report('sales-summary', { ...range, group_by: 'customer' }) as Promise<Summary>,
      api<{ count: number }>('/parties/', { query: { kind: 'customer', page_size: 1 } }),
      settledRows(),
    ])
    const today = todayDubai()
    const openIn = openRows.filter((r) => inRange(r.date, from, to))
    const pend = openIn.filter((r) => effDue(r) >= today)
    const over = openIn.filter((r) => effDue(r) < today)
    const sum = (rows: OpenInv[], k: 'total' | 'outstanding') => rows.reduce((a, r) => a + n(r[k]), 0)
    const invoiced = n(s.totals.sales_total)
    const settledTotal = settled.reduce((a, r) => a + n(r.total), 0)
    const paidTotal = Math.max(0, invoiced - sum(openIn, 'total') - settledTotal)
    const openByParty = new Map<number, number>()
    openIn.forEach((r) => openByParty.set(r.party, (openByParty.get(r.party) ?? 0) + n(r.outstanding)))
    return {
      invoiced, count: s.totals.invoices,
      paid: { total: paidTotal, count: Math.max(0, s.totals.invoices - openIn.length - settled.length) },
      settled: { total: settledTotal, count: settled.length, ids: new Set<number>(settled.map((r) => r.id)) },
      pending: { total: sum(pend, 'total'), due: sum(pend, 'outstanding'), count: pend.length },
      overdue: { total: sum(over, 'total'), due: sum(over, 'outstanding'), count: over.length },
      openById: new Map(openRows.map((r) => [r.id, r])),
      customers: customers.count,
      top: [...byCustomer.rows].sort((a, b) => n(b.sales_total) - n(a.sales_total)).slice(0, 4)
        .map((r) => ({ ...r, outstanding: openByParty.get(Number(r.key)) ?? 0 })),
    }
  }, [org?.id, from, to, version])

  // Month-on-month trend for the Total Invoiced card (independent of the range filter).
  const trend = useFetch(async () => {
    const [y, m] = todayDubai().split('-').map(Number)
    const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1
    const s = await report('sales-summary', { date_from: ymd(py, pm), date_to: todayDubai(), group_by: 'month' }) as Summary
    const get = (k: string) => n(s.rows.find((r) => r.label === k)?.sales_total)
    return { now: get(`${y}-${String(m).padStart(2, '0')}`), prev: get(`${py}-${String(pm).padStart(2, '0')}`) }
  }, [org?.id, version])

  const periods = useMemo(() => billingPeriods(), [])
  const monthly = useFetch(async () => {
    const p = periods[billing]
    const s = await report('sales-summary', { date_from: p.from, date_to: p.to, group_by: 'month' }) as Summary
    const by = new Map(s.rows.map((r) => [r.label, n(r.sales_total)]))
    return Array.from({ length: p.count }, (_, i) => {
      const t = p.start[0] * 12 + (p.start[1] - 1) + i
      const yy = Math.floor(t / 12), mm = (t % 12) + 1
      return { label: MONTHS[mm - 1], title: `${MONTHS[mm - 1]} ${yy}`, value: by.get(`${yy}-${String(mm).padStart(2, '0')}`) ?? 0 }
    })
  }, [org?.id, billing, version])

  // Invoice table: server-side search, dates, payment status, ordering and paging.
  const listQuery = useCallback((extra: Record<string, string | number>) => ({
    kind: 'invoice', search: q || undefined, date__gte: from || undefined, date__lte: to || undefined,
    payment_status: tab === 'all' ? undefined : tab, ordering, ...extra,
  }), [q, from, to, tab, ordering])
  const list = useFetch(() => documents('sales/invoices').list(listQuery({ page, page_size: PAGE_SIZE })), [org?.id, listQuery, page, version])
  const rows = list.data?.results ?? []
  const count = list.data?.count ?? 0
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  /** Paid / Settled / Pending / Overdue for one row, from its real outstanding balance. */
  const status = (r: any): string => {
    if (r.status !== 'posted') return r.status
    const o = summary.data?.openById.get(r.id)
    if (!summary.data) return 'posted'
    if (!o) return summary.data.settled.ids.has(r.id) ? 'settled' : 'paid'
    return effDue(o) < todayDubai() ? 'overdue' : 'pending'
  }

  const voidRow = async (r: any) => {
    if (!confirm(`Void ${r.number}? This cannot be undone: a reversing entry will be posted.`)) return
    try {
      await documents('sales/invoices').void(r.id)
      toast.success(`${r.number} voided`)
      setVersion((v) => v + 1)
    } catch (e: any) { toast.error(e.message) }
  }
  const viewPdf = (r: any) => apiOpenPdf(`/sales/invoices/${r.id}/pdf/`).catch((e) => toast.error(e.message))

  const exportCsv = async () => {
    setExporting(true)
    try {
      let all: any[] = []
      if (selected.size) all = rows.filter((r) => selected.has(r.id))
      else {
        for (let p = 1; ; p++) {
          const r = await documents('sales/invoices').list(listQuery({ page: p, page_size: 200 }))
          all = all.concat(r.results)
          if (!r.next) break
        }
      }
      downloadCsv(`sales-invoices-${todayDubai()}.csv`, ['Invoice #', 'Customer', 'Issue date', 'Due date', 'Subtotal', 'Tax', 'Total', 'Outstanding', 'Status'],
        all.map((r) => [r.number, r.party_name, r.date, r.due_date ?? '', r.subtotal, r.tax_total, r.total, summary.data?.openById.get(r.id)?.outstanding ?? (r.status === 'posted' ? '0.00' : ''), status(r)]))
      toast.success(`Exported ${all.length} invoice${all.length === 1 ? '' : 's'}`)
    } catch (e: any) { toast.error(e.message) } finally { setExporting(false) }
  }

  const sortBy = (field: 'number' | 'date' | 'total') => setOrdering((o) => (o === `-${field}` ? field : `-${field}`))
  const SortTh = ({ field, label, right }: { field: 'number' | 'date' | 'total'; label: string; right?: boolean }) => {
    const dir = ordering === field ? 'ascending' : ordering === `-${field}` ? 'descending' : 'none'
    return (
      <th aria-sort={dir} className={`px-4 py-3 font-semibold ${right ? 'text-right' : ''}`}>
        <button type="button" onClick={() => sortBy(field)} className={`inline-flex items-center gap-1 hover:text-indigo-700 ${dir !== 'none' ? 'text-indigo-700' : ''}`}>
          {label}<Icon name={dir === 'ascending' ? 'arrowUp' : dir === 'descending' ? 'arrowDown' : 'sort'} size={14} />
        </button>
      </th>
    )
  }

  const S = summary.data
  const sl = summary.loading && !S
  const filtered = !!(q || tab !== 'all' || from !== year.from || to !== year.to)
  const clear = () => { setSearch(''); setTab('all'); setFrom(year.from); setTo(year.to) }
  const pct = (v: number) => (S && S.invoiced > 0 ? Math.round((v / S.invoiced) * 100) : 0)
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-slate-900 md:text-[34px]">Sales Invoices</h1>
          <p className="mt-1 text-[15px] text-slate-500">Create, manage and track all customer invoices</p>
        </div>
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
      </div>
      <ErrorBox error={summary.error} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* ── Left: bento analytics + table ── */}
        <div className="min-w-0 space-y-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-[1.15fr_1.3fr_1fr]">
            {/* Total invoiced hero */}
            <div className="bg-hero-violet relative overflow-hidden rounded-3xl p-5 shadow-card ring-1 ring-fuchsia-200/50 md:col-span-2 2xl:col-span-1">
              <div className="pointer-events-none absolute -bottom-10 -left-8 h-36 w-56 rounded-full bg-violet-300/40 blur-2xl" />
              <InvoiceArt />
              <div className="relative flex h-full min-h-[11rem] flex-col justify-end pt-[6.5rem]">
                  <div className="text-[15px] font-semibold text-slate-700">Total Invoiced</div>
                  {sl ? <Skeleton className="mt-2 h-9 w-40" /> : <div className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight text-slate-900 tabular-nums sm:text-[32px]"><Amt v={S?.invoiced ?? 0} /></div>}
                  {trend.data && trend.data.prev > 0 && <div className="mt-1.5"><Trend now={trend.data.now} prev={trend.data.prev} label="vs last month" /></div>}
                  {S && <div className="mt-2 text-xs text-slate-500">{S.count} posted invoice{S.count === 1 ? '' : 's'} in the selected period</div>}
              </div>
            </div>

            {/* Monthly billing */}
            <Card className="!rounded-3xl !p-5">
              <CardTitle icon="barChart" title="Monthly Billing" right={
                <select value={billing} onChange={(e) => setBilling(e.target.value as typeof billing)} aria-label="Billing period"
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                  {Object.entries(periods).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
                </select>} />
              {monthly.error ? <ErrorBox error={monthly.error} /> : monthly.data
                ? <BarChart data={monthly.data} format={(v) => cash(v)} />
                : <Skeleton className="h-40 w-full" />}
            </Card>

            {/* Invoice status donut */}
            <Card className="!rounded-3xl !p-5">
              <CardTitle icon="pieChart" title="Invoice Status" />
              {sl ? <Skeleton className="h-36 w-full" /> : S && S.invoiced > 0 ? (
                <div className="flex flex-wrap items-center gap-4">
                  <Donut center={`${pct(S.paid.total)}%`} sub="Paid" segments={[
                    { label: 'Paid', value: S.paid.total, color: COLORS.paid },
                    { label: 'Pending', value: S.pending.total, color: COLORS.pending },
                    { label: 'Overdue', value: S.overdue.total, color: COLORS.overdue },
                    { label: 'Settled by returns', value: S.settled.total, color: COLORS.settled }]} />
                  <ul className="min-w-[8rem] flex-1 space-y-3 text-sm">
                    {([['Paid', S.paid.total, COLORS.paid, 'paid'], ['Pending', S.pending.total, COLORS.pending, 'pending'], ['Overdue', S.overdue.total, COLORS.overdue, 'overdue'],
                      ...(S.settled.count ? [['Settled', S.settled.total, COLORS.settled, 'settled'] as const] : [])] as const).map(([l, v, c, t]) => (
                      <li key={l}>
                        <button type="button" onClick={() => setTab(t)} className="flex w-full items-center gap-2 rounded-lg text-left hover:text-indigo-700">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} /><span className="flex-1 text-slate-600">{l}</span><span className="font-bold tabular-nums text-slate-900">{pct(v)}%</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : <p className="py-10 text-center text-sm text-slate-500">No posted invoices in this period.</p>}
            </Card>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <KpiCard label="Paid Invoices" icon="checkCircle" tone="green" loading={sl} value={<Amt v={S?.paid.total ?? 0} />} active={tab === 'paid'} onClick={() => setTab('paid')}
              foot={<span className="text-emerald-700">{S?.paid.count ?? 0} fully paid{S?.settled.count ? ` · ${S.settled.count} settled by returns` : ''}</span>} />
            <KpiCard label="Pending Invoices" icon="clock" tone="amber" loading={sl} value={<Amt v={S?.pending.due ?? 0} />} active={tab === 'pending'} onClick={() => setTab('pending')}
              foot={<span className="text-amber-700">{S?.pending.count ?? 0} not yet due · balance</span>} />
            <KpiCard label="Overdue" icon="alert" tone="rose" loading={sl} value={<Amt v={S?.overdue.due ?? 0} />} active={tab === 'overdue'} onClick={() => setTab('overdue')}
              foot={<span className="text-rose-700">{S?.overdue.count ?? 0} past due · balance</span>} />
            <Link to="/parties" className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              <KpiCard label="Total Customers" icon="users" tone="violet" loading={sl} value={(S?.customers ?? 0).toLocaleString()}
                foot={<span className="text-indigo-700">View customers</span>} />
            </Link>
          </div>

          {/* Invoice table */}
          <Card className="!rounded-3xl !p-0">
            <div className="flex flex-wrap items-center gap-3 px-4 pb-3 pt-5 sm:px-5">
              <h2 className="mr-2 flex items-center gap-2 text-xl font-bold text-slate-900"><Icon name="invoice" size={24} className="text-indigo-600" />Invoices</h2>
              <Tabs value={tab} onChange={setTab} items={[
                { value: 'all', label: 'All', count: tab === 'all' && list.data ? count : null },
                { value: 'paid', label: 'Paid', count: S?.paid.count ?? null },
                ...(S?.settled.count || tab === 'settled' ? [{ value: 'settled' as Tab, label: 'Settled', count: S?.settled.count ?? null }] : []),
                { value: 'pending', label: 'Pending', count: S?.pending.count ?? null },
                { value: 'overdue', label: 'Overdue', count: S?.overdue.count ?? null }]} />
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button variant="ghost" onClick={exportCsv} disabled={exporting || !count}>
                  <Icon name="export" size={16} />{exporting ? 'Exporting…' : selected.size ? `Export (${selected.size})` : 'Export'}
                </Button>
                {canWrite && <Link to="/sales/new"><Button><Icon name="plus" size={16} strokeWidth={2.4} />New invoice</Button></Link>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 px-4 pb-4 sm:px-5">
              <SearchInput className="min-w-[14rem] flex-1" placeholder="Search by invoice number, customer or note…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search invoices" />
              {filtered && <Button variant="subtle" onClick={clear}><Icon name="x" size={15} />Clear filters</Button>}
            </div>
            <ErrorBox error={list.error} />
            <div className="overflow-x-auto px-2 sm:px-3">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-[13px] text-slate-700 [&>th:first-child]:rounded-l-xl [&>th:last-child]:rounded-r-xl">
                    <th className="w-10 px-3 py-3">
                      <input type="checkbox" aria-label="Select all on this page" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                        className="h-4 w-4 rounded border-slate-300 accent-indigo-600" />
                    </th>
                    <SortTh field="number" label="Invoice #" />
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <SortTh field="date" label="Issue Date" />
                    <th className="px-4 py-3 font-semibold">Due Date</th>
                    <SortTh field="total" label="Amount" right />
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody className={list.loading && rows.length ? 'opacity-50 transition-opacity' : ''}>
                  {rows.map((r) => {
                    const st = status(r)
                    const o = S?.openById.get(r.id)
                    return (
                      <tr key={r.id} onClick={() => setOpen(r)} className="cursor-pointer border-b border-slate-100 transition hover:bg-indigo-50/50">
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" aria-label={`Select ${r.number}`} checked={selected.has(r.id)}
                            onChange={() => setSelected((s) => { const x = new Set(s); x.has(r.id) ? x.delete(r.id) : x.add(r.id); return x })}
                            className="h-4 w-4 rounded border-slate-300 accent-indigo-600" />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-bold text-indigo-800">{r.number}</td>
                        <td className="px-4 py-3"><span className="flex items-center gap-2 text-slate-700"><Icon name="user" size={16} className="shrink-0 text-slate-400" /><span className="truncate">{r.party_name}</span></span></td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">{fmtDate(r.date)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">{fmtDate(r.due_date)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                          <div className="font-semibold text-slate-900">{money(r.total)}</div>
                          {o && n(o.outstanding) < n(r.total) && <div className="text-xs text-slate-500">due {money(o.outstanding)}</div>}
                        </td>
                        <td className="px-4 py-3"><Badge value={st} icon /></td>
                        <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <Dropdown label={`Actions for ${r.number}`} trigger={<Icon name="dots" size={20} strokeWidth={3} />} items={[
                            { label: 'View details', icon: 'eye', onClick: () => setOpen(r) },
                            { label: 'View PDF', icon: 'file', onClick: () => viewPdf(r) },
                            { label: 'Receive payment', icon: 'receipt', onClick: () => navigate('/receipts/new'), hidden: !canWrite || st === 'paid' || r.status !== 'posted' },
                            { label: 'Void', icon: 'ban', danger: true, onClick: () => voidRow(r), hidden: !canWrite || r.status !== 'posted' },
                          ]} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {list.loading && !rows.length && <Spinner />}
              {!list.loading && !rows.length && !list.error && (
                filtered
                  ? <EmptyState title="No invoices match your filters" text="Try a different search, status or date range." action={<Button variant="ghost" onClick={clear}>Clear filters</Button>} />
                  : <EmptyState title="No sales invoices yet" text="Invoices you create will appear here."
                      action={canWrite ? <Link to="/sales/new"><Button><Icon name="plus" size={16} />New invoice</Button></Link> : undefined} />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm text-slate-600 sm:px-5">
              <span>{count ? `Showing ${(page - 1) * PAGE_SIZE + 1} – ${Math.min(page * PAGE_SIZE, count)} of ${count} invoice${count === 1 ? '' : 's'}` : 'No invoices'}</span>
              {pages > 1 && <Pagination page={page} pages={pages} onPage={setPage} />}
            </div>
          </Card>
        </div>

        {/* ── Right rail ── */}
        <aside className="space-y-5">
          <div className="bg-hero-cta relative overflow-hidden rounded-3xl p-5 shadow-card ring-1 ring-indigo-200/60">
            {canWrite ? (
              <Link to="/sales/new" className="bg-btn-violet flex items-center gap-3 rounded-2xl px-4 py-3.5 text-[17px] font-bold text-white shadow-[0_10px_24px_-10px_rgb(109_40_217/0.9)] transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                <Icon name="plus" size={22} strokeWidth={2.4} />Create New Invoice
              </Link>
            ) : <div className="rounded-2xl bg-white/60 px-4 py-3 text-sm text-slate-600">View-only access: invoices can be created by accountants, admins and owners.</div>}
            <div className="relative mt-5 flex gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-slate-900">Quick Create Invoice</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">Create and send an invoice to your customer in a few steps.</p>
                {canWrite && (
                  <Link to="/sales/new" className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-900 shadow-card transition hover:shadow-float">
                    New Invoice<Icon name="arrowRight" size={16} strokeWidth={2.4} />
                  </Link>
                )}
              </div>
              <DocArt />
            </div>
          </div>

          <Card className="!rounded-3xl !p-5">
            <CardTitle icon="users" title="Customers" right={<Link to="/parties" className="text-sm font-semibold text-indigo-700 hover:underline">View All</Link>} />
            {sl ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
              : !S?.top.length ? <p className="py-6 text-center text-sm text-slate-500">No customers billed in this period.</p> : (
              <ul className="divide-y divide-slate-100">
                {S.top.map((c, i) => (
                  <li key={c.key} className="flex items-center gap-3 py-2.5">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold ${AVATAR[i % AVATAR.length]}`}>{initials(c.label)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">{c.label}</span>
                      <span className="block truncate text-xs text-slate-500">{c.invoices} invoice{c.invoices === 1 ? '' : 's'} · {cash(c.sales_total)}</span>
                    </span>
                    <Dropdown label={`Actions for ${c.label}`} trigger={<Icon name="dots" size={20} strokeWidth={3} />} items={[
                      { label: 'Find invoices', icon: 'search', onClick: () => { setTab('all'); setSearch(c.label) } },
                      { label: c.outstanding > 0 ? `Receive ${money(c.outstanding)}` : 'Receive payment', icon: 'receipt', onClick: () => navigate('/receipts/new'), hidden: !canWrite },
                    ]} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {S && (
            <button type="button" onClick={() => setTab(S.overdue.count ? 'overdue' : 'all')}
              className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-3xl p-5 text-left shadow-card ring-1 transition hover:-translate-y-0.5 hover:shadow-float ${S.overdue.count ? 'bg-tint-rose ring-rose-200/70' : 'bg-tint-green ring-emerald-200/70'}`}>
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/80 ring-1 ${S.overdue.count ? 'text-rose-600 ring-rose-200' : 'text-emerald-600 ring-emerald-200'}`}><Icon name="bell" size={22} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-slate-900">{S.overdue.count ? `${S.overdue.count} invoice${S.overdue.count === 1 ? ' is' : 's are'} overdue` : 'No overdue invoices'}</span>
                <span className="block text-sm text-slate-600">{S.overdue.count ? `Total overdue amount: ${cash(S.overdue.due)}` : 'Every invoice in this period is on time.'}</span>
              </span>
              <Icon name="arrowRight" size={20} className="shrink-0 text-slate-700 transition group-hover:translate-x-0.5" />
            </button>
          )}
        </aside>
      </div>

      {open && <DetailDrawer path="sales/invoices" id={open.id} title={open.number ?? `#${open.id}`} onClose={() => { setOpen(null); setVersion((v) => v + 1) }} />}
    </div>
  )
}

/** Decorative invoice illustration for the hero card. */
function InvoiceArt() {
  return (
    <svg viewBox="0 0 120 110" className="absolute left-3 top-3 h-24 w-28" aria-hidden="true">
      <defs><linearGradient id="ia" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#ede9fe" /></linearGradient></defs>
      <path d="M44 14l6-10M56 16l10-8M60 26l12-2" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
      <g transform="rotate(-12 60 60)">
        <rect x="22" y="26" width="64" height="78" rx="8" fill="url(#ia)" stroke="#c4b5fd" strokeWidth="1.5" />
        <text x="32" y="44" fontSize="10" fontWeight="800" fill="#6d28d9">INVOICE</text>
        <rect x="32" y="52" width="40" height="4" rx="2" fill="#a78bfa" />
        <rect x="32" y="62" width="44" height="3" rx="1.5" fill="#ddd6fe" />
        <rect x="32" y="70" width="34" height="3" rx="1.5" fill="#ddd6fe" />
        <path d="M58 92c4-6 8 4 12-2s6 0 8-2" stroke="#7c3aed" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  )
}

/** Decorative document stack for the quick-create card. */
function DocArt() {
  return (
    <svg viewBox="0 0 90 110" className="hidden h-28 w-20 shrink-0 sm:block xl:block" aria-hidden="true">
      <g transform="rotate(10 45 55)">
        <rect x="16" y="10" width="60" height="84" rx="8" fill="#ddd6fe" />
        <rect x="10" y="16" width="60" height="84" rx="8" fill="#fff" stroke="#c4b5fd" />
        <rect x="20" y="30" width="36" height="5" rx="2.5" fill="#8b5cf6" />
        {[44, 54, 64, 74].map((y) => <rect key={y} x="20" y={y} width={y === 74 ? 26 : 40} height="4" rx="2" fill="#c4b5fd" />)}
      </g>
    </svg>
  )
}
