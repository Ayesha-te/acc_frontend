import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { Account, accounts, documents } from '../../api/endpoints'
import { BranchSelect } from '../../components/BranchSelect'
import { PartySelect } from '../../components/PartySelect'
import { TaxSelect, useTaxRates } from '../../components/TaxSelect'
import { Button, Card, ErrorBox, Input, Label, PageHeader, Select } from '../../components/ui'
import { money, todayDubai } from '../../lib/format'
import { useSubmit } from '../../lib/useSubmit'
import { useToast } from '../../lib/toast'

type Open = { id: number; number: string; due_date: string; outstanding: string; branch: number | null }

/** Receipt (money in from a customer) or payment (money out to a supplier). */
export function CashForm({ path, partyKind, title }: { path: 'receipts' | 'payments'; partyKind: 'customer' | 'supplier'; title: string }) {
  const nav = useNavigate()
  const toast = useToast()
  const rates = useTaxRates().data
  // 'party' settles customer/supplier invoices; 'account' posts straight to an income/expense account, optionally with VAT.
  const [mode, setMode] = useState<'party' | 'account'>('party')
  const [counter, setCounter] = useState('')
  const [taxRate, setTaxRate] = useState('0')
  const [allAccounts, setAll] = useState<Account[]>([])
  const [cashAccounts, setCash] = useState<Account[]>([])
  const [f, setF] = useState({ party: '', cash_account: '', amount: '', date: todayDubai(), method: 'cash', reference: '', narration: '', branch: '' })
  const [openAll, setOpen] = useState<Open[]>([])
  // A receipt/payment can only be applied to invoices of its own branch (the server enforces it too).
  const open = openAll.filter((o) => (o.branch ?? null) === (f.branch ? Number(f.branch) : null))
  const [alloc, setAlloc] = useState<Record<number, string>>({})
  const up = (patch: Partial<typeof f>) => setF({ ...f, ...patch })
  useEffect(() => {
    accounts.list().then((a) => {
      const c = a.filter((x) => x.is_cash_bank)
      setCash(c)
      setAll(a)
      if (c[0]) setF((p) => ({ ...p, cash_account: String(c[0].id) }))
    })
  }, [])
  useEffect(() => {
    setAlloc({})
    if (!f.party) return setOpen([])
    api<Open[]>(`/${path}/open-invoices/`, { query: { party: f.party } }).then(setOpen).catch(() => setOpen([]))
  }, [f.party, path])
  useEffect(() => { setAlloc({}) }, [f.branch])
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
    (idempotency_key) => documents(path).create(mode === 'account'
      ? { ...f, party: null, counter_account: Number(counter), tax_rate: taxRate || '0', cash_account: Number(f.cash_account), branch: f.branch ? Number(f.branch) : null, idempotency_key }
      : {
        ...f, party: Number(f.party), cash_account: Number(f.cash_account), branch: f.branch ? Number(f.branch) : null, idempotency_key,
        allocations: Object.entries(alloc).filter(([, v]) => Number(v) > 0).map(([id, amount]) => ({ invoice: Number(id), amount })),
      }),
    (doc: any) => { toast.success(`${doc.number} posted`); nav(`/${path}`) },
  )
  return (
    <form className="max-w-2xl space-y-4" onSubmit={(e) => { e.preventDefault(); submit() }}>
      <PageHeader title={title} />
      <ErrorBox error={error} />
      <Card className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 flex gap-4 text-sm">
          <label className="flex items-center gap-1"><input type="radio" checked={mode === 'party'} onChange={() => setMode('party')} /> {partyKind === 'customer' ? 'From a customer' : 'To a supplier'}</label>
          <label className="flex items-center gap-1"><input type="radio" checked={mode === 'account'} onChange={() => setMode('account')} /> {path === 'receipts' ? 'Other income (no customer)' : 'Other payment (no supplier)'}</label>
        </div>
        {mode === 'party'
          ? <Label text={partyKind === 'customer' ? 'Customer' : 'Supplier'}><PartySelect kind={partyKind} value={f.party} onChange={(v) => up({ party: v })} /></Label>
          : <Label text={path === 'receipts' ? 'Income account' : 'Expense / other account'}>
              <Select value={counter} onChange={(e) => setCounter(e.target.value)} required>
                <option value="">Select…</option>
                {allAccounts.filter((a) => !a.is_cash_bank && a.is_active !== false && !a.system_code?.startsWith('ACCOUNTS_') && !a.system_code?.startsWith('TAX_')).map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
              </Select>
            </Label>}
        <Label text="Date"><Input type="date" value={f.date} onChange={(e) => up({ date: e.target.value })} required /></Label>
        <BranchSelect value={f.branch} onChange={(v) => up({ branch: v })} />
        <Label text="Amount"><Input type="number" step="0.01" min="0.01" value={f.amount} onChange={(e) => up({ amount: e.target.value })} required /></Label>
        <Label text={path === 'receipts' ? 'Deposit to' : 'Paid from'}>
          <Select value={f.cash_account} onChange={(e) => up({ cash_account: e.target.value })} required>
            {cashAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Label>
        {mode === 'account' && <Label text="VAT included in the amount" hint="The amount is the cash total; the VAT is backed out of it."><TaxSelect rates={rates} value={taxRate} onChange={setTaxRate} /></Label>}
        <Label text="Method">
          <Select value={f.method} onChange={(e) => up({ method: e.target.value })}>
            {['cash', 'bank_transfer', 'cheque', 'card', 'other'].map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
          </Select>
        </Label>
        <Label text="Reference"><Input value={f.reference} onChange={(e) => up({ reference: e.target.value })} /></Label>
        <div className="sm:col-span-2"><Label text="Narration"><Input value={f.narration} onChange={(e) => up({ narration: e.target.value })} /></Label></div>
      </Card>
      {mode === 'party' && open.length > 0 && (
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
      {mode === 'account' && Number(taxRate) > 0 && Number(f.amount) > 0 && (
        <p className="text-sm text-slate-600">Of {money(f.amount)}: {money(Number(f.amount) - (Number(f.amount) * Number(taxRate)) / (100 + Number(taxRate)))} to the account and {money((Number(f.amount) * Number(taxRate)) / (100 + Number(taxRate)))} {path === 'receipts' ? 'output' : 'input'} VAT.</p>)}
      <div className="flex gap-2">
        <Button disabled={busy || (mode === 'party' && unapplied < 0)}>{busy ? 'Saving…' : 'Post'}</Button>
        <Button type="button" variant="ghost" onClick={() => nav(`/${path}`)}>Cancel</Button>
      </div>
    </form>
  )
}
