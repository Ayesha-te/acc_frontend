import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { documents } from '../../api/endpoints'
import { Button, Card, ErrorBox, Input, Label, PageHeader, Select } from '../../components/ui'
import { BranchSelect } from '../../components/BranchSelect'
import { PartySelect } from '../../components/PartySelect'
import { TaxHint, TaxSelect, useTaxRates } from '../../components/TaxSelect'
import { useToast } from '../../lib/toast'
import { money, todayDubai } from '../../lib/format'
import { useSubmit } from '../../lib/useSubmit'

type Item = { description: string; quantity: string; unit_price: string; tax_rate: string }
const blank = (): Item => ({ description: '', quantity: '1', unit_price: '', tax_rate: '0' })

/**
 * Invoice / return entry form, parameterised by API path. Sales and purchases pass different props;
 * neither module imports the other. Totals shown here are a preview - the server computes the real ones.
 */
export function InvoiceForm({ path, partyKind, kind, backTo, title }: {
  path: string
  partyKind: 'customer' | 'supplier'
  kind: 'invoice' | 'return'
  backTo: string
  title: string
}) {
  const nav = useNavigate()
  const toast = useToast()
  const rates = useTaxRates().data
  const [party, setParty] = useState('')
  const [date, setDate] = useState(todayDubai())
  const [original, setOriginal] = useState('')
  const [branch, setBranch] = useState('')
  const [narration, setNarration] = useState('')
  const [items, setItems] = useState<Item[]>([blank()])
  const [invoices, setInvoices] = useState<{ id: number; number: string; date: string; total: string; branch: number | null }[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)

  // Returns pick the original from the selected party's posted invoices (the server still validates the limit).
  useEffect(() => {
    setOriginal('')
    setInvoices([])
    if (kind !== 'return' || !party) return
    let live = true
    setLoadingInvoices(true)
    documents(path).list({ party, kind: 'invoice', status: 'posted', ordering: '-date', page_size: 200 })
      .then((r) => live && setInvoices(r.results))
      .finally(() => live && setLoadingInvoices(false))
    return () => { live = false }
  }, [kind, party, path])

  const set = (i: number, patch: Partial<Item>) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  const net = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0), 0)
  const tax = items.reduce((s, it) => s + (Number(it.quantity || 0) * Number(it.unit_price || 0) * Number(it.tax_rate || 0)) / 100, 0)

  const { submit, busy, error } = useSubmit(
    (idempotency_key) =>
      documents(path).create({ kind, party: Number(party), date, narration, items, idempotency_key, branch: branch ? Number(branch) : null, original: kind === 'return' ? Number(original) : undefined }),
    (doc: any) => { toast.success(`${doc.number} posted`); nav(backTo) },
  )

  return (
    <form className="max-w-4xl space-y-4" onSubmit={(e) => { e.preventDefault(); submit() }}>
      <PageHeader title={title} />
      <ErrorBox error={error} />
      <Card className="grid gap-3 sm:grid-cols-3">
        <Label text={partyKind === 'customer' ? 'Customer' : 'Supplier'}><PartySelect kind={partyKind} value={party} onChange={setParty} /></Label>
        <Label text="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Label>
        <BranchSelect value={branch} onChange={setBranch} />
        {kind === 'return' && (
          <Label text="Original invoice">
            <Select value={original} onChange={(e) => { setOriginal(e.target.value); const inv = invoices.find((i) => String(i.id) === e.target.value); if (inv) setBranch(inv.branch ? String(inv.branch) : '') }} required disabled={!party || loadingInvoices}>
              <option value="">
                {!party ? `Select a ${partyKind} first` : loadingInvoices ? 'Loading…' : invoices.length ? 'Select invoice…' : `No posted invoices for this ${partyKind}`}
              </option>
              {invoices.map((inv) => <option key={inv.id} value={inv.id}>{inv.number} · {inv.date} · {money(inv.total)}</option>)}
            </Select>
          </Label>
        )}
        <div className="sm:col-span-3"><Label text="Narration"><Input value={narration} onChange={(e) => setNarration(e.target.value)} /></Label></div>
      </Card>
      <Card className="space-y-2">
        <div className="hidden grid-cols-12 gap-2 text-xs font-medium text-slate-500 sm:grid">
          <span className="col-span-4">Description</span><span className="col-span-2">Qty</span><span className="col-span-2">Unit price</span><span className="col-span-3">Tax</span>
        </div>
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <Input className="col-span-12 sm:col-span-4" placeholder="Description" value={it.description} onChange={(e) => set(i, { description: e.target.value })} required />
            <Input className="col-span-4 sm:col-span-2" type="number" step="any" min="0" value={it.quantity} onChange={(e) => set(i, { quantity: e.target.value })} required aria-label="Quantity" />
            <Input className="col-span-4 sm:col-span-2" type="number" step="any" min="0" value={it.unit_price} onChange={(e) => set(i, { unit_price: e.target.value })} required aria-label="Unit price" />
            <div className="col-span-8 sm:col-span-3"><TaxSelect rates={rates} value={it.tax_rate} onChange={(v) => set(i, { tax_rate: v })} /></div>
            <Button type="button" variant="ghost" className="col-span-1" disabled={items.length === 1} onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Remove line">×</Button>
          </div>
        ))}
        <Button type="button" variant="ghost" onClick={() => setItems([...items, blank()])}>+ Add line</Button>
        <TaxHint rates={rates} />
        <div className="ml-auto w-56 space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(net)}</span></div>
          <div className="flex justify-between"><span>Tax</span><span>{money(tax)}</span></div>
          <div className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span>{money(net + tax)}</span></div>
        </div>
      </Card>
      <div className="flex gap-2">
        <Button disabled={busy}>{busy ? 'Saving…' : 'Post'}</Button>
        <Button type="button" variant="ghost" onClick={() => nav(backTo)}>Cancel</Button>
      </div>
    </form>
  )
}
