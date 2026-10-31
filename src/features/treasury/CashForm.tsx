import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { Account, accounts, documents } from '../../api/endpoints'
import { PartySelect } from '../../components/PartySelect'
import { Button, Card, ErrorBox, Input, Label, Select } from '../../components/ui'
import { money, todayDubai } from '../../lib/format'
import { useSubmit } from '../../lib/useSubmit'

type Open = { id: number; number: string; due_date: string; outstanding: string }

/** Receipt (money in from a customer) or payment (money out to a supplier). */
export function CashForm({ path, partyKind, title }: { path: 'receipts' | 'payments'; partyKind: 'customer' | 'supplier'; title: string }) {
  const nav = useNavigate()
  const [cashAccounts, setCash] = useState<Account[]>([])
  const [f, setF] = useState({ party: '', cash_account: '', amount: '', date: todayDubai(), method: 'cash', reference: '', narration: '' })
  const [open, setOpen] = useState<Open[]>([])
  const [alloc, setAlloc] = useState<Record<number, string>>({})
  const up = (patch: Partial<typeof f>) => setF({ ...f, ...patch })
  useEffect(() => {
    accounts.list().then((a) => {
      const c = a.filter((x) => x.is_cash_bank)
      setCash(c)
      if (c[0]) setF((p) => ({ ...p, cash_account: String(c[0].id) }))
    })
  }, [])
  useEffect(() => {
    setAlloc({})
    if (!f.party) return setOpen([])
    api<Open[]>(`/${path}/open-invoices/`, { query: { party: f.party } }).then(setOpen).catch(() => setOpen([]))
  }, [f.party, path])
  const applied = Object.values(alloc).reduce((s, v) => s + Number(v || 0), 0)
  const unapplied = Number(f.amount || 0) - applied
  // Oldest-due first, never more than the invoice's outstanding or the remaining amount.
  const autoApply = () => {
    let left = Number(f.amount || 0)
    const next: Record<number, string> = {}
    for (const o of open) {
      const x = Math.min(left, Number(o.outstanding))
      if (x > 0) { next[o.id] = x.toFixed(2); left -= x }
    }
    setAlloc(next)
  }
  const { submit, busy, error } = useSubmit(
    (idempotency_key) => documents(path).create({
        ...f, party: Number(f.party), cash_account: Number(f.cash_account), idempotency_key,
        allocations: Object.entries(alloc).filter(([, v]) => Number(v) > 0).map(([id, amount]) => ({ invoice: Number(id), amount })),
      }),
    () => nav(`/${path}`),
  )
  return (
    <form className="max-w-2xl space-y-4" onSubmit={(e) => { e.preventDefault(); submit() }}>
      <h1 className="text-xl font-semibold">{title}</h1>
      <ErrorBox error={error} />
      <Card className="grid gap-3 sm:grid-cols-2">
        <Label text={partyKind === 'customer' ? 'Customer' : 'Supplier'}><PartySelect kind={partyKind} value={f.party} onChange={(v) => up({ party: v })} /></Label>
        <Label text="Date"><Input type="date" value={f.date} onChange={(e) => up({ date: e.target.value })} required /></Label>
        <Label text="Amount"><Input type="number" step="0.01" min="0.01" value={f.amount} onChange={(e) => up({ amount: e.target.value })} required /></Label>
        <Label text={path === 'receipts' ? 'Deposit to' : 'Paid from'}>
          <Select value={f.cash_account} onChange={(e) => up({ cash_account: e.target.value })} required>
            {cashAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Label>
        <Label text="Method">
          <Select value={f.method} onChange={(e) => up({ method: e.target.value })}>
            {['cash', 'bank_transfer', 'cheque', 'card', 'other'].map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
          </Select>
        </Label>
        <Label text="Reference"><Input value={f.reference} onChange={(e) => up({ reference: e.target.value })} /></Label>
        <div className="sm:col-span-2"><Label text="Narration"><Input value={f.narration} onChange={(e) => up({ narration: e.target.value })} /></Label></div>
      </Card>
      {open.length > 0 && (
        <Card className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Apply to invoices</h2>
            <Button type="button" variant="ghost" onClick={autoApply}>Auto-apply oldest first</Button>
          </div>
          {open.map((o) => (
            <div key={o.id} className="grid grid-cols-12 items-center gap-2 text-sm">
              <span className="col-span-4">{o.number}</span>
              <span className="col-span-3 text-slate-500">due {o.due_date}</span>
              <span className="col-span-2 text-right tabular-nums">{money(o.outstanding)}</span>
              <Input className="col-span-3" type="number" step="0.01" min="0" max={o.outstanding} value={alloc[o.id] ?? ''} onChange={(e) => setAlloc({ ...alloc, [o.id]: e.target.value })} aria-label={`Apply to ${o.number}`} />
            </div>
          ))}
          <div className={`text-right text-sm ${unapplied < 0 ? 'text-red-600' : 'text-slate-600'}`}>Applied {money(applied)} · Unapplied {money(unapplied)}</div>
        </Card>
      )}
      <div className="flex gap-2">
        <Button disabled={busy || unapplied < 0}>{busy ? 'Saving…' : 'Post'}</Button>
        <Button type="button" variant="ghost" onClick={() => nav(`/${path}`)}>Cancel</Button>
      </div>
    </form>
  )
}
