import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Account, accounts, documents } from '../../api/endpoints'
import { Button, Card, ErrorBox, Input, Label, PageHeader, Select } from '../../components/ui'
import { money, todayDubai } from '../../lib/format'
import { useSubmit } from '../../lib/useSubmit'
import { useToast } from '../../lib/toast'

type Line = { account: string; debit: string; credit: string; description: string }
const blank = (): Line => ({ account: '', debit: '', credit: '', description: '' })

export function VoucherForm({ type }: { type: 'general' | 'journal' | 'contra' }) {
  const nav = useNavigate()
  const toast = useToast()
  const [accts, setAccts] = useState<Account[]>([])
  const [date, setDate] = useState(todayDubai())
  const [narration, setNarration] = useState('')
  const [lines, setLines] = useState<Line[]>([blank(), blank()])
  useEffect(() => { accounts.list().then((a) => setAccts(type === 'contra' ? a.filter((x) => x.is_cash_bank) : a)) }, [type])

  const set = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const dr = lines.reduce((s, l) => s + Number(l.debit || 0), 0)
  const cr = lines.reduce((s, l) => s + Number(l.credit || 0), 0)
  const balanced = dr > 0 && Math.abs(dr - cr) < 0.005

  const { submit, busy, error } = useSubmit(
    (idempotency_key) =>
      documents('vouchers').create({
        type, date, narration, idempotency_key,
        lines: lines.filter((l) => l.account).map((l) => ({ account: Number(l.account), debit: l.debit || '0', credit: l.credit || '0', description: l.description })),
      }),
    (doc: any) => { toast.success(`${doc.number} posted`); nav(`/vouchers/${type}`) },
  )

  return (
    <form className="max-w-4xl space-y-4" onSubmit={(e) => { e.preventDefault(); submit() }}>
      <PageHeader title={`New ${type} voucher`} subtitle={{ journal: 'For standard adjustments and journal entries', general: 'For transactions that have no dedicated screen', contra: 'Move money between cash and bank accounts' }[type]} />
      <ErrorBox error={error} />
      <Card className="grid gap-3 sm:grid-cols-3">
        <Label text="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Label>
        <div className="sm:col-span-2"><Label text="Narration"><Input value={narration} onChange={(e) => setNarration(e.target.value)} /></Label></div>
      </Card>
      <Card className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <Select className="col-span-12 sm:col-span-5" value={l.account} onChange={(e) => set(i, { account: e.target.value })} aria-label="Account">
              <option value="">Account…</option>
              {accts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </Select>
            <Input className="col-span-5 sm:col-span-3" type="number" step="0.01" min="0" placeholder="Debit" value={l.debit} onChange={(e) => set(i, { debit: e.target.value, credit: e.target.value ? '' : l.credit })} aria-label="Debit" />
            <Input className="col-span-5 sm:col-span-3" type="number" step="0.01" min="0" placeholder="Credit" value={l.credit} onChange={(e) => set(i, { credit: e.target.value, debit: e.target.value ? '' : l.debit })} aria-label="Credit" />
            <Button type="button" variant="ghost" className="col-span-2 sm:col-span-1" disabled={lines.length <= 2} onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Remove line">×</Button>
          </div>
        ))}
        <Button type="button" variant="ghost" onClick={() => setLines([...lines, blank()])}>+ Add line</Button>
        <div className={`flex justify-end gap-6 text-sm ${balanced ? 'text-green-700' : 'text-red-600'}`}>
          <span>Debit {money(dr)}</span><span>Credit {money(cr)}</span><span>{balanced ? 'Balanced' : 'Not balanced'}</span>
        </div>
      </Card>
      <div className="flex gap-2">
        <Button disabled={busy || !balanced}>{busy ? 'Saving…' : 'Post'}</Button>
        <Button type="button" variant="ghost" onClick={() => nav(`/vouchers/${type}`)}>Cancel</Button>
      </div>
    </form>
  )
}
