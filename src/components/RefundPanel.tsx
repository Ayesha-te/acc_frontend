import { FormEvent, useEffect, useState } from 'react'
import { Account, accounts, refunds } from '../api/endpoints'
import { money, todayDubai } from '../lib/format'
import { useFetch } from '../lib/useFetch'
import { useToast } from '../lib/toast'
import { useSubmit } from '../lib/useSubmit'
import { Badge, Button, ErrorBox, Input, Label, Select } from './ui'

/** Shown on a posted invoice that holds credit (for example a return after it was paid): pay it back, or take it back from a supplier. */
export function RefundPanel({ path, id }: { path: string; id: number }) {
  const api = refunds(path)
  const customer = path.startsWith('sales')
  const toast = useToast()
  const credit = useFetch(() => api.credit(id), [path, id])
  const list = useFetch(() => api.list(id), [path, id])
  const [accts, setAccts] = useState<Account[]>([])
  const [cash, setCash] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayDubai())
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { accounts.list().then((a) => setAccts(a.filter((x) => x.is_cash_bank))) }, [])
  const available = Number(credit.data?.credit_available ?? 0)
  const reload = () => { credit.reload(); list.reload() }
  const { submit, busy, error } = useSubmit(
    (idempotency_key) => api.create(id, { cash_account: Number(cash), amount, date, idempotency_key }),
    () => { toast.success('Refund recorded'); setAmount(''); reload() },
  )
  const voidIt = async (rid: number) => {
    if (!confirm('Void this refund? The credit becomes available again.')) return
    try { await api.void(id, rid); reload() } catch (e: any) { setErr(e.message) }
  }
  if (!available && !list.data?.length) return null
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-700">Credit refunds</h3>
      <ErrorBox error={err ?? error} />
      {available > 0 && (
        <form className="grid gap-2 sm:grid-cols-4" onSubmit={(e: FormEvent) => { e.preventDefault(); submit() }}>
          <p className="text-sm text-slate-600 sm:col-span-4">Credit available: <b>{money(available)}</b>. {customer ? 'Pay it back to the customer' : 'Record money received back from the supplier'} through a cash or bank account.</p>
          <Label text="Account"><Select value={cash} onChange={(e) => setCash(e.target.value)} required><option value="">Choose…</option>{accts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}</Select></Label>
          <Label text="Amount"><Input type="number" step="0.01" min="0.01" max={available} value={amount} onChange={(e) => setAmount(e.target.value)} required /></Label>
          <Label text="Date"><Input type="date" value={date} max={todayDubai()} onChange={(e) => setDate(e.target.value)} required /></Label>
          <div className="self-end"><Button disabled={busy || !cash || !amount}>{customer ? 'Refund' : 'Record refund'}</Button></div>
        </form>
      )}
      <ul className="space-y-1 text-sm">{(list.data ?? []).map((r) => (
        <li key={r.id} className="flex items-center gap-3"><span>{r.number} · {r.date} · {money(r.amount)}</span><Badge value={r.status} />
          {r.status === 'posted' && <button type="button" className="text-xs text-red-600 underline" onClick={() => voidIt(r.id)}>Void</button>}</li>))}</ul>
    </section>
  )
}
