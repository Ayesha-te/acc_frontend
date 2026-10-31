import { FormEvent, useState } from 'react'
import { Account, TaxRate, accounts, orgs, parties, resource } from '../../api/endpoints'
import { Badge, Button, Card, EmptyState, ErrorBox, Input, Label, Modal, PageHeader, Select, Spinner } from '../../components/ui'
import { useDebounced } from '../../lib/useDebounced'
import { useToast } from '../../lib/toast'
import { useFetch } from '../../lib/useFetch'
import { useAuth } from '../auth/AuthContext'

const kindLabel: Record<string, string> = { customer: 'Customer', supplier: 'Supplier', both: 'Customer & supplier' }

export function PartiesPage() {
  const { org } = useAuth()
  const canWrite = org?.role !== 'viewer'
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState('')
  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [form, setForm] = useState({ name: '', kind: 'customer', email: '', phone: '' })
  const [error, setError] = useState<string | null>(null)
  const { data, loading, error: loadError, reload } = useFetch(() => parties.list({ kind, search: q }), [org?.id, kind, q])

  const add = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await parties.create(form)
      toast.success(`${form.name} added`)
      setAdding(false); setForm({ ...form, name: '', email: '', phone: '' }); setError(null); reload()
    } catch (err: any) { setError(err.message.replace(/^non_field_errors: /, '')) }
  }
  return (
    <div>
      <PageHeader title="Customers & suppliers" subtitle="The people and companies you trade with" actions={canWrite && <Button onClick={() => setAdding(true)}>+ Add</Button>} />
      <Card className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-[14rem] flex-1"><Input placeholder="Search name, email, phone…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" /></div>
        <Select className="w-52" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type filter">
          <option value="">Everyone</option><option value="customer">Customers</option><option value="supplier">Suppliers</option><option value="both">Both</option>
        </Select>
      </Card>
      <ErrorBox error={loadError} />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Contact</th></tr></thead>
          <tbody>
            {data?.results.map((p: any) => (
              <tr key={p.id} className="border-t border-slate-100"><td className="px-4 py-3 font-medium">{p.name}</td><td className="px-4 py-3">{kindLabel[p.kind]}</td><td className="px-4 py-3 text-slate-500">{[p.email, p.phone].filter(Boolean).join(' · ') || '—'}</td></tr>
            ))}
          </tbody>
        </table>
        {loading && !data && <Spinner />}
        {data && !data.results.length && <EmptyState title="No one here yet" text="Add your first customer or supplier." action={canWrite && <Button onClick={() => setAdding(true)}>+ Add</Button>} />}
      </Card>
      {adding && (
        <Modal title="New customer or supplier" onClose={() => setAdding(false)}>
          <form className="space-y-3" onSubmit={add}>
            <ErrorBox error={error} />
            <Label text="Name"><Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Label>
            <Label text="Type">
              <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="customer">Customer</option><option value="supplier">Supplier</option><option value="both">Both</option>
              </Select>
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <Label text="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Label>
              <Label text="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Label>
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button><Button>Add</Button></div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export function AccountsPage() {
  const { org } = useAuth()
  const { data, loading, error } = useFetch(() => accounts.list(), [org?.id])
  const groups = ['asset', 'liability', 'equity', 'income', 'expense']
  return (
    <div>
      <PageHeader title="Chart of accounts" subtitle="Every account your transactions post to" />
      <ErrorBox error={error} />
      {loading && !data && <Spinner />}
      <div className="space-y-4">
        {data && groups.map((g) => {
          const rows = data.filter((a: Account) => a.type === g)
          return rows.length ? (
            <Card key={g} className="p-0">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold capitalize">{g === 'income' ? 'Income' : `${g}s`}</div>
              <table className="w-full text-sm"><tbody>
                {rows.map((a: Account) => <tr key={a.id} className="border-t border-slate-100 first:border-t-0"><td className="w-24 px-4 py-2 text-slate-500">{a.code}</td><td className="px-4 py-2">{a.name}</td><td className="px-4 py-2 text-right">{a.is_cash_bank && <Badge value="cash / bank" tone="loaded" />}</td></tr>)}
              </tbody></table>
            </Card>
          ) : null
        })}
      </div>
    </div>
  )
}

export function OrganizationsPage() {
  const { orgs: list, refreshOrgs, selectOrg } = useAuth()
  const toast = useToast()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('AED')
  const [error, setError] = useState<string | null>(null)
  const add = async (e: FormEvent) => {
    e.preventDefault()
    try { const o = await orgs.create(name, currency.toUpperCase()); await refreshOrgs(); selectOrg(o.id); toast.success(`${o.name} created`); setName(''); setError(null) } catch (err: any) { setError(err.message) }
  }
  return (
    <div className="max-w-2xl">
      <PageHeader title="Organizations" subtitle="Each organization keeps completely separate accounting data" />
      <ErrorBox error={error} />
      <Card className="mb-4">
        <form className="flex flex-wrap items-end gap-3" onSubmit={add}>
          <div className="min-w-[14rem] flex-1"><Label text="New organization name"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Label></div>
          <div className="w-28"><Label text="Currency" hint="3-letter code"><Input value={currency} maxLength={3} minLength={3} onChange={(e) => setCurrency(e.target.value)} required /></Label></div>
          <Button>Create organization</Button>
        </form>
      </Card>
      <Card className="p-0">
        <ul>{list.map((o) => (
          <li key={o.id} className="flex items-center justify-between border-t border-slate-100 px-4 py-3 first:border-t-0">
            <span className="font-medium">{o.name}</span><span className="flex items-center gap-3 text-sm text-slate-500">{o.role}<Button variant="subtle" onClick={() => selectOrg(o.id)}>Open</Button></span>
          </li>
        ))}</ul>
        {!list.length && <EmptyState title="No organizations yet" text="Create your first one above to unlock the rest of the app." />}
      </Card>
    </div>
  )
}

export function TaxRatesPage() {
  const { org } = useAuth()
  const canWrite = org?.role === 'owner' || org?.role === 'admin' || org?.role === 'accountant'
  const toast = useToast()
  const rates = resource<TaxRate>('tax-rates')
  const { data, loading, error: loadError, reload } = useFetch(() => rates.list(), [org?.id])
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ name: '', rate: '', is_default: false })
  const [error, setError] = useState<string | null>(null)
  const add = async (e: FormEvent) => {
    e.preventDefault()
    try { await rates.create(f); toast.success(`${f.name} added`); setAdding(false); setF({ name: '', rate: '', is_default: false }); setError(null); reload() } catch (err: any) { setError(err.message) }
  }
  const patch = async (r: TaxRate, body: object) => { try { await rates.update(r.id, body); reload() } catch (e: any) { toast.error(e.message) } }
  return (
    <div className="max-w-3xl">
      <PageHeader title="Tax rates" subtitle="Enter the rates your business uses (for example VAT). They appear as a list on invoices."
        actions={canWrite && <Button onClick={() => setAdding(true)}>+ Add rate</Button>} />
      <p className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">No rates are pre-loaded: you decide the name and percentage. Changing or deactivating a rate never alters invoices already posted.</p>
      <ErrorBox error={loadError} />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3 text-right">Rate</th><th className="px-4 py-3">Default</th><th className="px-4 py-3">Status</th><th /></tr></thead>
          <tbody>
            {data?.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{r.name}</td><td className="px-4 py-3 text-right tabular-nums">{Number(r.rate)}%</td>
                <td className="px-4 py-3">{r.is_default ? <Badge value="default" tone="loaded" /> : canWrite && <Button variant="subtle" onClick={() => patch(r, { is_default: true })}>Make default</Button>}</td>
                <td className="px-4 py-3"><Badge value={r.is_active ? 'active' : 'inactive'} tone={r.is_active ? 'posted' : 'void'} /></td>
                <td className="px-4 py-3 text-right">{canWrite && <Button variant="subtle" onClick={() => patch(r, { is_active: !r.is_active })}>{r.is_active ? 'Deactivate' : 'Activate'}</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && !data && <Spinner />}
        {data && !data.length && <EmptyState title="No tax rates yet" text="Add the rate(s) that apply to your sales and purchases." action={canWrite && <Button onClick={() => setAdding(true)}>+ Add rate</Button>} />}
      </Card>
      {adding && (
        <Modal title="New tax rate" onClose={() => setAdding(false)}>
          <form className="space-y-3" onSubmit={add}>
            <ErrorBox error={error} />
            <Label text="Name" hint="For example: VAT standard"><Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Label>
            <Label text="Rate (%)"><Input type="number" step="0.01" min="0" max="100" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} required /></Label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_default} onChange={(e) => setF({ ...f, is_default: e.target.checked })} /> Use as the default on new invoices</label>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button><Button>Add rate</Button></div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export function BranchesPage() {
  const { org } = useAuth()
  const canWrite = org?.role === 'owner' || org?.role === 'admin'
  const toast = useToast()
  const branches = resource<any>('branches')
  const { data, loading, error: loadError, reload } = useFetch(() => branches.list(), [org?.id])
  const [f, setF] = useState({ name: '', code: '' })
  const [error, setError] = useState<string | null>(null)
  const add = async (e: FormEvent) => {
    e.preventDefault()
    try { await branches.create(f); toast.success(`${f.name} added`); setF({ name: '', code: '' }); setError(null); reload() } catch (err: any) { setError(err.message) }
  }
  return (
    <div className="max-w-2xl">
      <PageHeader title="Branches" subtitle="Optional locations or departments inside this organization" />
      <ErrorBox error={loadError || error} />
      {canWrite && (
        <Card className="mb-4">
          <form className="flex flex-wrap items-end gap-3" onSubmit={add}>
            <div className="min-w-[12rem] flex-1"><Label text="Branch name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Label></div>
            <div className="w-32"><Label text="Code"><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Label></div>
            <Button>Add branch</Button>
          </form>
        </Card>
      )}
      <Card className="p-0">
        {loading && !data && <Spinner />}
        <ul>{data?.map((b: any) => (
          <li key={b.id} className="flex items-center justify-between border-t border-slate-100 px-4 py-3 first:border-t-0">
            <span><span className="font-medium">{b.name}</span> {b.code && <span className="text-slate-500">({b.code})</span>}</span>
            <span className="flex items-center gap-2"><Badge value={b.is_active ? 'active' : 'inactive'} tone={b.is_active ? 'posted' : 'void'} />
              {canWrite && <Button variant="subtle" onClick={async () => { try { await branches.update(b.id, { is_active: !b.is_active }); reload() } catch (e: any) { toast.error(e.message) } }}>{b.is_active ? 'Deactivate' : 'Activate'}</Button>}</span>
          </li>
        ))}</ul>
        {data && !data.length && <EmptyState title="No branches" text="You can work without branches. Add one only if you need to separate activity by location." />}
      </Card>
    </div>
  )
}
