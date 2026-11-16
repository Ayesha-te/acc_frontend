import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { Account, accounts, documents, resource } from '../../api/endpoints'
import { useAuth, useCan } from '../auth/AuthContext'
import { Button, Card, ErrorBox, Input, Label, PageHeader, Select } from '../../components/ui'
import { BranchSelect } from '../../components/BranchSelect'
import { PartySelect } from '../../components/PartySelect'
import { TaxHint, TaxSelect, useTaxRates } from '../../components/TaxSelect'
import { useToast } from '../../lib/toast'
import { money, todayDubai } from '../../lib/format'
import { useSubmit } from '../../lib/useSubmit'

type Item = { description: string; quantity: string; unit_price: string; tax_rate: string; item?: string; income_account?: string }
const blank = (income_account = ''): Item => ({ description: '', quantity: '1', unit_price: '', tax_rate: '0', income_account })
/** Accounts a sales line may credit: active income accounts, except the Sales Returns contra account (server enforces the same). */
export const eligibleIncome = (list: Account[]) => list.filter((a) => a.type === 'income' && a.is_active !== false && a.system_code !== 'SALES_RETURNS')

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
  const { org } = useAuth()
  const canViewSettings = useCan()('settings', 'view')
  const isSales = path === 'sales/invoices'
  // Sales invoice lines credit a chosen income account; returns keep posting to Sales Returns. Sales descriptions are optional.
  const withAccount = isSales && kind === 'invoice'
  const descOptional = isSales
  const [incomeAccounts, setIncomeAccounts] = useState<Account[] | null>(null)
  const defaultIncome = org?.effective_income_account ? String(org.effective_income_account) : ''
  const rates = useTaxRates().data
  const [party, setParty] = useState('')
  const [date, setDate] = useState(todayDubai())
  const [original, setOriginal] = useState('')
  const [branch, setBranch] = useState('')
  const [narration, setNarration] = useState('')
  const [items, setItems] = useState<Item[]>([blank(withAccount ? defaultIncome : '')])
  useEffect(() => {
    if (!withAccount) return
    accounts.list().then((a) => {
      const list = eligibleIncome(a)
      setIncomeAccounts(list)
      // preselect the default on lines that have no account yet (only if it is in the list)
      const def = canViewSettings
        ? list.some((x) => String(x.id) === defaultIncome) ? defaultIncome : list[0] ? String(list[0].id) : ''
        : ''
      setItems((its) => its.map((it) => (it.income_account ? it : { ...it, income_account: def })))
    }).catch(() => setIncomeAccounts([]))
  }, [withAccount, defaultIncome, canViewSettings])
  // Stock items can be linked to lines only once inventory costing is on (the server enforces this too).
  const [stockItems, setStockItems] = useState<{ id: number; name: string; sku: string }[]>([])
  useEffect(() => {
    api<{ enabled: boolean }>('/inventory/costing/').then(async (s) => { if (s.enabled) setStockItems(await resource<any>('inventory/items').list({ is_active: 'true' })) }).catch(() => setStockItems([]))
  }, [])
  // Sales invoices can pick up posted billable expenses of the chosen customer (charged once, at cost).
  const [billableList, setBillableList] = useState<{ id: number; number: string; total: string; narration: string }[]>([])
  const [billed, setBilled] = useState<number[]>([])
  useEffect(() => {
    setBilled([]); setBillableList([])
    if (path !== 'sales/invoices' || kind !== 'invoice' || !party) return
    documents('expenses').list({ customer: party, is_billable: 'true', status: 'posted', page_size: 200 }).then((r) => setBillableList(r.results.filter((e: any) => !e.billed_invoice))).catch(() => {})
  }, [party, path, kind])
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
      documents(path).create({ kind, party: Number(party), date, narration, items: items.map(({ item, income_account, ...rest }) => ({ ...rest, item: item ? Number(item) : null, ...(withAccount ? { income_account: income_account ? Number(income_account) : null } : {}) })), idempotency_key, branch: branch ? Number(branch) : null, original: kind === 'return' ? Number(original) : undefined, billable_expenses: billed.length ? billed : undefined }),
    (doc: any) => { toast.success(`${doc.number} posted`); nav(backTo) },
  )

  return (
    <form className={`${withAccount ? 'max-w-5xl' : 'max-w-4xl'} space-y-4`} onSubmit={(e) => { e.preventDefault(); submit() }}>
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
        {withAccount && incomeAccounts && !incomeAccounts.length && (
          <ErrorBox error="There are no active income accounts. Add one under Setup → Chart of accounts before creating an invoice." />)}
        <div className="hidden grid-cols-12 gap-2 text-xs font-medium text-slate-500 sm:grid">
          {withAccount && <span className="col-span-3">Income account</span>}
          <span className={withAccount ? 'col-span-3' : 'col-span-4'}>Description{descOptional && <span className="font-normal text-slate-400"> (optional)</span>}</span>
          <span className={withAccount ? 'col-span-1' : 'col-span-2'}>Qty</span><span className="col-span-2">Unit price</span><span className={withAccount ? 'col-span-2' : 'col-span-3'}>Tax</span>
        </div>
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 border-b border-slate-100 pb-2 last:border-0 sm:border-0 sm:pb-0">
            {withAccount && (
              <div className="col-span-12 sm:col-span-3">
                <Select value={it.income_account ?? ''} onChange={(e) => set(i, { income_account: e.target.value })}
                  required={canViewSettings} aria-label="Income account" disabled={!incomeAccounts}>
                  {!canViewSettings && <option value="">Organization default</option>}
                  {!incomeAccounts && <option value="">Loading…</option>}
                  {incomeAccounts?.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                </Select>
              </div>
            )}
            <div className={`col-span-12 space-y-1 ${withAccount ? 'sm:col-span-3' : 'sm:col-span-4'}`}>
              <Input placeholder={descOptional ? 'Description (optional)' : 'Description'} value={it.description} onChange={(e) => set(i, { description: e.target.value })} required={!descOptional} aria-label="Description" />
              {stockItems.length > 0 && (
                <Select value={it.item ?? ''} onChange={(e) => { const s = stockItems.find((x) => String(x.id) === e.target.value); set(i, { item: e.target.value, ...(s && !it.description ? { description: s.name } : {}) }) }} aria-label="Stock item">
                  <option value="">Not a stock item</option>{stockItems.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.sku})</option>)}
                </Select>)}
            </div>
            <Input className={`col-span-4 ${withAccount ? 'sm:col-span-1' : 'sm:col-span-2'}`} type="number" step="any" min="0" value={it.quantity} onChange={(e) => set(i, { quantity: e.target.value })} required aria-label="Quantity" placeholder="Qty" />
            <Input className="col-span-4 sm:col-span-2" type="number" step="any" min="0" value={it.unit_price} onChange={(e) => set(i, { unit_price: e.target.value })} required aria-label="Unit price" placeholder="Unit price" />
            <div className={`col-span-8 ${withAccount ? 'sm:col-span-2' : 'sm:col-span-3'}`}><TaxSelect rates={rates} value={it.tax_rate} onChange={(v) => set(i, { tax_rate: v })} /></div>
            <Button type="button" variant="ghost" className="col-span-1" disabled={items.length === 1} onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Remove line">×</Button>
          </div>
        ))}
        <Button type="button" variant="ghost" onClick={() => setItems([...items, blank(withAccount
          ? canViewSettings ? (incomeAccounts?.some((a) => String(a.id) === defaultIncome) ? defaultIncome : incomeAccounts?.[0] ? String(incomeAccounts[0].id) : '') : ''
          : '')])}>+ Add line</Button>
        {billableList.length > 0 && (
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
            <p className="mb-1 font-medium">Billable expenses for this customer (added at cost, once)</p>
            {billableList.map((e) => (
              <label key={e.id} className="flex items-center gap-2">
                <input type="checkbox" checked={billed.includes(e.id)} onChange={(ev) => setBilled(ev.target.checked ? [...billed, e.id] : billed.filter((x) => x !== e.id))} />
                {e.number} {e.narration} · {money(e.total)}
              </label>))}
          </div>)}
        <TaxHint rates={rates} />
        <div className="ml-auto w-56 space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(net)}</span></div>
          <div className="flex justify-between"><span>Tax</span><span>{money(tax)}</span></div>
          <div className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span>{money(net + tax)}</span></div>
        </div>
      </Card>
      <div className="flex gap-2">
        <Button disabled={busy || (withAccount && (!incomeAccounts || !incomeAccounts.length))}>{busy ? 'Saving…' : 'Post'}</Button>
        <Button type="button" variant="ghost" onClick={() => nav(backTo)}>Cancel</Button>
      </div>
    </form>
  )
}
