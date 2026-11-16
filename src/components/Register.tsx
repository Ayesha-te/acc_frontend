import { ReactNode, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { documents } from '../api/endpoints'
import { useDebounced } from '../lib/useDebounced'
import { useToast } from '../lib/toast'
import { DetailDrawer } from './DetailDrawer'
import { Icon } from './icons'
import { Badge, Button, Card, DateRange, EmptyState, ErrorBox, PageHeader, Pagination, SearchInput, Spinner } from './ui'

export type Column = { key: string; label: string; align?: 'right'; render?: (row: any) => ReactNode }

type RegisterProps = {
  title: string
  subtitle?: string
  path: string
  columns: Column[]
  createTo?: string
  createLabel?: string
  extraQuery?: Record<string, string>
  canWrite: boolean
  /** Defaults to canWrite. */
  canVoid?: boolean
  /** Hide the date filters for registers that have no date. */
  noDates?: boolean
}

const PAGE_SIZE = 25

/**
 * Config-driven paged register. The server does all filtering/pagination; one page is in the browser at a time.
 * Keyed by data source so search/date/page state never leaks from one register into another (React would
 * otherwise reuse this component instance when navigating between routes that render the same component).
 */
export function Register(props: RegisterProps) {
  return <RegisterView key={`${props.path}?${JSON.stringify(props.extraQuery ?? {})}`} {...props} />
}

function RegisterView({ title, subtitle, path, columns, createTo, createLabel = 'New', extraQuery, canWrite, canVoid = canWrite, noDates }: RegisterProps) {
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<any | null>(null)
  const q = useDebounced(search)
  const extra = JSON.stringify(extraQuery ?? {})

  const load = useCallback(() => {
    let live = true
    setLoading(true)
    documents(path)
      .list({ page, page_size: PAGE_SIZE, search: q, date__gte: from, date__lte: to, ...JSON.parse(extra) })
      .then((r) => { if (live) { setRows(r.results); setCount(r.count); setError(null) } })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false))
    return () => { live = false }
  }, [path, page, q, from, to, extra])
  useEffect(load, [load])
  useEffect(() => setPage(1), [q, from, to])

  const voidRow = async (r: any) => {
    if (!confirm(`Void ${r.number}? This cannot be undone: a reversing entry will be posted.`)) return
    try {
      await documents(path).void(r.id)
      toast.success(`${r.number} voided`)
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }
  const filtered = !!(q || from || to)
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const clear = () => { setSearch(''); setFrom(''); setTo('') }

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle}
        actions={createTo && canWrite && <Link to={createTo}><Button><Icon name="plus" size={16} strokeWidth={2.4} />{createLabel}</Button></Link>} />
      <Card className="!rounded-3xl !p-0">
        <div className="flex flex-wrap items-center gap-2 px-4 pb-4 pt-5 sm:px-5">
          <SearchInput className="min-w-[14rem] flex-1" placeholder="Search by number, name or note…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
          {!noDates && <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />}
          {filtered && <Button variant="subtle" onClick={clear}><Icon name="x" size={15} />Clear filters</Button>}
        </div>
        <ErrorBox error={error} />
        <div className="overflow-x-auto px-2 sm:px-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[13px] text-slate-700 [&>th:first-child]:rounded-l-xl [&>th:last-child]:rounded-r-xl">
                {columns.map((c) => <th key={c.key} className={`whitespace-nowrap px-4 py-3 font-semibold ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>)}
                <th className="w-20" />
              </tr>
            </thead>
            <tbody className={loading && rows.length ? 'opacity-50 transition-opacity' : ''}>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => setOpen(r)} className="cursor-pointer border-b border-slate-100 transition hover:bg-indigo-50/50">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 ${c.align === 'right' ? 'whitespace-nowrap text-right tabular-nums' : ''} ${c.key === 'number' ? 'whitespace-nowrap font-bold text-indigo-800' : 'text-slate-700'}`}>
                      {c.render ? c.render(r) : c.key === 'status' ? <Badge value={r.status} icon /> : r[c.key]}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {canVoid && r.status === 'posted' && <Button variant="subtle" className="!px-2.5 !py-1" onClick={() => voidRow(r)}>Void</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && !rows.length && <Spinner />}
          {!loading && !rows.length && (
            filtered
              ? <EmptyState title="No records match your filters" text="Try a different search or date range." action={<Button variant="ghost" onClick={clear}>Clear filters</Button>} />
              : <EmptyState title={`No ${title.toLowerCase()} yet`} text="Records you create will appear here."
                  action={createTo && canWrite ? <Link to={createTo}><Button><Icon name="plus" size={16} />{createLabel}</Button></Link> : undefined} />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm text-slate-600 sm:px-5">
          <span>{count ? `Showing ${(page - 1) * PAGE_SIZE + 1} – ${Math.min(page * PAGE_SIZE, count)} of ${count} record${count === 1 ? '' : 's'}` : '0 records'}</span>
          {pages > 1 && <Pagination page={page} pages={pages} onPage={setPage} />}
        </div>
      </Card>
      {open && <DetailDrawer path={path} id={open.id} title={open.number ?? `#${open.id}`} onClose={() => setOpen(null)} />}
    </div>
  )
}
