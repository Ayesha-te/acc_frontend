import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Account, Party, accounts, orgs, parties } from '../../api/endpoints'
import { Button, Card, ErrorBox, Input, Label, Select } from '../../components/ui'
import { useAuth } from '../auth/AuthContext'

export function PartiesPage() {
  const { org } = useAuth()
  const canWrite = org?.role !== 'viewer'
  const [rows, setRows] = useState<Party[]>([])
  const [form, setForm] = useState({ name: '', kind: 'customer' })
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => { parties.list().then((r) => setRows(r.results)).catch((e) => setError(e.message)) }, [])
  useEffect(load, [load, org?.id])
  const add = async (e: FormEvent) => {
    e.preventDefault()
    try { await parties.create(form); setForm({ ...form, name: '' }); setError(null); load() } catch (err: any) { setError(err.message) }
  }
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">Customers &amp; suppliers</h1>
      <ErrorBox error={error} />
      {canWrite && (
        <Card><form className="flex flex-wrap items-end gap-2" onSubmit={add}>
          <Label text="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Label>
          <Label text="Type">
            <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="customer">Customer</option><option value="supplier">Supplier</option><option value="both">Both</option>
            </Select>
          </Label>
          <Button>Add</Button>
        </form></Card>
      )}
      <Card className="p-0"><table className="w-full text-sm">
        <thead className="bg-slate-100 text-left"><tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Type</th></tr></thead>
        <tbody>{rows.map((p) => <tr key={p.id} className="border-t"><td className="px-3 py-2">{p.name}</td><td className="px-3 py-2">{p.kind}</td></tr>)}</tbody>
      </table></Card>
    </div>
  )
}

export function AccountsPage() {
  const { org } = useAuth()
  const [rows, setRows] = useState<Account[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { accounts.list().then(setRows).catch((e) => setError(e.message)) }, [org?.id])
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">Chart of accounts</h1>
      <ErrorBox error={error} />
      <Card className="p-0"><table className="w-full text-sm">
        <thead className="bg-slate-100 text-left"><tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Type</th></tr></thead>
        <tbody>{rows.map((a) => <tr key={a.id} className="border-t"><td className="px-3 py-2">{a.code}</td><td className="px-3 py-2">{a.name}</td><td className="px-3 py-2">{a.type}</td></tr>)}</tbody>
      </table></Card>
    </div>
  )
}

export function OrganizationsPage() {
  const { orgs: list, refreshOrgs, selectOrg } = useAuth()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const add = async (e: FormEvent) => {
    e.preventDefault()
    try { const o = await orgs.create(name, 'USD'); await refreshOrgs(); selectOrg(o.id); setName(''); setError(null) } catch (err: any) { setError(err.message) }
  }
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Organizations</h1>
      <ErrorBox error={error} />
      <Card><form className="flex items-end gap-2" onSubmit={add}>
        <Label text="New organization name"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Label>
        <Button>Create</Button>
      </form></Card>
      <Card className="p-0"><ul>{list.map((o) => <li key={o.id} className="flex justify-between border-t px-3 py-2 first:border-t-0"><span>{o.name}</span><span className="text-slate-500">{o.role}</span></li>)}</ul></Card>
    </div>
  )
}
