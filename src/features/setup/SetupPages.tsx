import { FormEvent, useState } from 'react'
import { api } from '../../api/client'
import { Account, TaxRate, accounts, orgs, parties, resource } from '../../api/endpoints'
import { DocumentActions } from '../../components/DocumentActions'
import { Badge, Button, Card, EmptyState, ErrorBox, Input, Label, Modal, PageHeader, Select, Spinner } from '../../components/ui'
import { accountTree } from '../../lib/accountTree'
import { useDebounced } from '../../lib/useDebounced'
import { useToast } from '../../lib/toast'
import { isReopening } from '../../lib/receiptFiles'
import { useFetch } from '../../lib/useFetch'
import { useAuth } from '../auth/AuthContext'

const kindLabel: Record<string, string> = { customer: 'Customer', supplier: 'Supplier', both: 'Customer & supplier' }

function StatementModal({ party, onClose }: { party: any; onClose(): void }) {
  const [range, setRange] = useState({ date_from: '', date_to: '' })
  const [side, setSide] = useState(party.kind === 'supplier' ? 'purchases' : 'sales')
  const q = { date_from: range.date_from || undefined, date_to: range.date_to || undefined, side }
  return (
    <Modal title={`Statement: ${party.name}`} onClose={onClose}>
      <div className="space-y-3">
        {party.kind === 'both' && <Label text="Statement of"><Select value={side} onChange={(e) => setSide(e.target.value)}><option value="sales">Sales (what they owe us)</option><option value="purchases">Purchases (what we owe them)</option></Select></Label>}
        <div className="grid grid-cols-2 gap-3">
          <Label text="From" hint="Empty = from the beginning"><Input type="date" value={range.date_from} onChange={(e) => setRange({ ...range, date_from: e.target.value })} /></Label>
          <Label text="To" hint="Empty = today"><Input type="date" value={range.date_to} onChange={(e) => setRange({ ...range, date_to: e.target.value })} /></Label>
        </div>
        <DocumentActions pdfPath={`/parties/${party.id}/statement-pdf/`} pdfQuery={q} emailPath={`/parties/${party.id}/statement-email/`}
          emailBody={q} defaultTo={party.email} defaultSubject={`Statement of account`} />
      </div>
    </Modal>
  )
}

export function PartiesPage() {
  const { org } = useAuth()
  const canWrite = org?.role !== 'viewer'
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [statementFor, setStatementFor] = useState<any>(null)
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
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Contact</th><th /></tr></thead>
          <tbody>
            {data?.results.map((p: any) => (
              <tr key={p.id} className="border-t border-slate-100"><td className="px-4 py-3 font-medium">{p.name}</td><td className="px-4 py-3">{kindLabel[p.kind]}</td><td className="px-4 py-3 text-slate-500">{[p.email, p.phone].filter(Boolean).join(' · ') || '—'}</td><td className="px-4 py-3 text-right"><Button variant="subtle" onClick={() => setStatementFor(p)}>Statement</Button></td></tr>
            ))}
          </tbody>
        </table>
        {loading && !data && <Spinner />}
        {data && !data.results.length && <EmptyState title="No one here yet" text="Add your first customer or supplier." action={canWrite && <Button onClick={() => setAdding(true)}>+ Add</Button>} />}
      </Card>
      {statementFor && <StatementModal party={statementFor} onClose={() => setStatementFor(null)} />}
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
  const canWrite = org?.role !== 'viewer'
  const toast = useToast()
  const [version, setVersion] = useState(0)
  const { data, loading, error } = useFetch(() => accounts.list(), [org?.id, version])
  const [editing, setEditing] = useState<Partial<Account> | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const groups = ['asset', 'liability', 'equity', 'income', 'expense']
  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing) return
    const body = { code: editing.code, name: editing.name, type: editing.type, is_cash_bank: !!editing.is_cash_bank, parent: editing.parent ?? null, ...(editing.id ? { is_active: editing.is_active !== false } : {}) }
    try {
      if (editing.id) await resource('accounts').update(editing.id, body)
      else await resource('accounts').create(body)
      toast.success(editing.id ? 'Account updated' : 'Account added')
      setEditing(null); setFormError(null); setVersion((v) => v + 1)
    } catch (err: any) { setFormError(err.message) }
  }
  const parents = (data ?? []).filter((a: Account) => a.type === editing?.type && a.is_active !== false && a.id !== editing?.id)
  return (
    <div>
      <PageHeader title="Chart of accounts" subtitle="Every account your transactions post to. Sub-accounts roll up into their parent."
        actions={canWrite && <Button onClick={() => { setFormError(null); setEditing({ type: 'expense', is_cash_bank: false, parent: null }) }}>+ New account</Button>} />
      <ErrorBox error={error} />
      {loading && !data && <Spinner />}
      {data && !data.length && <EmptyState title="No accounts yet" text="Accounts are created with the organization." />}
      <div className="space-y-4">
        {data && groups.map((g) => {
          const rows = accountTree(data.filter((a: Account) => a.type === g))
          return rows.length ? (
            <Card key={g} className="p-0">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold capitalize">{g === 'income' ? 'Income' : `${g}s`}</div>
              <table className="w-full text-sm"><tbody>
                {rows.map(({ account: a, depth }) => (
                  <tr key={a.id} className={`border-t border-slate-100 first:border-t-0 ${a.is_active === false ? 'text-slate-400' : ''}`}>
                    <td className="w-24 px-4 py-2 text-slate-500">{a.code}</td>
                    <td className="px-4 py-2" style={{ paddingLeft: 16 + depth * 20 }}>{depth > 0 && <span className="mr-1 text-slate-300">└</span>}{a.name}{a.is_active === false && ' (inactive)'}</td>
                    <td className="px-4 py-2 text-right">{a.is_cash_bank && <Badge value="cash / bank" tone="loaded" />}</td>
                    <td className="w-20 px-4 py-2 text-right">{canWrite && !a.system_code && <button className="text-xs text-brand-700 underline" onClick={() => { setFormError(null); setEditing(a) }}>Edit</button>}</td>
                  </tr>
                ))}
              </tbody></table>
            </Card>
          ) : null
        })}
      </div>
      {editing && (
        <Modal title={editing.id ? 'Edit account' : 'New account'} onClose={() => setEditing(null)}>
          <form className="space-y-3" onSubmit={save}>
            <ErrorBox error={formError} />
            <div className="grid grid-cols-3 gap-3">
              <Label text="Code"><Input autoFocus value={editing.code ?? ''} onChange={(e) => setEditing({ ...editing, code: e.target.value })} required /></Label>
              <div className="col-span-2"><Label text="Name"><Input value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required /></Label></div>
            </div>
            <Label text="Type">
              <Select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value, parent: null })}>
                {groups.map((g) => <option key={g} value={g}>{g[0].toUpperCase() + g.slice(1)}</option>)}
              </Select>
            </Label>
            <Label text="Parent account" hint="Optional. Makes this a sub-account of an account of the same type.">
              <Select value={editing.parent ?? ''} onChange={(e) => setEditing({ ...editing, parent: e.target.value ? Number(e.target.value) : null })}>
                <option value="">— none (top level) —</option>
                {parents.map((a: Account) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
              </Select>
            </Label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editing.is_cash_bank} onChange={(e) => setEditing({ ...editing, is_cash_bank: e.target.checked })} /> Cash or bank account</label>
            {editing.id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.is_active !== false} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Active</label>}
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button>{editing.id ? 'Save' : 'Add'}</Button></div>
          </form>
        </Modal>
      )}
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
      {canWrite && data && data.length > 0 && <BranchAccessCard branches={data.filter((b: any) => b.is_active)} />}
    </div>
  )
}

type Member = { id: number; username: string; role: string }
type Access = { id: number; membership: number; branch: number }

/** Owners/admins reach every branch. Accountants and viewers reach only the branches ticked here (none ticked = none). */
function BranchAccessCard({ branches }: { branches: { id: number; name: string }[] }) {
  const { org } = useAuth()
  const toast = useToast()
  const members = useFetch(() => resource<Member>('members').list(), [org?.id])
  const access = useFetch(() => resource<Access>('branch-access').list(), [org?.id])
  const [busy, setBusy] = useState<string | null>(null)
  const restricted = (members.data ?? []).filter((m) => m.role !== 'owner' && m.role !== 'admin')
  const find = (m: number, b: number) => (access.data ?? []).find((a) => a.membership === m && a.branch === b)
  const toggle = async (m: Member, b: { id: number; name: string }) => {
    const key = `${m.id}:${b.id}`
    setBusy(key)
    try {
      const row = find(m.id, b.id)
      if (row) await api(`/branch-access/${row.id}/`, { method: 'DELETE' })
      else await resource('branch-access').create({ membership: m.id, branch: b.id })
      access.reload()
    } catch (e: any) { toast.error(e.message) } finally { setBusy(null) }
  }
  return (
    <Card className="mt-4">
      <h2 className="font-medium">Branch access</h2>
      <p className="mb-3 text-sm text-slate-600">Owners and admins can use every branch. Everyone else can only see and post to the branches ticked below; a member with none ticked cannot work in any branch.</p>
      <ErrorBox error={members.error || access.error} />
      {!restricted.length && members.data && <p className="text-sm text-slate-500">No accountants or viewers in this organization yet.</p>}
      <ul>{restricted.map((m) => (
        <li key={m.id} className="border-t border-slate-100 py-2 first:border-t-0">
          <div className="mb-1 text-sm"><span className="font-medium">{m.username}</span> <span className="text-slate-500">({m.role})</span>
            {access.data && !branches.some((b) => find(m.id, b.id)) && <span className="ml-2 text-xs text-amber-700">no branches assigned</span>}</div>
          <div className="flex flex-wrap gap-4">{branches.map((b) => (
            <label key={b.id} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={!!find(m.id, b.id)} disabled={busy === `${m.id}:${b.id}` || !access.data} onChange={() => toggle(m, b)} /> {b.name}
            </label>
          ))}</div>
        </li>
      ))}</ul>
    </Card>
  )
}

export function PeriodLockPage() {
  const { org, refreshOrgs } = useAuth()
  const canWrite = org?.role === 'owner' || org?.role === 'admin'
  const toast = useToast()
  const current = org?.books_locked_through ?? null
  const [date, setDate] = useState(current ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const save = async (value: string | null) => {
    if (!org) return
    let reason: string | undefined
    if (isReopening(current, value)) {  // reopening settled periods: the server requires a reason and records it
      reason = window.prompt('Why are you reopening closed periods? This is recorded in the lock history.')?.trim()
      if (!reason) return
    }
    setBusy(true)
    try {
      await orgs.setLock(org.id, value, reason)
      await refreshOrgs()
      setDate(value ?? '')
      setError(null)
      toast.success(value ? `Books locked through ${value}` : 'All periods are open')
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <div className="max-w-2xl">
      <PageHeader title="Period lock" subtitle="Close the books through a date. Nothing dated on or before it can be posted or voided." />
      <ErrorBox error={error} />
      <Card className="mb-4">
        <p className="mb-3 text-sm text-slate-600">
          {current ? <>Books are locked through <span className="font-semibold">{current}</span> (inclusive). Reports and history stay fully visible.</> : 'No period is locked.'}
        </p>
        {canWrite ? (
          <form className="flex flex-wrap items-end gap-3" onSubmit={(e: FormEvent) => { e.preventDefault(); save(date || null) }}>
            <div className="w-56"><Label text="Lock through" hint="Cannot be in the future"><Input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} /></Label></div>
            <Button disabled={busy || !date || date === current}>Save lock</Button>
            {current && <Button type="button" variant="subtle" disabled={busy} onClick={() => save(null)}>Reopen all periods</Button>}
          </form>
        ) : <p className="text-sm text-slate-500">Only owners and admins can change the lock.</p>}
      </Card>
      <FiscalYearCard canWrite={canWrite} />
      {canWrite && <LockHistoryCard />}
      <p className="text-xs text-slate-500">The lock is enforced by the server for every sales, purchase, receipt, payment and voucher document, including voiding. Moving it back needs a reason and is recorded below; a closed fiscal year can only be reopened by the owner.</p>
    </div>
  )
}

function FiscalYearCard({ canWrite }: { canWrite: boolean }) {
  const { org, refreshOrgs } = useAuth()
  const toast = useToast()
  const [tick, setTick] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { data, loading } = useFetch(() => (org ? orgs.fiscalYears(org.id) : Promise.resolve(null)), [org?.id, tick])
  const reopen = async (yearEnd: string) => {
    if (!org) return
    const reason = window.prompt(`Reopen the fiscal year ending ${yearEnd}? Postings in that year become possible again. Reason (recorded):`)?.trim()
    if (!reason) return
    setBusy(true)
    try { await orgs.reopenYear(org.id, yearEnd, reason); await refreshOrgs(); setTick((t) => t + 1); setError(null); toast.success('Fiscal year reopened') } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }
  const close = async () => {
    if (!org || !data?.next_year_end) return
    if (!confirm(`Close the fiscal year ending ${data.next_year_end}? The books will be locked through that date. The owner can reopen it later from this page, with a recorded reason.`)) return
    setBusy(true)
    try {
      const r = await orgs.closeYear(org.id, data.next_year_end)
      await refreshOrgs()
      setTick((t) => t + 1)
      setError(null)
      toast.success(`Fiscal year to ${r.year_end} closed. Profit carried forward: ${r.net_profit}`)
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <Card className="mb-4">
      <h2 className="mb-2 text-sm font-semibold">Fiscal year close</h2>
      <ErrorBox error={error} />
      {loading ? <Spinner /> : (
        <>
          <p className="mb-3 text-sm text-slate-600">
            {data?.next_year_end ? <>The fiscal year ending <span className="font-semibold">{data.next_year_end}</span> is complete and can be closed.</> : 'No completed fiscal year is waiting to be closed.'}
            {' '}Closing locks the books through year end. Profit and loss for the year stays readable, and the balance sheet carries the profit forward as retained earnings.
          </p>
          {canWrite && <Button disabled={busy || !data?.next_year_end} onClick={close}>{busy ? 'Closing…' : 'Close fiscal year'}</Button>}
          {!!data?.closes.length && (
            <table className="mt-4 w-full text-sm">
              <thead><tr className="text-left text-slate-500"><th>Year</th><th className="text-right">Profit</th><th>Closed by</th><th /></tr></thead>
              <tbody>{data.closes.map((c, i) => <tr key={c.id}><td>{c.year_start} → {c.year_end}</td><td className="text-right">{c.net_profit}</td><td>{c.closed_by_name ?? ''}</td>
                <td className="text-right">{c.reopened_at ? <span className="text-slate-500">Reopened: {c.reopen_reason}</span> : org?.role === 'owner' && data.closes.findIndex((x) => !x.reopened_at) === i && <button type="button" className="text-indigo-600 underline" disabled={busy} onClick={() => reopen(c.year_end)}>Reopen</button>}</td></tr>)}</tbody>
            </table>
          )}
        </>
      )}
    </Card>
  )
}

const SOURCE: Record<string, string> = { manual: 'Edited', fiscal_close: 'Year closed', fiscal_reopen: 'Year reopened' }

/** Who moved the period lock, when, and why. */
function LockHistoryCard() {
  const { org } = useAuth()
  const { data, loading } = useFetch(() => (org ? orgs.lockHistory(org.id) : Promise.resolve([])), [org?.id, org?.books_locked_through])
  return (
    <Card className="mb-4">
      <h2 className="mb-2 text-sm font-semibold">Lock history</h2>
      {loading ? <Spinner /> : !data?.length ? <p className="text-sm text-slate-500">No changes recorded yet.</p> : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-500"><th>When</th><th>By</th><th>Change</th><th>Lock</th><th>Reason</th></tr></thead>
          <tbody>{data.map((r) => <tr key={r.id} className="border-t"><td>{r.at.slice(0, 16).replace('T', ' ')}</td><td>{r.by ?? ''}</td><td>{SOURCE[r.source] ?? r.source}</td><td>{r.old_value ?? 'open'} → {r.new_value ?? 'open'}</td><td>{r.reason}</td></tr>)}</tbody>
        </table>
      )}
    </Card>
  )
}

/** Approval workflow switches. Off by default; when on, matching expenses / purchase bills wait for an owner or admin. */
export function ApprovalSettingsPage() {
  const { org, refreshOrgs } = useAuth()
  const toast = useToast()
  const canWrite = org?.role === 'owner' || org?.role === 'admin'
  const [exp, setExp] = useState(!!org?.expense_approval_required)
  const [bill, setBill] = useState(!!org?.bill_approval_required)
  const [min, setMin] = useState(org?.approval_min_amount ?? '0')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!org) return
    setBusy(true)
    try { await orgs.setApproval(org.id, { expense_approval_required: exp, bill_approval_required: bill, approval_min_amount: min || '0' }); await refreshOrgs(); setError(null); toast.success('Approval settings saved') } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <div className="max-w-2xl">
      <PageHeader title="Approvals" subtitle="Hold expenses and purchase bills until an owner or admin approves them. Nothing is posted to the books while a document waits." />
      <ErrorBox error={error} />
      <Card>
        <form className="space-y-3" onSubmit={save}>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!canWrite} checked={exp} onChange={(e) => setExp(e.target.checked)} /> Expenses need approval</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!canWrite} checked={bill} onChange={(e) => setBill(e.target.checked)} /> Purchase bills need approval (purchase returns are never held)</label>
          <div className="w-64"><Label text="Only for totals of at least" hint="0 = every document"><Input type="number" min="0" step="0.01" disabled={!canWrite} value={min} onChange={(e) => setMin(e.target.value)} /></Label></div>
          {canWrite ? <Button disabled={busy}>Save</Button> : <p className="text-sm text-slate-500">Only owners and admins can change this.</p>}
        </form>
      </Card>
      <p className="mt-3 text-xs text-slate-500">An admin cannot approve a document they created themselves; the owner can. The period lock, branch access and stock costing are checked when a document is approved, so a document held past a lock date cannot be approved until the lock is changed.</p>
    </div>
  )
}
