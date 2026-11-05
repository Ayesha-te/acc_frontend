import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { documents, resource } from '../../api/endpoints'
import { BranchSelect } from '../../components/BranchSelect'
import { PartySelect } from '../../components/PartySelect'
import { TaxSelect, useTaxRates } from '../../components/TaxSelect'
import { Badge, Button, Card, EmptyState, ErrorBox, Input, Label, Modal, PageHeader, Select, Spinner } from '../../components/ui'
import { money, todayDubai } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'
import { useSubmit } from '../../lib/useSubmit'
import { useToast } from '../../lib/toast'
import { useAuth } from '../auth/AuthContext'

export type OrderKind = 'quote' | 'order' | 'purchase'
const META = {
  quote: { side: 'sales', path: 'sales/orders', base: '/sales/quotes', title: 'Quotes', one: 'quote', party: 'customer' as const, sub: 'Estimates sent to customers. Nothing is posted until you convert one into an invoice.' },
  order: { side: 'sales', path: 'sales/orders', base: '/sales/orders', title: 'Sales orders', one: 'sales order', party: 'customer' as const, sub: 'Confirmed customer orders. Nothing is posted until you convert one into an invoice.' },
  purchase: { side: 'purchases', path: 'purchases/orders', base: '/purchases/orders', title: 'Purchase orders', one: 'purchase order', party: 'supplier' as const, sub: 'Orders sent to suppliers. Nothing is posted until you convert one into a bill.' },
}
const orders = (k: OrderKind) => resource(META[k].path)

type Item = { description: string; quantity: string; unit_price: string; tax_rate: string; item?: string }
const blank = (): Item => ({ description: '', quantity: '1', unit_price: '', tax_rate: '0', item: '' })
const payloadItems = (items: Item[]) => items.map(({ item, ...rest }) => ({ ...rest, item: item ? Number(item) : null }))

export function OrdersPage({ kind }: { kind: OrderKind }) {
  const m = META[kind]
  const { org } = useAuth()
  const toast = useToast()
  const canWrite = !!org && org.role !== 'viewer'
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const list = useFetch(() => orders(kind).page({ page_size: 50, search, status, ...(kind === 'purchase' ? {} : { kind }) }), [org?.id, kind, status, search])
  const [error, setError] = useState<string | null>(null)

  const act = async (id: number, action: string, body?: unknown, done?: string) => {
    setError(null)
    try { await orders(kind).act(id, action, body); toast.success(done ?? 'Done'); list.reload() } catch (e: any) { setError(e.message) }
  }
  const convert = async (r: any, to: 'invoice' | 'order') => {
    const what = to === 'order' ? 'a sales order' : kind === 'purchase' ? 'a bill' : 'an invoice'
    if (!confirm(`Convert ${r.number} into ${what}? ${to === 'invoice' ? 'This posts to the ledger (dated today) and cannot be repeated.' : ''}`)) return
    await act(r.id, 'convert', { to }, `${r.number} converted`)
  }

  // Partial conversion: choose how much of each line to bill now. The key is fixed per dialog so a double click cannot bill twice.
  const [partial, setPartial] = useState<{ order: any; qty: Record<number, string>; date: string; key: string } | null>(null)
  const [partialError, setPartialError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const openPartial = (r: any) => {
    setPartialError(null)
    setPartial({ order: r, qty: Object.fromEntries(r.items.map((i: any) => [i.id, i.remaining_qty])), date: todayDubai(), key: crypto.randomUUID() })
  }
  const submitPartial = async () => {
    if (!partial || busy) return
    const lines = partial.order.items.map((i: any) => ({ item: i.id, quantity: partial.qty[i.id] })).filter((l: any) => Number(l.quantity) > 0)
    setBusy(true)
    try {
      await orders(kind).act(partial.order.id, 'convert', { to: 'invoice', date: partial.date, lines, idempotency_key: partial.key })
      toast.success(`${partial.order.number}: ${kind === 'purchase' ? 'bill' : 'invoice'} created`)
      setPartial(null); list.reload()
    } catch (e: any) { setPartialError(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="max-w-6xl space-y-4">
      <PageHeader title={m.title} subtitle={m.sub} actions={canWrite && <Link to={`${m.base}/new`}><Button>+ New {m.one}</Button></Link>} />
      <Card className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1"><Input placeholder="Search by number, name or note…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" /></div>
        <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {['open', 'accepted', 'declined', 'converted', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </Card>
      <ErrorBox error={error ?? list.error} />
      <Card className="overflow-x-auto p-0">
        {list.loading && !list.data ? <Spinner /> : !list.data?.results.length ? (
          <EmptyState title={`No ${m.title.toLowerCase()} yet`} text="Records you create will appear here." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Number</th><th>Date</th><th>{m.party === 'customer' ? 'Customer' : 'Supplier'}</th><th className="text-right">Total</th><th>Status</th><th /></tr>
            </thead>
            <tbody>{list.data.results.map((r: any) => {
              const live = r.status === 'open' || r.status === 'accepted'
              return (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{r.number}</td><td>{r.date}</td><td>{r.party_name}</td>
                  <td className="text-right tabular-nums">{money(r.total)}</td>
                  <td><Badge value={r.status} />{(r.invoices ?? []).map((v: any) => <span key={v.id} className="ml-2 text-xs text-slate-500">{v.number}</span>)}</td>
                  <td className="space-x-1 px-4 py-3 text-right whitespace-nowrap">
                    {canWrite && live && (<>
                      {!r.items.some((i: any) => Number(i.invoiced_qty) > 0) && <Link to={`${m.base}/${r.id}/edit`}><Button variant="subtle">Edit</Button></Link>}
                      {kind === 'quote' && r.status === 'open' && <Button variant="subtle" onClick={() => act(r.id, 'accept', undefined, 'Accepted')}>Accept</Button>}
                      {kind === 'quote' && <Button variant="subtle" onClick={() => act(r.id, 'decline', undefined, 'Declined')}>Decline</Button>}
                      {kind === 'quote' && <Button variant="subtle" onClick={() => convert(r, 'order')}>To sales order</Button>}
                      <Button variant="subtle" onClick={() => convert(r, 'invoice')}>{kind === 'purchase' ? 'To bill (rest)' : 'To invoice (rest)'}</Button>
                      {kind !== 'quote' && <Button variant="subtle" onClick={() => openPartial(r)}>Partial…</Button>}
                      <Button variant="danger" onClick={() => confirm(`Cancel ${r.number}?`) && act(r.id, 'cancel', undefined, 'Cancelled')}>Cancel</Button>
                    </>)}
                  </td>
                </tr>)
            })}</tbody>
          </table>
        )}
      </Card>
      {partial && (
        <Modal title={`Invoice part of ${partial.order.number}`} onClose={() => setPartial(null)} wide>
          <ErrorBox error={partialError} />
          <table className="mb-3 w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th>Item</th><th className="text-right">Ordered</th><th className="text-right">Already billed</th><th className="w-32 text-right">Bill now</th></tr></thead>
            <tbody>{partial.order.items.map((i: any) => (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="py-2">{i.description}</td><td className="text-right tabular-nums">{Number(i.quantity)}</td><td className="text-right tabular-nums">{Number(i.invoiced_qty)}</td>
                <td><Input type="number" min="0" max={i.remaining_qty} step="any" className="text-right" value={partial.qty[i.id]} disabled={Number(i.remaining_qty) <= 0}
                  onChange={(e) => setPartial({ ...partial, qty: { ...partial.qty, [i.id]: e.target.value } })} aria-label={`Quantity of ${i.description}`} /></td>
              </tr>))}</tbody>
          </table>
          <Label text="Document date"><Input type="date" value={partial.date} onChange={(e) => setPartial({ ...partial, date: e.target.value })} /></Label>
          <p className="mt-2 text-xs text-slate-500">This posts to the ledger. The rest stays open on the {m.one}.</p>
          <div className="mt-3 flex justify-end gap-2"><Button variant="ghost" onClick={() => setPartial(null)}>Cancel</Button><Button disabled={busy} onClick={submitPartial}>{busy ? 'Posting…' : 'Create'}</Button></div>
        </Modal>
      )}
    </div>
  )
}

export function OrderForm({ kind }: { kind: OrderKind }) {
  const m = META[kind]
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const rates = useTaxRates().data
  const [party, setParty] = useState('')
  const [date, setDate] = useState(todayDubai())
  const [validUntil, setValidUntil] = useState('')
  const [branch, setBranch] = useState('')
  const [narration, setNarration] = useState('')
  const [items, setItems] = useState<Item[]>([blank()])
  const [loading, setLoading] = useState(!!id)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Stock items can be linked to lines only once inventory costing is on (the server enforces this too).
  const [stockItems, setStockItems] = useState<{ id: number; name: string; sku: string }[]>([])
  useEffect(() => {
    api<{ enabled: boolean }>('/inventory/costing/').then(async (s) => { if (s.enabled) setStockItems(await resource<any>('inventory/items').list({ is_active: 'true' })) }).catch(() => setStockItems([]))
  }, [])
  useEffect(() => {
    if (!id) return
    documents(m.path).get(Number(id)).then((d) => {
      setParty(String(d.party)); setDate(d.date); setValidUntil(d.valid_until ?? ''); setBranch(d.branch ? String(d.branch) : ''); setNarration(d.narration)
      setItems(d.items.map((i: any) => ({ description: i.description, quantity: String(i.quantity), unit_price: String(i.unit_price), tax_rate: String(i.tax_rate), item: i.item ? String(i.item) : '' })))
    }).catch((e) => setLoadError(e.message)).finally(() => setLoading(false))
  }, [id, m.path])

  const set = (i: number, patch: Partial<Item>) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  const net = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0), 0)
  const tax = items.reduce((s, it) => s + (Number(it.quantity || 0) * Number(it.unit_price || 0) * Number(it.tax_rate || 0)) / 100, 0)
  const { submit, busy, error } = useSubmit(
    (idempotency_key) => id
      ? orders(kind).update(Number(id), { date, valid_until: validUntil || null, narration, items: payloadItems(items) })
      : orders(kind).create({ ...(kind === 'purchase' ? {} : { kind }), party: Number(party), date, valid_until: validUntil || null, narration, items: payloadItems(items), branch: branch ? Number(branch) : null, idempotency_key }),
    (doc: any) => { toast.success(`${doc.number} saved`); nav(m.base) },
  )
  if (loading) return <Spinner />
  return (
    <form className="max-w-4xl space-y-4" onSubmit={(e) => { e.preventDefault(); submit() }}>
      <PageHeader title={id ? `Edit ${m.one}` : `New ${m.one}`} />
      <ErrorBox error={loadError ?? error} />
      <Card className="grid gap-3 sm:grid-cols-3">
        <Label text={m.party === 'customer' ? 'Customer' : 'Supplier'}>{id ? <Input value={party} disabled /> : <PartySelect kind={m.party} value={party} onChange={setParty} />}</Label>
        <Label text="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Label>
        <Label text={kind === 'quote' ? 'Valid until' : 'Expected date'}><Input type="date" value={validUntil} min={date} onChange={(e) => setValidUntil(e.target.value)} /></Label>
        {!id && <BranchSelect value={branch} onChange={setBranch} />}
        <div className="sm:col-span-3"><Label text="Narration"><Input value={narration} onChange={(e) => setNarration(e.target.value)} /></Label></div>
      </Card>
      <Card className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <Input className="col-span-12 sm:col-span-4" placeholder="Description" value={it.description} onChange={(e) => set(i, { description: e.target.value })} required />
            <Input className="col-span-4 sm:col-span-2" type="number" step="any" min="0" value={it.quantity} onChange={(e) => set(i, { quantity: e.target.value })} required aria-label="Quantity" />
            <Input className="col-span-4 sm:col-span-2" type="number" step="any" min="0" value={it.unit_price} onChange={(e) => set(i, { unit_price: e.target.value })} required aria-label="Unit price" />
            <div className="col-span-8 sm:col-span-3"><TaxSelect rates={rates} value={it.tax_rate} onChange={(v) => set(i, { tax_rate: v })} /></div>
            <Button type="button" variant="ghost" className="col-span-1" disabled={items.length === 1} onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Remove line">×</Button>
            {stockItems.length > 0 && (
              <div className="col-span-12 sm:col-span-4">
                <Select value={it.item ?? ''} onChange={(e) => { const s = stockItems.find((x) => String(x.id) === e.target.value); set(i, { item: e.target.value, ...(s && !it.description ? { description: s.name } : {}) }) }} aria-label="Stock item">
                  <option value="">Not a stock item</option>{stockItems.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.sku})</option>)}
                </Select>
              </div>)}
          </div>
        ))}
        <Button type="button" variant="ghost" onClick={() => setItems([...items, blank()])}>+ Add line</Button>
        <div className="ml-auto w-56 space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(net)}</span></div>
          <div className="flex justify-between"><span>Tax</span><span>{money(tax)}</span></div>
          <div className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span>{money(net + tax)}</span></div>
        </div>
      </Card>
      <div className="flex gap-2"><Button disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button><Button type="button" variant="ghost" onClick={() => nav(m.base)}>Cancel</Button></div>
    </form>
  )
}
