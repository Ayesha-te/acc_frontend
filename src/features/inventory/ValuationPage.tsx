import { FormEvent, useState } from 'react'
import { api } from '../../api/client'
import { documents } from '../../api/endpoints'
import { Badge, Button, Card, EmptyState, ErrorBox, Input, Label, PageHeader, Spinner } from '../../components/ui'
import { money, todayDubai } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'
import { useToast } from '../../lib/toast'
import { useAuth } from '../auth/AuthContext'

type Status = { enabled: boolean; since: string | null }
type Row = { item: number; sku: string; name: string; quantity: string; value: string; average_cost: string; quantity_difference: string }
type Report = { items: Row[]; total_value: string; ledger_balance: string; difference: string; quantity_mismatches: string[] }

/** Inventory valuation (weighted average) and its reconciliation to the ledger. Also the one-time switch-on. */
export function ValuationPage() {
  const { org } = useAuth()
  const toast = useToast()
  const isAdmin = org?.role === 'owner' || org?.role === 'admin'
  const status = useFetch(() => api<Status>('/inventory/costing/'), [org?.id])
  const report = useFetch(() => (status.data?.enabled ? api<Report>('/inventory/costing/valuation/') : Promise.resolve(null)), [org?.id, status.data?.enabled])
  const stock = useFetch(() => documents('inventory/stock').list({ page_size: 200 }), [org?.id])
  const [date, setDate] = useState(todayDubai())
  const [costs, setCosts] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const totals = new Map<number, { name: string; sku: string; qty: number }>()
  stock.data?.results.forEach((r: any) => { const t = totals.get(r.item) ?? { name: r.item_name, sku: r.sku, qty: 0 }; t.qty += Number(r.quantity); totals.set(r.item, t) })

  const enable = async (e: FormEvent) => {
    e.preventDefault()
    if (!confirm('Turn on inventory costing? This cannot be turned off. Stock will be valued at the costs you entered and posted to the ledger.')) return
    setBusy(true); setError(null)
    try {
      await api('/inventory/costing/enable/', { method: 'POST', body: { date, costs } })
      toast.success('Inventory costing enabled'); status.reload()
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  if (status.loading && !status.data) return <Spinner />
  return (
    <div className="max-w-5xl space-y-4">
      <PageHeader title="Inventory valuation" subtitle="Weighted-average cost. When on, purchases add stock at cost, sales post cost of goods sold, and stock value always equals the Inventory account." />
      <ErrorBox error={error ?? status.error} />
      {!status.data?.enabled ? (
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Turn on inventory costing</h2>
          <p className="mb-3 text-sm text-slate-600">Enter the unit cost of every item that has stock today. Production runs and van deliveries are not available while costing is on.</p>
          {isAdmin ? (
            <form className="space-y-3" onSubmit={enable}>
              <Label text="Start date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Label>
              {[...totals.entries()].filter(([, t]) => t.qty !== 0).map(([id, t]) => (
                <Label key={id} text={`${t.name} (${t.sku}) - ${t.qty} on hand: unit cost`}>
                  <Input type="number" step="any" min="0" value={costs[id] ?? ''} onChange={(e) => setCosts({ ...costs, [id]: e.target.value })} required />
                </Label>))}
              <Button disabled={busy}>{busy ? 'Enabling…' : 'Enable inventory costing'}</Button>
            </form>
          ) : <p className="text-sm text-slate-500">Only an owner or admin can turn this on.</p>}
        </Card>
      ) : (
        <>
          <Card className="flex flex-wrap gap-6 text-sm">
            <span>Costing since <b>{status.data.since}</b></span>
            {report.data && <>
              <span>Stock value <b>{money(report.data.total_value)}</b></span>
              <span>Inventory account <b>{money(report.data.ledger_balance)}</b></span>
              <span>Difference <Badge value={Number(report.data.difference) === 0 && !report.data.quantity_mismatches.length ? 'reconciled' : 'mismatch'} tone={Number(report.data.difference) === 0 ? 'posted' : 'void'} /></span>
            </>}
          </Card>
          <Card className="overflow-x-auto p-0">
            {!report.data?.items.length ? <EmptyState title="No valued stock yet" text="Buy or add stock to see values here." /> : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Item</th><th className="text-right">Quantity</th><th className="text-right">Average cost</th><th className="text-right">Value</th></tr></thead>
                <tbody>{report.data.items.map((r) => (
                  <tr key={r.item} className="border-t border-slate-100"><td className="px-4 py-3">{r.name} <span className="text-xs text-slate-500">{r.sku}</span></td>
                    <td className="text-right tabular-nums">{r.quantity}</td><td className="text-right tabular-nums">{money(r.average_cost)}</td><td className="px-4 text-right tabular-nums">{money(r.value)}</td></tr>))}</tbody>
              </table>)}
          </Card>
        </>
      )}
    </div>
  )
}
