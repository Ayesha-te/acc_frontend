import { documents } from '../api/endpoints'
import { money } from '../lib/format'
import { useFetch } from '../lib/useFetch'
import { DocumentActions } from './DocumentActions'
import { ApprovalPanel } from './ApprovalPanel'
import { ExpenseReceipts } from './ExpenseReceipts'
import { RefundPanel } from './RefundPanel'
import { Badge, Drawer, ErrorBox, Spinner } from './ui'

const PDF_PATHS = new Set(['sales/invoices', 'purchases/invoices'])
const APPROVAL_PATHS = new Set(['expenses', 'purchases/invoices'])

const HIDE = new Set(['rejection_reason', 'id', 'party', 'cash_account', 'counter_account', 'branch', 'original', 'item', 'location', 'vehicle', 'account', 'invoice'])
const isMoney = (k: string) => /(^|_)(total|subtotal|tax|net|gross|amount|allocated|unapplied|debit|credit|price|tax_total)$/.test(k)
const label = (k: string) => k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

function Cell({ k, v }: { k: string; v: unknown }) {
  if (v === null || v === undefined || v === '') return <span className="text-slate-400">—</span>
  if (k === 'status') return <Badge value={String(v)} />
  if (isMoney(k) && !Number.isNaN(Number(v))) return <span className="tabular-nums">{money(v as string)}</span>
  if (typeof v === 'object') return <>{JSON.stringify(v)}</>
  return <>{String(v)}</>
}

/** Read-only view of any document returned by a register endpoint: header fields plus its line tables. */
export function DetailDrawer({ path, id, title, onClose }: { path: string; id: number; title: string; onClose(): void }) {
  const { data, loading, error, reload } = useFetch(() => documents(path).get(id), [path, id])
  const scalars = data ? Object.entries(data).filter(([k, v]) => !HIDE.has(k) && !Array.isArray(v)) : []
  const tables = data ? Object.entries(data).filter(([, v]) => Array.isArray(v) && v.length) : []
  return (
    <Drawer title={title} onClose={onClose}>
      {loading && <Spinner />}
      <ErrorBox error={error} />
      {data && (
        <div className="space-y-6">
          {APPROVAL_PATHS.has(path) && <ApprovalPanel path={path} id={id} status={data.status} reason={data.rejection_reason} onChanged={reload} />}
          {PDF_PATHS.has(path) && data.status !== undefined && <DocumentActions pdfPath={`/${path}/${id}/pdf/`} emailPath={`/${path}/${id}/email/`} defaultSubject={`${title}`} />}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {scalars.map(([k, v]) => (
              <div key={k}><dt className="text-xs uppercase tracking-wide text-slate-500">{label(k)}</dt><dd className="mt-0.5 font-medium"><Cell k={k} v={v} /></dd></div>
            ))}
          </dl>
          {path === 'expenses' && <ExpenseReceipts id={id} />}
          {PDF_PATHS.has(path) && data.kind === 'invoice' && data.status === 'posted' && <RefundPanel path={path} id={id} />}
          {tables.map(([name, rows]) => {
            const cols = Object.keys((rows as any[])[0]).filter((k) => !HIDE.has(k))
            return (
              <section key={name}>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">{label(name)}</h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <tr>{cols.map((c) => <th key={c} className="px-3 py-2 font-medium">{label(c)}</th>)}</tr>
                    </thead>
                    <tbody>
                      {(rows as any[]).map((r, i) => (
                        <tr key={i} className="border-t border-slate-100">{cols.map((c) => <td key={c} className="px-3 py-2"><Cell k={c} v={r[c]} /></td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </Drawer>
  )
}
