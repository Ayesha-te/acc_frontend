import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { Badge, Button, Card, EmptyState, ErrorBox, Input, Label, PageHeader, Spinner } from '../../components/ui'
import { money, todayDubai } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'
import { useToast } from '../../lib/toast'
import { useAuth } from '../auth/AuthContext'

type CreditInvoice = { id: number; number: string; date: string; party: number; branch: number | null; total: string; outstanding: string; credit_available: string }
type Link = { id: number; invoice: number; number: string; amount: string; date: string }
type Summary = { invoice: number; number: string; credit_available: string; credit_applied: string; given: Link[]; received: Link[] }
type Open = { id: number; number: string; due_date: string; outstanding: string; branch: number | null }

/**
 * Customer credits (sales) or supplier credits (purchases): move credit held on an invoice (e.g. a return after
 * payment) onto other open invoices of the same party and branch. Nothing is posted to the ledger.
 */
export function CreditsPage({ side }: { side: 'sales' | 'purchases' }) {
  const { org } = useAuth()
  const toast = useToast()
  const invPath = `${side}/invoices`
  const cashPath = side === 'sales' ? 'receipts' : 'payments'
  const canWrite = !!org && org.role !== 'viewer'
  const list = useFetch(() => api<CreditInvoice[]>(`/${invPath}/credits/`), [org?.id, side])
  const [sel, setSel] = useState<CreditInvoice | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [open, setOpen] = useState<Open[]>([])
  const [amounts, setAmounts] = useState<Record<number, string>>({})
  const [date, setDate] = useState(todayDubai())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async (inv: CreditInvoice) => {
    setError(null); setAmounts({})
    const [s, o] = await Promise.all([
      api<Summary>(`/${invPath}/${inv.id}/credit/`),
      api<Open[]>(`/${cashPath}/open-invoices/`, { query: { party: inv.party } }),
    ])
    setSummary(s)
    setOpen(o.filter((x) => x.id !== inv.id && (x.branch ?? null) === (inv.branch ?? null)))
  }
  useEffect(() => { setSel(null); setSummary(null) }, [side, org?.id])
  useEffect(() => { if (sel) load(sel).catch((e) => setError(e.message)) }, [sel?.id])

  const total = Object.values(amounts).reduce((s, v) => s + Number(v || 0), 0)
  const available = Number(summary?.credit_available ?? 0)
  const remaining = available - total

  const apply = async () => {
    if (!sel) return
    setBusy(true); setError(null)
    try {
      const applications = Object.entries(amounts).filter(([, v]) => Number(v) > 0).map(([id, v]) => ({ invoice: Number(id), amount: v }))
      await api(`/${invPath}/${sel.id}/apply-credit/`, { method: 'POST', body: { date, applications } })
      toast.success('Credit applied')
      await load(sel); list.reload()
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }
  const unapply = async (id: number) => {
    if (!sel) return
    setBusy(true); setError(null)
    try {
      await api(`/${invPath}/${sel.id}/unapply-credit/`, { method: 'POST', body: { application: id } })
      toast.success('Credit application removed')
      await load(sel); list.reload()
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  const title = side === 'sales' ? 'Customer credits' : 'Supplier credits'
  return (
    <div className="max-w-5xl space-y-4">
      <PageHeader title={title} subtitle={`Credit left on an invoice after a return or overpayment can be applied to that ${side === 'sales' ? 'customer' : 'supplier'}'s other open invoices. No journal entries are created.`} />
      <Card>
        {list.loading ? <Spinner /> : !list.data?.length ? <EmptyState title="No unapplied credit" text="Credit appears here when an invoice is returned after it was paid." /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-1">Invoice</th><th>Date</th><th className="text-right">Total</th><th className="text-right">Credit available</th><th /></tr></thead>
            <tbody>{list.data.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="py-1.5">{c.number}</td><td>{c.date}</td><td className="text-right">{money(c.total)}</td>
                <td className="text-right font-medium">{money(c.credit_available)}</td>
                <td className="text-right"><Button variant="subtle" onClick={() => setSel(c)}>{sel?.id === c.id ? 'Selected' : 'Open'}</Button></td>
              </tr>))}</tbody>
          </table>
        )}
      </Card>
      {sel && summary && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Apply credit from {summary.number}</h2>
          <ErrorBox error={error} />
          <div className="mb-3 flex flex-wrap gap-4 text-sm">
            <span>Credit available: <b>{money(summary.credit_available)}</b></span>
            <span>Already applied: <b>{money(summary.credit_applied)}</b></span>
            <span>Left after this entry: <b className={remaining < 0 ? 'text-red-700' : ''}>{money(remaining.toFixed(2))}</b></span>
          </div>
          {open.length === 0 ? <p className="text-sm text-slate-500">No other open invoices for this party in the same branch.</p> : (
            <table className="mb-3 w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-slate-500"><th>Invoice</th><th>Due</th><th className="text-right">Outstanding</th><th className="w-40 text-right">Apply</th></tr></thead>
              <tbody>{open.map((o) => (
                <tr key={o.id} className="border-t"><td className="py-1.5">{o.number}</td><td>{o.due_date}</td><td className="text-right">{money(o.outstanding)}</td>
                  <td><Input type="number" step="0.01" min="0" disabled={!canWrite} value={amounts[o.id] ?? ''}
                    onChange={(e) => setAmounts({ ...amounts, [o.id]: e.target.value })} className="text-right" /></td></tr>))}</tbody>
            </table>
          )}
          {canWrite && (
            <div className="flex items-end gap-3">
              <Label text="Application date"><Input type="date" value={date} max={todayDubai()} onChange={(e) => setDate(e.target.value)} /></Label>
              <Button onClick={apply} disabled={busy || total <= 0 || remaining < 0}>Apply credit</Button>
            </div>
          )}
          {summary.given.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-1 text-sm font-semibold">Applied so far</h3>
              <ul className="space-y-1 text-sm">{summary.given.map((g) => (
                <li key={g.id} className="flex items-center gap-3"><Badge value="applied" tone="posted" /> {money(g.amount)} to {g.number} on {g.date}
                  {canWrite && <Button variant="subtle" disabled={busy} onClick={() => unapply(g.id)}>Remove</Button>}</li>))}</ul>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
