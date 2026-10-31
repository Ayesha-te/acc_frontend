import { FormEvent, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Item, Location, documents, resource } from '../../api/endpoints'
import { Badge, Button, Card, EmptyState, ErrorBox, Input, Label, Modal, PageHeader, Select, Spinner } from '../../components/ui'
import { todayDubai } from '../../lib/format'
import { useToast } from '../../lib/toast'
import { useFetch } from '../../lib/useFetch'
import { useSubmit } from '../../lib/useSubmit'
import { useAuth } from '../auth/AuthContext'

const items = resource<Item>('inventory/items')
const locations = resource<Location>('inventory/locations')
const kindLabel = (k: string) => (k === 'raw_material' ? 'Raw material' : 'Finished good')
const qty = (v: string | number) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 })

export function ItemsPage() {
  const { org } = useAuth()
  const canWrite = org?.role !== 'viewer'
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ sku: '', name: '', kind: 'raw_material', unit: 'kg' })
  const [error, setError] = useState<string | null>(null)
  const { data, loading, error: loadError, reload } = useFetch(() => items.list(), [org?.id])

  const add = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await items.create(f)
      toast.success(`${f.name} added`)
      setAdding(false); setF({ ...f, sku: '', name: '' }); setError(null); reload()
    } catch (err: any) { setError(err.message) }
  }
  const toggle = async (it: Item) => {
    try { await items.update(it.id, { is_active: !it.is_active }); reload() } catch (err: any) { toast.error(err.message) }
  }

  return (
    <div>
      <PageHeader title="Items" subtitle="Raw materials you consume and finished goods you make or sell"
        actions={canWrite && <Button onClick={() => setAdding(true)}>+ Add item</Button>} />
      <ErrorBox error={loadError} />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">SKU</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Unit</th><th className="px-4 py-3">Status</th><th /></tr>
          </thead>
          <tbody>
            {data?.map((it) => (
              <tr key={it.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-xs">{it.sku}</td><td className="px-4 py-3 font-medium">{it.name}</td>
                <td className="px-4 py-3">{kindLabel(it.kind)}</td><td className="px-4 py-3">{it.unit}</td>
                <td className="px-4 py-3"><Badge value={it.is_active ? 'posted' : 'void'} tone={it.is_active ? 'posted' : 'void'} /></td>
                <td className="px-4 py-3 text-right">{canWrite && <Button variant="subtle" onClick={() => toggle(it)}>{it.is_active ? 'Deactivate' : 'Activate'}</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && !data && <Spinner />}
        {data && !data.length && <EmptyState title="No items yet" text="Add the raw materials you buy and the products you make, then record opening stock." action={canWrite && <Button onClick={() => setAdding(true)}>+ Add item</Button>} />}
      </Card>
      {adding && (
        <Modal title="New item" onClose={() => setAdding(false)}>
          <form className="space-y-3" onSubmit={add}>
            <ErrorBox error={error} />
            <Label text="Type">
              <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                <option value="raw_material">Raw material (used to make products)</option><option value="finished_good">Finished good (made or sold)</option>
              </Select>
            </Label>
            <Label text="Name"><Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Label>
            <div className="grid grid-cols-2 gap-3">
              <Label text="SKU / code" hint="Must be unique"><Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} required /></Label>
              <Label text="Unit" hint="kg, pcs, box…"><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} required /></Label>
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button><Button>Add item</Button></div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export function StockPage() {
  const { org } = useAuth()
  const canWrite = org?.role !== 'viewer'
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const stock = useFetch(() => documents('inventory/stock').list({ page_size: 200, search, kind }), [org?.id, search, kind])
  const itemList = useFetch(() => items.list({ is_active: 'true' }), [org?.id])
  const locs = useFetch(() => locations.list(), [org?.id])
  const [f, setF] = useState({ item: '', location: '', mode: 'opening', quantity: '', note: '' })
  const [error, setError] = useState<string | null>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const n = Number(f.quantity)
    try {
      await resource('inventory/adjustments').create({
        item: Number(f.item), location: f.location ? Number(f.location) : undefined, date: todayDubai(),
        type: f.mode === 'opening' ? 'opening' : 'adjustment', quantity: f.mode === 'remove' ? -Math.abs(n) : Math.abs(n), note: f.note,
      })
      toast.success('Stock updated')
      setAdjusting(false); setF({ ...f, quantity: '', note: '' }); setError(null); stock.reload()
    } catch (err: any) { setError(err.message) }
  }

  return (
    <div>
      <PageHeader title="Stock on hand" subtitle="Quantities per item and location, built from every stock movement"
        actions={canWrite && <Button onClick={() => setAdjusting(true)}>+ Add / adjust stock</Button>} />
      <Card className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-[14rem] flex-1"><Input placeholder="Search item or SKU…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" /></div>
        <Select className="w-48" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type filter">
          <option value="">All types</option><option value="raw_material">Raw materials</option><option value="finished_good">Finished goods</option>
        </Select>
      </Card>
      <ErrorBox error={stock.error} />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Item</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Location</th><th className="px-4 py-3 text-right">On hand</th></tr>
          </thead>
          <tbody>
            {stock.data?.results.map((r: any) => (
              <tr key={`${r.item}-${r.location}`} className="border-t border-slate-100">
                <td className="px-4 py-3"><div className="font-medium">{r.item_name}</div><div className="font-mono text-xs text-slate-500">{r.sku}</div></td>
                <td className="px-4 py-3">{kindLabel(r.kind)}</td>
                <td className="px-4 py-3">{r.location_name}</td>
                <td className="px-4 py-3 text-right tabular-nums">{qty(r.quantity)} <span className="text-slate-500">{r.unit}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {stock.loading && !stock.data && <Spinner />}
        {stock.data && !stock.data.results.length && <EmptyState title="No stock yet" text="Add opening stock for your items to get started." action={canWrite && <Button onClick={() => setAdjusting(true)}>+ Add stock</Button>} />}
      </Card>
      {adjusting && (
        <Modal title="Add or adjust stock" onClose={() => setAdjusting(false)}>
          <form className="space-y-3" onSubmit={save}>
            <ErrorBox error={error} />
            <Label text="What are you doing?">
              <Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>
                <option value="opening">Add opening stock</option><option value="add">Add stock (correction)</option><option value="remove">Remove stock (damage, count correction)</option>
              </Select>
            </Label>
            <Label text="Item">
              <Select value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })} required>
                <option value="">Select item…</option>{itemList.data?.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}
              </Select>
            </Label>
            <Label text="Location">
              <Select value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })}>
                <option value="">Main Warehouse</option>{locs.data?.filter((l) => l.kind === 'warehouse').map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
            </Label>
            <Label text="Quantity"><Input type="number" step="any" min="0.0001" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} required /></Label>
            <Label text="Note (optional)"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Label>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setAdjusting(false)}>Cancel</Button><Button>Save</Button></div>
          </form>
        </Modal>
      )}
    </div>
  )
}

type Row = { item: string; quantity: string }

/** Production run: choose what was made, then list the raw materials consumed. Shows stock available as you type. */
export function ProductionForm() {
  const nav = useNavigate()
  const toast = useToast()
  const { org } = useAuth()
  const all = useFetch(() => items.list({ is_active: 'true' }), [org?.id])
  const stock = useFetch(() => documents('inventory/stock').list({ page_size: 200 }), [org?.id])
  const [out, setOut] = useState('')
  const [outQty, setOutQty] = useState('')
  const [date, setDate] = useState(todayDubai())
  const [note, setNote] = useState('')
  const [inputs, setInputs] = useState<Row[]>([{ item: '', quantity: '' }])
  const raw = all.data?.filter((i) => i.kind === 'raw_material') ?? []
  const finished = all.data?.filter((i) => i.kind === 'finished_good') ?? []
  const onHand = useMemo(() => {
    const m: Record<string, number> = {}
    stock.data?.results.forEach((r: any) => { m[r.item] = (m[r.item] ?? 0) + Number(r.quantity) })
    return m
  }, [stock.data])
  const short = inputs.some((r) => r.item && Number(r.quantity) > (onHand[r.item] ?? 0))

  const { submit, busy, error } = useSubmit(
    (idempotency_key) => resource('inventory/production').create({
      date, note, item: Number(out), quantity: outQty, idempotency_key,
      inputs: inputs.filter((r) => r.item).map((r) => ({ item: Number(r.item), quantity: r.quantity })),
    }),
    (doc: any) => { toast.success(`${doc.number} recorded`); nav('/inventory/production') },
  )
  const set = (i: number, p: Partial<Row>) => setInputs(inputs.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const used = new Set(inputs.map((r) => r.item))

  return (
    <form className="max-w-3xl space-y-4" onSubmit={(e) => { e.preventDefault(); submit() }}>
      <PageHeader title="New production run" subtitle="Record the raw materials used and the finished goods made" />
      <ErrorBox error={error} />
      <Card className="space-y-3">
        <h2 className="font-semibold">1. What did you make?</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Label text="Finished good">
            <Select value={out} onChange={(e) => setOut(e.target.value)} required>
              <option value="">Select product…</option>{finished.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </Select>
          </Label>
          <Label text="Quantity made"><Input type="number" step="any" min="0.0001" value={outQty} onChange={(e) => setOutQty(e.target.value)} required /></Label>
          <Label text="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Label>
        </div>
        {all.data && !finished.length && <p className="text-sm text-amber-700">You have no finished goods yet. Add one under Items first.</p>}
      </Card>
      <Card className="space-y-2">
        <h2 className="font-semibold">2. Which raw materials were used?</h2>
        {inputs.map((r, i) => {
          const have = onHand[r.item] ?? 0
          const over = r.item && Number(r.quantity) > have
          return (
            <div key={i} className="grid grid-cols-12 items-start gap-2">
              <Select className="col-span-12 sm:col-span-6" value={r.item} onChange={(e) => set(i, { item: e.target.value })} aria-label="Raw material" required>
                <option value="">Select raw material…</option>
                {raw.filter((x) => !used.has(String(x.id)) || String(x.id) === r.item).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </Select>
              <Input className="col-span-7 sm:col-span-3" type="number" step="any" min="0.0001" placeholder="Quantity" value={r.quantity} onChange={(e) => set(i, { quantity: e.target.value })} aria-label="Quantity used" required />
              <Button type="button" variant="ghost" className="col-span-5 sm:col-span-3" disabled={inputs.length === 1} onClick={() => setInputs(inputs.filter((_, j) => j !== i))}>Remove</Button>
              {r.item && <p className={`col-span-12 -mt-1 text-xs ${over ? 'text-red-600' : 'text-slate-500'}`}>{over ? `Only ${qty(have)} in stock` : `${qty(have)} in stock`}</p>}
            </div>
          )
        })}
        <Button type="button" variant="ghost" onClick={() => setInputs([...inputs, { item: '', quantity: '' }])}>+ Add raw material</Button>
        {all.data && !raw.length && <p className="text-sm text-amber-700">You have no raw materials yet. Add some under Items first.</p>}
      </Card>
      <Label text="Note (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Label>
      {short && <p role="alert" className="text-sm text-red-600">One or more raw materials exceed what is in stock; the system will refuse this run.</p>}
      <div className="flex gap-2"><Button disabled={busy}>{busy ? 'Saving…' : 'Record production'}</Button><Button type="button" variant="ghost" onClick={() => nav('/inventory/production')}>Cancel</Button></div>
    </form>
  )
}

