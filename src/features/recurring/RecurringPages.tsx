import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { accounts, resource } from '../../api/endpoints'
import { BranchSelect } from '../../components/BranchSelect'
import { PartySelect } from '../../components/PartySelect'
import { TaxSelect, useTaxRates } from '../../components/TaxSelect'
import { Badge, Button, Card, EmptyState, ErrorBox, Input, Label, PageHeader, Select, Spinner } from '../../components/ui'
import { money, todayDubai } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'
import { useSubmit } from '../../lib/useSubmit'
import { useToast } from '../../lib/toast'
import { useAuth } from '../auth/AuthContext'

const profiles = resource('recurring')

export function RecurringPage() {
  const { org } = useAuth()
  const toast = useToast()
  const canWrite = !!org && org.role !== 'viewer'
  const list = useFetch(() => profiles.page({ page_size: 100 }), [org?.id])
  const [error, setError] = useState<string | null>(null)
  const act = async (id: number, action: string, msg: string) => {
    setError(null)
    try {
      const r = await profiles.act(id, action)
      if (action === 'run-now') toast.success(r.created.length ? `Created ${r.created.length} document(s)` : r.last_error ? 'Could not create: ' + r.last_error : 'Nothing is due')
      else toast.success(msg)
      list.reload()
    } catch (e: any) { setError(e.message) }
  }
  return (
    <div className="max-w-6xl space-y-4">
      <PageHeader title="Recurring invoices and bills" subtitle="Repeat an invoice or bill on a schedule. Due documents are created and posted automatically (a daily job runs them; you can also run one now)."
        actions={canWrite && <Link to="/recurring/new"><Button>+ New profile</Button></Link>} />
      <ErrorBox error={error ?? list.error} />
      <Card className="overflow-x-auto p-0">
        {list.loading && !list.data ? <Spinner /> : !list.data?.results.length ? <EmptyState title="No recurring profiles yet" text="Create one to repeat an invoice or bill." /> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Name</th><th>Type</th><th>Party</th><th>Repeats</th><th>Next</th><th>Created</th><th>Status</th><th /></tr></thead>
            <tbody>{list.data.results.map((p: any) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{p.name}{p.last_error && <div className="text-xs text-red-700">Last attempt failed: {p.last_error}</div>}</td>
                <td>{p.side === 'sales' ? 'Invoice' : 'Bill'}</td><td>{p.party_name}</td>
                <td>every {p.interval} {p.frequency}</td><td>{p.next_date ?? 'finished'}</td><td>{p.generated}</td>
                <td><Badge value={p.is_active ? 'active' : 'paused'} tone={p.is_active ? 'posted' : undefined} /></td>
                <td className="space-x-1 px-4 py-3 text-right whitespace-nowrap">{canWrite && (<>
                  <Button variant="subtle" onClick={() => act(p.id, 'run-now', '')}>Run now</Button>
                  {p.is_active ? <Button variant="subtle" onClick={() => act(p.id, 'pause', 'Paused')}>Pause</Button> : <Button variant="subtle" onClick={() => act(p.id, 'resume', 'Resumed')}>Resume</Button>}
                </>)}</td>
              </tr>))}</tbody>
          </table>)}
      </Card>
    </div>
  )
}

type Item = { description: string; quantity: string; unit_price: string; tax_rate: string }
export function RecurringForm() {
  const nav = useNavigate()
  const toast = useToast()
  const rates = useTaxRates().data
  const [side, setSide] = useState<'sales' | 'purchases'>('sales')
  const [f, setF] = useState({ name: '', party: '', branch: '', frequency: 'monthly', interval: '1', start_date: todayDubai(), end_date: '', due_days: '0', narration: '' })
  const [items, setItems] = useState<Item[]>([{ description: '', quantity: '1', unit_price: '', tax_rate: '0' }])
  const up = (patch: Partial<typeof f>) => setF({ ...f, ...patch })
  const set = (i: number, patch: Partial<Item>) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  const { submit, busy, error } = useSubmit(
    () => profiles.create({ side, ...f, party: Number(f.party), branch: f.branch ? Number(f.branch) : null, interval: Number(f.interval), due_days: Number(f.due_days), end_date: f.end_date || null, items }),
    () => { toast.success('Profile saved'); nav('/recurring') },
  )
  return (
    <form className="max-w-4xl space-y-4" onSubmit={(e) => { e.preventDefault(); submit() }}>
      <PageHeader title="New recurring profile" />
      <ErrorBox error={error} />
      <Card className="grid gap-3 sm:grid-cols-3">
        <Label text="Creates"><Select value={side} onChange={(e) => { setSide(e.target.value as any); up({ party: '' }) }}><option value="sales">Sales invoices</option><option value="purchases">Purchase bills</option></Select></Label>
        <Label text="Profile name"><Input value={f.name} onChange={(e) => up({ name: e.target.value })} required /></Label>
        <Label text={side === 'sales' ? 'Customer' : 'Supplier'}><PartySelect key={side} kind={side === 'sales' ? 'customer' : 'supplier'} value={f.party} onChange={(v) => up({ party: v })} /></Label>
        <Label text="Repeat every"><div className="flex gap-2"><Input type="number" min="1" value={f.interval} onChange={(e) => up({ interval: e.target.value })} required />
          <Select value={f.frequency} onChange={(e) => up({ frequency: e.target.value })}><option value="daily">day(s)</option><option value="weekly">week(s)</option><option value="monthly">month(s)</option><option value="yearly">year(s)</option></Select></div></Label>
        <Label text="First date"><Input type="date" value={f.start_date} onChange={(e) => up({ start_date: e.target.value })} required /></Label>
        <Label text="End date" hint="Optional"><Input type="date" value={f.end_date} min={f.start_date} onChange={(e) => up({ end_date: e.target.value })} /></Label>
        <Label text="Payment terms (days)"><Input type="number" min="0" value={f.due_days} onChange={(e) => up({ due_days: e.target.value })} /></Label>
        <BranchSelect value={f.branch} onChange={(v) => up({ branch: v })} />
        <div className="sm:col-span-3"><Label text="Narration"><Input value={f.narration} onChange={(e) => up({ narration: e.target.value })} /></Label></div>
      </Card>
      <Card className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <Input className="col-span-12 sm:col-span-4" placeholder="Description" value={it.description} onChange={(e) => set(i, { description: e.target.value })} required />
            <Input className="col-span-4 sm:col-span-2" type="number" step="any" min="0" value={it.quantity} onChange={(e) => set(i, { quantity: e.target.value })} required aria-label="Quantity" />
            <Input className="col-span-4 sm:col-span-2" type="number" step="any" min="0" value={it.unit_price} onChange={(e) => set(i, { unit_price: e.target.value })} required aria-label="Unit price" />
            <div className="col-span-8 sm:col-span-3"><TaxSelect rates={rates} value={it.tax_rate} onChange={(v) => set(i, { tax_rate: v })} /></div>
            <Button type="button" variant="ghost" className="col-span-1" disabled={items.length === 1} onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Remove line">×</Button>
          </div>
        ))}
        <Button type="button" variant="ghost" onClick={() => setItems([...items, { description: '', quantity: '1', unit_price: '', tax_rate: '0' }])}>+ Add line</Button>
      </Card>
      <div className="flex gap-2"><Button disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</Button><Button type="button" variant="ghost" onClick={() => nav('/recurring')}>Cancel</Button></div>
    </form>
  )
}

// ---- Recurring expenses ----------------------------------------------------------------------------------------------

const expenseProfiles = resource('recurring-expenses')

export function RecurringExpensesPage() {
  const { org } = useAuth()
  const toast = useToast()
  const canWrite = !!org && org.role !== 'viewer'
  const list = useFetch(() => expenseProfiles.page({ page_size: 100 }), [org?.id])
  const [error, setError] = useState<string | null>(null)
  const act = async (id: number, action: string, msg: string) => {
    setError(null)
    try {
      const r = await expenseProfiles.act(id, action)
      if (action === 'run-now') toast.success(r.created.length ? `Created ${r.created.length} expense(s)` : r.last_error ? 'Could not create: ' + r.last_error : 'Nothing is due')
      else toast.success(msg)
      list.reload()
    } catch (e: any) { setError(e.message) }
  }
  return (
    <div className="max-w-6xl space-y-4">
      <PageHeader title="Recurring expenses" subtitle="Repeat rent, subscriptions and other regular costs. Due expenses are created and posted automatically (a daily job runs them; you can also run one now)."
        actions={canWrite && <Link to="/recurring-expenses/new"><Button>+ New profile</Button></Link>} />
      <ErrorBox error={error ?? list.error} />
      <Card className="overflow-x-auto p-0">
        {list.loading && !list.data ? <Spinner /> : !list.data?.results.length ? <EmptyState title="No recurring expenses yet" text="Create one to repeat a regular expense." /> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Name</th><th>Category</th><th>Paid through</th><th className="text-right">Amount</th><th>Repeats</th><th>Next</th><th>Created</th><th>Status</th><th /></tr></thead>
            <tbody>{list.data.results.map((p: any) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{p.name}{p.last_error && <div className="text-xs text-red-700">Last attempt failed: {p.last_error}</div>}</td>
                <td>{p.expense_account_name}</td><td>{p.paid_through_name}</td><td className="text-right tabular-nums">{money(p.amount)}</td>
                <td>every {p.interval} {p.frequency}</td><td>{p.next_date ?? 'finished'}</td><td>{p.generated}</td>
                <td><Badge value={p.is_active ? 'active' : 'paused'} tone={p.is_active ? 'posted' : undefined} /></td>
                <td className="space-x-1 px-4 py-3 text-right whitespace-nowrap">{canWrite && (<>
                  <Button variant="subtle" onClick={() => act(p.id, 'run-now', '')}>Run now</Button>
                  {p.is_active ? <Button variant="subtle" onClick={() => act(p.id, 'pause', 'Paused')}>Pause</Button> : <Button variant="subtle" onClick={() => act(p.id, 'resume', 'Resumed')}>Resume</Button>}
                </>)}</td>
              </tr>))}</tbody>
          </table>)}
      </Card>
    </div>
  )
}

export function RecurringExpenseForm() {
  const nav = useNavigate()
  const toast = useToast()
  const rates = useTaxRates().data
  const accts = useFetch(() => accounts.list(), [])
  const [f, setF] = useState({ name: '', expense_account: '', paid_through: '', vendor: '', branch: '', amount: '', tax_rate: '0', inclusive: false,
    frequency: 'monthly', interval: '1', start_date: todayDubai(), end_date: '', reference: '', narration: '' })
  const up = (patch: Partial<typeof f>) => setF({ ...f, ...patch })
  const { submit, busy, error } = useSubmit(
    () => expenseProfiles.create({
      name: f.name, expense_account: Number(f.expense_account), paid_through: Number(f.paid_through), vendor: f.vendor ? Number(f.vendor) : null,
      branch: f.branch ? Number(f.branch) : null, amount: f.amount, tax_rate: f.tax_rate || '0', amount_includes_tax: f.inclusive,
      frequency: f.frequency, interval: Number(f.interval), start_date: f.start_date, end_date: f.end_date || null, reference: f.reference, narration: f.narration }),
    () => { toast.success('Profile saved'); nav('/recurring-expenses') },
  )
  const all = accts.data ?? []
  return (
    <form className="max-w-4xl space-y-4" onSubmit={(e) => { e.preventDefault(); submit() }}>
      <PageHeader title="New recurring expense" />
      <ErrorBox error={error ?? accts.error} />
      {accts.loading && !accts.data && <Spinner />}
      <Card className="grid gap-3 sm:grid-cols-3">
        <Label text="Profile name"><Input value={f.name} onChange={(e) => up({ name: e.target.value })} required /></Label>
        <Label text="Category (expense account)">
          <Select value={f.expense_account} onChange={(e) => up({ expense_account: e.target.value })} required>
            <option value="">Select…</option>
            {all.filter((a) => a.type === 'expense' && a.is_active !== false).map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
          </Select>
        </Label>
        <Label text="Paid through">
          <Select value={f.paid_through} onChange={(e) => up({ paid_through: e.target.value })} required>
            <option value="">Select…</option>
            {all.filter((a) => a.is_cash_bank && a.is_active !== false).map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
          </Select>
        </Label>
        <Label text="Amount"><Input type="number" step="any" min="0" value={f.amount} onChange={(e) => up({ amount: e.target.value })} required /></Label>
        <Label text="Tax"><TaxSelect rates={rates} value={f.tax_rate} onChange={(v) => up({ tax_rate: v })} /></Label>
        <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={f.inclusive} onChange={(e) => up({ inclusive: e.target.checked })} /> Amount includes tax</label>
        <Label text="Repeat every"><div className="flex gap-2"><Input type="number" min="1" value={f.interval} onChange={(e) => up({ interval: e.target.value })} required />
          <Select value={f.frequency} onChange={(e) => up({ frequency: e.target.value })}><option value="daily">day(s)</option><option value="weekly">week(s)</option><option value="monthly">month(s)</option><option value="yearly">year(s)</option></Select></div></Label>
        <Label text="First date"><Input type="date" value={f.start_date} onChange={(e) => up({ start_date: e.target.value })} required /></Label>
        <Label text="End date" hint="Optional"><Input type="date" value={f.end_date} min={f.start_date} onChange={(e) => up({ end_date: e.target.value })} /></Label>
        <Label text="Vendor" hint="Optional"><PartySelect kind="supplier" value={f.vendor} onChange={(v) => up({ vendor: v })} /></Label>
        <BranchSelect value={f.branch} onChange={(v) => up({ branch: v })} />
        <Label text="Reference"><Input value={f.reference} onChange={(e) => up({ reference: e.target.value })} /></Label>
        <div className="sm:col-span-3"><Label text="Narration"><Input value={f.narration} onChange={(e) => up({ narration: e.target.value })} /></Label></div>
      </Card>
      <div className="flex gap-2"><Button disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</Button><Button type="button" variant="ghost" onClick={() => nav('/recurring-expenses')}>Cancel</Button></div>
    </form>
  )
}
