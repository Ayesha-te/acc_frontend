import { ReactNode, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { documents } from '../api/endpoints'
import { useDebounced } from '../lib/useDebounced'
import { useToast } from '../lib/toast'
import { DetailDrawer } from './DetailDrawer'
import { Badge, Button, Card, EmptyState, ErrorBox, Input, PageHeader, Spinner } from './ui'

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

function RegisterView({ title, subtitle, path, columns, createTo, createLabel = 'New', extraQuery, canWrite, noDates }: RegisterProps) {
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
        actions={createTo && canWrite && <Link to={createTo}><Button>+ {createLabel}</Button></Link>} />
      <Card className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <Input placeholder="Search by number, name or note…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
        </div>
        {!noDates && (
          <>
            <label className="text-xs text-slate-500">From<Input type="date" className="mt-0.5 w-40" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" /></label>
            <label className="text-xs text-slate-500">To<Input type="date" className="mt-0.5 w-40" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" /></label>
          </>
        )}
        {filtered && <Button variant="subtle" onClick={clear}>Clear filters</Button>}
      </Card>
      <ErrorBox error={error} />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((c) => <th key={c.key} className={`px-4 py-3 font-medium ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>)}
              <th className="w-20" />
            </tr>
          </thead>
          <tbody className={loading && rows.length ? 'opacity-50' : ''}>
            {rows.map((r) => (
              <tr key={r.id} onClick={() => setOpen(r)} className="cursor-pointer border-t border-slate-100 hover:bg-indigo-50/40">
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                    {c.render ? c.render(r) : c.key === 'status' ? <Badge value={r.status} /> : r[c.key]}
                  </td>
                ))}
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  {canWrite && r.status === 'posted' && <Button variant="subtle" onClick={() => voidRow(r)}>Void</Button>}
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
                action={createTo && canWrite ? <Link to={createTo}><Button>+ {createLabel}</Button></Link> : undefined} />
        )}
      </Card>
      <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
        <span>{count} record{count === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>Page {page} of {pages}</span>
          <Button variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </div>
      {open && <DetailDrawer path={path} id={open.id} title={open.number ?? `#${open.id}`} onClose={() => setOpen(null)} />}
    </div>
  )
}
