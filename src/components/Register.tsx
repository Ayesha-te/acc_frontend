import { ReactNode, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { documents } from '../api/endpoints'
import { useDebounced } from '../lib/useDebounced'
import { Button, Card, ErrorBox, Input } from './ui'

export type Column = { key: string; label: string; align?: 'right'; render?: (row: any) => ReactNode }

const PAGE_SIZE = 25

/** Config-driven paged register. The server does all filtering/pagination; one page is in the browser at a time. */
export function Register({ title, path, columns, createTo, extraQuery, canWrite }: {
  title: string
  path: string
  columns: Column[]
  createTo?: string
  extraQuery?: Record<string, string>
  canWrite: boolean
}) {
  const [rows, setRows] = useState<any[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const q = useDebounced(search)
  const extra = JSON.stringify(extraQuery ?? {})

  const load = useCallback(() => {
    setLoading(true)
    documents(path)
      .list({ page, page_size: PAGE_SIZE, search: q, date__gte: from, date__lte: to, ...JSON.parse(extra) })
      .then((r) => {
        setRows(r.results)
        setCount(r.count)
        setError(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [path, page, q, from, to, extra])
  useEffect(load, [load])
  useEffect(() => setPage(1), [q, from, to, path, extra])

  const voidRow = async (r: any) => {
    if (!confirm(`Void ${r.number}? A reversing entry will be posted.`)) return
    try {
      await documents(path).void(r.id)
      load()
    } catch (e: any) {
      setError(e.message)
    }
  }
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{title}</h1>
        {createTo && canWrite && (
          <Link to={createTo}>
            <Button>New</Button>
          </Link>
        )}
      </div>
      <Card className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
        <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
      </Card>
      <ErrorBox error={error} />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-600">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-3 py-2 font-medium ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody className={loading ? 'opacity-50' : ''}>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                    {c.render ? c.render(r) : r[c.key]}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  {canWrite && r.status === 'posted' && <Button variant="ghost" onClick={() => voidRow(r)}>Void</Button>}
                </td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr><td colSpan={columns.length + 1} className="px-3 py-8 text-center text-slate-500">No records.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>{count} record{count === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
          <span>{page} / {pages}</span>
          <Button variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </div>
    </div>
  )
}
