import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Account, accounts, documents, expenses } from '../../api/endpoints'
import { BranchSelect } from '../../components/BranchSelect'
import { PartySelect } from '../../components/PartySelect'
import { TaxHint, TaxSelect, useTaxRates } from '../../components/TaxSelect'
import { Button, Card, ErrorBox, Input, Label, PageHeader, Select } from '../../components/ui'
import { money, todayDubai } from '../../lib/format'
import { checkReceipts } from '../../lib/receiptFiles'
import { useSubmit } from '../../lib/useSubmit'
import { useToast } from '../../lib/toast'


/** Record money spent without a supplier bill: pick a category (expense account), what it was paid from, and an optional receipt. */
export function ExpenseForm() {
  const nav = useNavigate()
  const toast = useToast()
  const rates = useTaxRates()
  const [accts, setAccts] = useState<Account[]>([])
  const [date, setDate] = useState(todayDubai())
  const [category, setCategory] = useState('')
  const [paidThrough, setPaidThrough] = useState('')
  const [vendor, setVendor] = useState('')
  const [amount, setAmount] = useState('')
  const [taxRate, setTaxRate] = useState('0')
  const [inclusive, setInclusive] = useState(false)
  const [reference, setReference] = useState('')
  const [narration, setNarration] = useState('')
  const [branch, setBranch] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [billable, setBillable] = useState(false)
  const [customer, setCustomer] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  useEffect(() => { accounts.list().then(setAccts) }, [])

  const amt = Number(amount || 0)
  const rate = Number(taxRate || 0)
  const sub = inclusive ? amt / (1 + rate / 100) : amt
  const tax = inclusive ? amt - sub : (amt * rate) / 100
  const total = inclusive ? amt : amt + tax

  const pick = (list: FileList | null) => {
    const all = Array.from(list ?? [])
    const c = checkReceipts(all)
    setFileError(c.message)
    setFiles(c.ok ? all : [])
  }

  const { submit, busy, error } = useSubmit(
    (idempotency_key) =>
      documents('expenses').create({
        date, idempotency_key, amount, tax_rate: taxRate || '0', amount_includes_tax: inclusive, reference, narration,
        expense_account: Number(category), paid_through: Number(paidThrough), vendor: vendor ? Number(vendor) : null,
        branch: branch ? Number(branch) : null, is_billable: billable, customer: billable && customer ? Number(customer) : null,
      }),
    async (doc: any) => {
      for (const f of files) {
        try { await expenses.addReceipt(doc.id, f) } catch (e: any) {
          toast.error(`${doc.number} saved, but a receipt could not be attached: ${e.message}`)
          nav('/expenses'); return
        }
      }
      toast.success(doc.status === 'pending' ? `${doc.number} saved and waiting for approval` : `${doc.number} recorded`)
      nav('/expenses')
    },
  )

  return (
    <form className="max-w-3xl space-y-4" onSubmit={(e) => { e.preventDefault(); submit() }}>
      <PageHeader title="New expense" subtitle="Money spent that has no supplier bill: fuel, rent, bank fees, small purchases" />
      <ErrorBox error={error} />
      <Card className="grid gap-3 sm:grid-cols-2">
        <Label text="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Label>
        <BranchSelect value={branch} onChange={setBranch} />
        <Label text="Expense category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)} required>
            <option value="">Choose…</option>
            {accts.filter((a) => a.type === 'expense').map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
          </Select>
        </Label>
        <Label text="Paid through">
          <Select value={paidThrough} onChange={(e) => setPaidThrough(e.target.value)} required>
            <option value="">Choose cash or bank…</option>
            {accts.filter((a) => a.is_cash_bank).map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
          </Select>
        </Label>
        <Label text="Amount"><Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Label>
        <Label text="Tax"><TaxSelect value={taxRate} onChange={setTaxRate} rates={rates.data} /></Label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={inclusive} onChange={(e) => setInclusive(e.target.checked)} /> The amount I entered already includes tax
        </label>
        <div className="sm:col-span-2"><TaxHint rates={rates.data} /></div>
        <div className="sm:col-span-2"><Label text="Supplier (optional)"><PartySelect kind="supplier" value={vendor} onChange={setVendor} optional /></Label></div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} /> Billable: charge this cost to a customer on a sales invoice
        </label>
        {billable && <div className="sm:col-span-2"><Label text="Customer to bill"><PartySelect kind="customer" value={customer} onChange={setCustomer} /></Label></div>}
        <Label text="Reference (optional)"><Input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} /></Label>
        <Label text="Notes (optional)"><Input value={narration} onChange={(e) => setNarration(e.target.value)} maxLength={500} /></Label>
        <div className="sm:col-span-2">
          <Label text="Receipts (optional, up to 5 files: PDF, PNG or JPEG, 5 MB each)">
            <Input type="file" multiple accept="application/pdf,image/png,image/jpeg" onChange={(e) => pick(e.target.files)} />
          </Label>
          {fileError && <p className="mt-1 text-sm text-red-600">{fileError}</p>}
        </div>
      </Card>
      <Card className="flex justify-end gap-6 text-sm text-slate-700">
        <span>Before tax {money(sub)}</span><span>Tax {money(tax)}</span><span className="font-semibold">Total {money(total)}</span>
      </Card>
      <div className="flex gap-2">
        <Button disabled={busy || !category || !paidThrough || !(amt > 0) || (billable && !customer)}>{busy ? 'Saving…' : 'Record expense'}</Button>
        <Button type="button" variant="ghost" onClick={() => nav('/expenses')}>Cancel</Button>
      </div>
    </form>
  )
}
