import { FormEvent, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Item, documents, resource } from '../../api/endpoints'
import { DetailDrawer } from '../../components/DetailDrawer'
import { Badge, Button, Card, EmptyState, ErrorBox, Input, Label, Modal, PageHeader, Select, Spinner } from '../../components/ui'
import { todayDubai } from '../../lib/format'
import { useToast } from '../../lib/toast'
import { useFetch } from '../../lib/useFetch'
import { useSubmit } from '../../lib/useSubmit'
import { useAuth } from '../auth/AuthContext'

type Vehicle = { id: number; name: string; plate_number: string; driver_name: string; is_active: boolean }
const vehicles = resource<Vehicle>('dispatch/vehicles')
const loads = resource<any>('dispatch/loads')
const qty = (v: string | number) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 })
const dubai = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
const nowLocal = () => `${todayDubai()}T${new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())}`

export function VehiclesPage() {
  const { org } = useAuth()
  const canWrite = org?.role !== 'viewer'
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ name: '', plate_number: '', driver_name: '' })
  const [error, setError] = useState<string | null>(null)
  const { data, loading, error: loadError, reload } = useFetch(() => vehicles.list(), [org?.id])
  const add = async (e: FormEvent) => {
    e.preventDefault()
    try { await vehicles.create(f); toast.success(`${f.name} added`); setAdding(false); setF({ name: '', plate_number: '', driver_name: '' }); setError(null); reload() }
    catch (err: any) { setError(err.message) }
  }
  const toggle = async (v: Vehicle) => { try { await vehicles.update(v.id, { is_active: !v.is_active }); reload() } catch (e: any) { toast.error(e.message) } }
  return (
    <div>
      <PageHeader title="Vehicles" subtitle="Vans that carry stock for delivery" actions={canWrite && <Button onClick={() => setAdding(true)}>+ Add vehicle</Button>} />
      <ErrorBox error={loadError} />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Plate</th><th className="px-4 py-3">Driver</th><th className="px-4 py-3">Status</th><th /></tr></thead>
          <tbody>
            {data?.map((v) => (
              <tr key={v.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{v.name}</td><td className="px-4 py-3">{v.plate_number || '—'}</td><td className="px-4 py-3">{v.driver_name || '—'}</td>
                <td className="px-4 py-3"><Badge value={v.is_active ? 'active' : 'inactive'} tone={v.is_active ? 'posted' : 'void'} /></td>
                <td className="px-4 py-3 text-right">{canWrite && <Button variant="subtle" onClick={() => toggle(v)}>{v.is_active ? 'Deactivate' : 'Activate'}</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && !data && <Spinner />}
        {data && !data.length && <EmptyState title="No vehicles yet" text="Add a van to start loading stock onto it." action={canWrite && <Button onClick={() => setAdding(true)}>+ Add vehicle</Button>} />}
      </Card>
      {adding && (
        <Modal title="New vehicle" onClose={() => setAdding(false)}>
          <form className="space-y-3" onSubmit={add}>
            <ErrorBox error={error} />
            <Label text="Vehicle name"><Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Label>
            <Label text="Plate number"><Input value={f.plate_number} onChange={(e) => setF({ ...f, plate_number: e.target.value })} /></Label>
            <Label text="Driver / assigned person"><Input value={f.driver_name} onChange={(e) => setF({ ...f, driver_name: e.target.value })} /></Label>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button><Button>Add vehicle</Button></div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export function LoadsPage() {
  const { org } = useAuth()
  const canWrite = org?.role !== 'viewer'
  const toast = useToast()
  const nav = useNavigate()
  const [status, setStatus] = useState('')
  const [viewing, setViewing] = useState<any | null>(null)
  const [closing, setClosing] = useState<any | null>(null)
  const { data, loading, error, reload } = useFetch(() => loads.page({ page_size: 50, status }), [org?.id, status])

  const act = async (l: any, action: string, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return
    try { await loads.act(l.id, action); toast.success(`${l.number} updated`); reload() } catch (e: any) { toast.error(e.message) }
  }
  return (
    <div>
      <PageHeader title="Van loads" subtitle="Stock loaded onto vans, sent out, and reconciled when they return"
        actions={canWrite && <Button onClick={() => nav('/dispatch/loads/new')}>+ Load a van</Button>} />
      <Card className="mb-4 flex gap-3">
        <Select className="w-56" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
          <option value="">All statuses</option><option value="loaded">Loaded</option><option value="out_for_delivery">Out for delivery</option><option value="closed">Closed</option><option value="cancelled">Cancelled</option>
        </Select>
      </Card>
      <ErrorBox error={error} />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Number</th><th className="px-4 py-3">Vehicle</th><th className="px-4 py-3">Assigned to</th><th className="px-4 py-3">Dispatch time</th><th className="px-4 py-3">Status</th><th /></tr>
          </thead>
          <tbody>
            {data?.results.map((l) => (
              <tr key={l.id} className="cursor-pointer border-t border-slate-100 hover:bg-indigo-50/40" onClick={() => setViewing(l)}>
                <td className="px-4 py-3 font-medium">{l.number}</td><td className="px-4 py-3">{l.vehicle_name}</td><td className="px-4 py-3">{l.assigned_to || '—'}</td>
                <td className="px-4 py-3">{dubai(l.dispatch_at)}</td><td className="px-4 py-3"><Badge value={l.status} /></td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  {canWrite && l.status === 'loaded' && <><Button variant="subtle" onClick={() => act(l, 'dispatch')}>Send out</Button><Button variant="subtle" onClick={() => act(l, 'cancel', `Cancel ${l.number}? The stock goes back to the warehouse.`)}>Cancel</Button></>}
                  {canWrite && l.status === 'out_for_delivery' && <Button variant="subtle" onClick={() => setClosing(l)}>Close &amp; reconcile</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && !data && <Spinner />}
        {data && !data.results.length && <EmptyState title="No van loads" text="Load a van to move stock from the warehouse onto it." action={canWrite && <Button onClick={() => nav('/dispatch/loads/new')}>+ Load a van</Button>} />}
      </Card>
      {viewing && <DetailDrawer path="dispatch/loads" id={viewing.id} title={viewing.number} onClose={() => setViewing(null)} />}
      {closing && <CloseLoad load={closing} onClose={() => setClosing(null)} onDone={() => { setClosing(null); reload() }} />}
    </div>
  )
}

function CloseLoad({ load, onClose, onDone }: { load: any; onClose(): void; onDone(): void }) {
  const toast = useToast()
  const detail = useFetch(() => documents('dispatch/loads').get(load.id), [load.id])
  const [vals, setVals] = useState<Record<number, { delivered: string; returned: string }>>({})
  const [error, setError] = useState<string | null>(null)
  const lines: any[] = detail.data?.lines ?? []
  const get = (id: number) => vals[id] ?? { delivered: '', returned: '' }
  const set = (id: number, p: Partial<{ delivered: string; returned: string }>) => setVals({ ...vals, [id]: { ...get(id), ...p } })
  const left = (l: any) => Number(l.quantity_loaded) - Number(get(l.item).delivered || 0) - Number(get(l.item).returned || 0)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await loads.act(load.id, 'close', { lines: lines.map((l) => ({ item: l.item, delivered: get(l.item).delivered || '0', returned: get(l.item).returned || '0' })) })
      toast.success(`${load.number} closed`)
      onDone()
    } catch (err: any) { setError(err.message) }
  }
  return (
    <Modal title={`Close ${load.number}`} onClose={onClose} wide>
      <form className="space-y-3" onSubmit={save}>
        <p className="text-sm text-slate-600">For each product, enter how many were delivered and how many came back. Anything left over stays on the van.</p>
        <ErrorBox error={error} />
        {detail.loading && <Spinner />}
        {lines.map((l) => (
          <div key={l.item} className="grid grid-cols-12 items-center gap-2 text-sm">
            <div className="col-span-12 sm:col-span-5"><div className="font-medium">{l.item_name}</div><div className="text-xs text-slate-500">Loaded {qty(l.quantity_loaded)}</div></div>
            <label className="col-span-5 sm:col-span-3 text-xs text-slate-500">Delivered<Input type="number" step="any" min="0" value={get(l.item).delivered} onChange={(e) => set(l.item, { delivered: e.target.value })} /></label>
            <label className="col-span-5 sm:col-span-3 text-xs text-slate-500">Returned<Input type="number" step="any" min="0" value={get(l.item).returned} onChange={(e) => set(l.item, { returned: e.target.value })} /></label>
            <div className={`col-span-2 sm:col-span-1 text-right text-xs ${left(l) < 0 ? 'text-red-600' : 'text-slate-500'}`}>{qty(left(l))} left</div>
          </div>
        ))}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={lines.some((l) => left(l) < 0)}>Close load</Button></div>
      </form>
    </Modal>
  )
}

type Line = { item: string; quantity: string }

export function LoadForm() {
  const nav = useNavigate()
  const toast = useToast()
  const { org } = useAuth()
  const veh = useFetch(() => vehicles.list({ is_active: 'true' }), [org?.id])
  const itemsQ = useFetch(() => resource<Item>('inventory/items').list({ is_active: 'true' }), [org?.id])
  const stockQ = useFetch(() => documents('inventory/stock').list({ page_size: 200 }), [org?.id])
  const locs = useFetch(() => resource<any>('inventory/locations').list(), [org?.id])
  const [vehicle, setVehicle] = useState('')
  const [when, setWhen] = useState(nowLocal())
  const [assigned, setAssigned] = useState('')
  const [lines, setLines] = useState<Line[]>([{ item: '', quantity: '' }])
  const warehouse = locs.data?.find((l: any) => l.kind === 'warehouse')
  const onHand = useMemo(() => {
    const m: Record<string, number> = {}
    stockQ.data?.results.filter((r: any) => !warehouse || r.location === warehouse.id).forEach((r: any) => { m[r.item] = (m[r.item] ?? 0) + Number(r.quantity) })
    return m
  }, [stockQ.data, warehouse])
  const set = (i: number, p: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...p } : l)))
  const used = new Set(lines.map((l) => l.item))
  const short = lines.some((l) => l.item && Number(l.quantity) > (onHand[l.item] ?? 0))

  const { submit, busy, error } = useSubmit(
    (idempotency_key) => loads.create({
      vehicle: Number(vehicle), dispatch_at: `${when}:00+04:00`, assigned_to: assigned, idempotency_key,
      lines: lines.filter((l) => l.item).map((l) => ({ item: Number(l.item), quantity: l.quantity })),
    }),
    (doc: any) => { toast.success(`${doc.number} loaded`); nav('/dispatch/loads') },
  )

  return (
    <form className="max-w-3xl space-y-4" onSubmit={(e) => { e.preventDefault(); submit() }}>
      <PageHeader title="Load a van" subtitle="Move stock from the warehouse onto a vehicle" />
      <ErrorBox error={error} />
      <Card className="grid gap-3 sm:grid-cols-3">
        <Label text="Vehicle">
          <Select value={vehicle} onChange={(e) => { setVehicle(e.target.value); setAssigned(veh.data?.find((v) => String(v.id) === e.target.value)?.driver_name ?? '') }} required>
            <option value="">Select vehicle…</option>{veh.data?.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </Select>
        </Label>
        <Label text="Dispatch date & time (Dubai)"><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required /></Label>
        <Label text="Assigned person / driver"><Input value={assigned} onChange={(e) => setAssigned(e.target.value)} /></Label>
        {veh.data && !veh.data.length && <p className="text-sm text-amber-700 sm:col-span-3">No active vehicles. Add one under Van loading → Vehicles first.</p>}
      </Card>
      <Card className="space-y-2">
        <h2 className="font-semibold">Products to load</h2>
        {lines.map((l, i) => {
          const have = onHand[l.item] ?? 0
          const over = l.item && Number(l.quantity) > have
          return (
            <div key={i} className="grid grid-cols-12 items-start gap-2">
              <Select className="col-span-12 sm:col-span-6" value={l.item} onChange={(e) => set(i, { item: e.target.value })} aria-label="Product" required>
                <option value="">Select product…</option>
                {itemsQ.data?.filter((x) => !used.has(String(x.id)) || String(x.id) === l.item).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </Select>
              <Input className="col-span-7 sm:col-span-3" type="number" step="any" min="0.0001" placeholder="Quantity" value={l.quantity} onChange={(e) => set(i, { quantity: e.target.value })} aria-label="Quantity" required />
              <Button type="button" variant="ghost" className="col-span-5 sm:col-span-3" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}>Remove</Button>
              {l.item && <p className={`col-span-12 -mt-1 text-xs ${over ? 'text-red-600' : 'text-slate-500'}`}>{over ? `Only ${qty(have)} in the warehouse` : `${qty(have)} in the warehouse`}</p>}
            </div>
          )
        })}
        <Button type="button" variant="ghost" onClick={() => setLines([...lines, { item: '', quantity: '' }])}>+ Add product</Button>
      </Card>
      {short && <p role="alert" className="text-sm text-red-600">One or more quantities exceed warehouse stock; the system will refuse this load.</p>}
      <div className="flex gap-2"><Button disabled={busy}>{busy ? 'Saving…' : 'Load van'}</Button><Button type="button" variant="ghost" onClick={() => nav('/dispatch/loads')}>Cancel</Button></div>
    </form>
  )
}
