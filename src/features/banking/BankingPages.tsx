import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Account, accounts, BankCandidate, BankLine, banking } from '../../api/endpoints'
import { Badge, Button, Card, EmptyState, ErrorBox, Input, Label, Modal, PageHeader, Select, Spinner, StatCard } from '../../components/ui'
import { money } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'
import { useToast } from '../../lib/toast'
import { useAuth } from '../auth/AuthContext'

const tone = (s: string) => (s === 'reconciled' || s === 'matched' ? 'posted' : s === 'partial' ? 'draft' : s === 'unmatched' ? 'void' : undefined)

/** Statement list and CSV import. Importing only records the bank's own lines; nothing is posted to the ledger. */
export function BankStatementsPage() {
  const { org } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const list = useFetch(() => banking.list(), [org?.id])
  const [accts, setAccts] = useState<Account[]>([])
  const [account, setAccount] = useState('')
  const [opening, setOpening] = useState('')
  const [closing, setClosing] = useState('')
  const [fmt, setFmt] = useState('iso')
  const [skip, setSkip] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<{ row: number; error: string }[]>([])
  useEffect(() => { accounts.list().then((a) => setAccts(a.filter((x) => x.is_cash_bank))) }, [org?.id])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) return
    setBusy(true); setError(null); setRowErrors([])
    try {
      const st = await banking.import(file, { account, opening_balance: opening, closing_balance: closing, date_format: fmt, skip_duplicates: String(skip) })
      toast.success(`Imported ${st.summary?.line_count ?? 0} lines${st.skipped_duplicates ? `, skipped ${st.skipped_duplicates} duplicates` : ''}`)
      st.warnings?.forEach((w) => toast.error(w))
      nav(`/banking/${st.id}`)
    } catch (err: any) {
      setError(err.message); setRowErrors(err.body?.errors ?? [])
    } finally { setBusy(false) }
  }

  return (
    <div className="max-w-5xl space-y-4">
      <PageHeader title="Bank statements" subtitle="Import a CSV from your bank, match its lines to what is already in your books, then reconcile. Nothing is posted by importing or matching." />
      <Card>
        <h2 className="mb-3 text-sm font-semibold">Import a statement</h2>
        <ErrorBox error={error} />
        {rowErrors.length > 0 && <ul className="mb-3 list-disc pl-5 text-sm text-red-700">{rowErrors.map((r) => <li key={r.row}>Row {r.row}: {r.error}</li>)}</ul>}
        <form className="grid gap-3 sm:grid-cols-3" onSubmit={submit}>
          <Label text="Bank or cash account">
            <Select value={account} onChange={(e) => setAccount(e.target.value)} required>
              <option value="">Choose…</option>
              {accts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </Select>
          </Label>
          <Label text="Opening balance" hint="Balance printed at the start of the statement"><Input type="number" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} required /></Label>
          <Label text="Closing balance" hint="Balance printed at the end"><Input type="number" step="0.01" value={closing} onChange={(e) => setClosing(e.target.value)} required /></Label>
          <Label text="Date format in the file">
            <Select value={fmt} onChange={(e) => setFmt(e.target.value)}>
              <option value="iso">2026-03-31 (year-month-day)</option><option value="dmy">31/03/2026 (day/month/year)</option><option value="mdy">03/31/2026 (month/day/year)</option>
            </Select>
          </Label>
          <div className="sm:col-span-2"><Label text="CSV file" hint="Columns: Date, Description, Reference, and Amount (or Debit and Credit). Up to 2 MB.">
            <Input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
          </Label></div>
          <label className="flex items-center gap-2 text-sm sm:col-span-3">
            <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} /> This file overlaps an earlier statement: skip lines already imported (then enter the balance at the start of the new lines)
          </label>
          <div><Button disabled={busy || !file || !account}>{busy ? 'Importing…' : 'Import'}</Button></div>
        </form>
      </Card>
      {list.loading ? <Spinner /> : list.error ? <ErrorBox error={list.error} /> : !list.data?.results.length ? (
        <EmptyState title="No statements yet" text="Import your first bank statement above." />
      ) : (
        <Card className="overflow-x-auto !p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-slate-500"><th className="px-4 py-2">Account</th><th>Period</th><th className="text-right">Opening</th><th className="text-right">Closing</th><th>Lines</th><th>Status</th><th /></tr></thead>
            <tbody>{list.data.results.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-2">{s.account_name}</td><td>{s.period_start} → {s.period_end}</td>
                <td className="text-right">{money(s.opening_balance)}</td><td className="text-right">{money(s.closing_balance)}</td>
                <td>{s.line_count}</td><td><Badge value={s.status} tone={tone(s.status)} /></td>
                <td className="pr-4 text-right"><Link className="text-indigo-600 underline" to={`/banking/${s.id}`}>Open</Link></td>
              </tr>))}</tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

/** One statement: summary with the difference, the lines, and matching. */
export function BankStatementPage() {
  const { id } = useParams()
  const sid = Number(id)
  const { org } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const st = useFetch(() => banking.get(sid), [org?.id, sid])
  const lines = useFetch(() => banking.lines(sid), [org?.id, sid])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState<BankLine | null>(null)
  const reload = () => { st.reload(); lines.reload() }

  const run = async (fn: () => Promise<unknown>, ok?: (r: any) => string) => {
    setBusy(true); setError(null)
    try { const r = await fn(); if (ok) toast.success(ok(r)); reload() } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  if (st.loading && !st.data) return <Spinner />
  if (st.error || !st.data) return <ErrorBox error={st.error ?? 'Statement not found'} />
  const s = st.data, sum = s.summary!
  const done = s.status === 'reconciled'
  const diff = Number(sum.difference)

  return (
    <div className="max-w-6xl space-y-4">
      <PageHeader title={`${s.account_name}: ${s.period_start} → ${s.period_end}`} subtitle={s.file_name}
        actions={<Link className="text-sm text-indigo-600 underline" to="/banking">All statements</Link>} />
      <ErrorBox error={error} />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Difference" value={money(diff)} tone={diff === 0 ? 'text-green-700' : 'text-red-600'} hint="Closing balance minus opening balance minus everything matched" />
        <StatCard label="Matched / Partial / Unmatched" value={`${sum.matched_lines} / ${sum.partial_lines} / ${sum.unmatched_lines}`} />
        <StatCard label="Books at period end" value={money(sum.book_balance_at_period_end)} hint={`${sum.uncleared_book_items} entries not on this statement (${money(sum.uncleared_book_net)})`} />
        <StatCard label="Status" value={done ? 'Reconciled' : 'In progress'} hint={done ? `by ${s.reconciled_by_name ?? ''}` : sum.stale_matches ? `${sum.stale_matches} matched entries were voided` : undefined} />
      </div>
      <div className="flex flex-wrap gap-2">
        {!done && <Button variant="subtle" disabled={busy} onClick={() => run(() => banking.autoMatch(sid), (r) => `Matched ${r.matched}; ${r.ambiguous} ambiguous, ${r.no_candidate} with no candidate`)}>Auto-match</Button>}
        {!done && <Button disabled={busy || !sum.can_complete} onClick={() => run(() => banking.complete(sid), () => 'Statement reconciled')}>Mark as reconciled</Button>}
        {done && <Button variant="subtle" disabled={busy} onClick={() => run(() => banking.reopen(sid), () => 'Reconciliation reopened')}>Reopen</Button>}
        {!done && <Button variant="ghost" disabled={busy} onClick={() => { if (confirm('Discard this imported statement and its matches? Your books are not affected.')) run(() => banking.discard(sid)).then(() => nav('/banking')) }}>Discard import</Button>}
      </div>
      {!done && !sum.can_complete && <p className="text-sm text-slate-600">To reconcile, every line must be fully matched and the difference must be zero. If the bank shows something your books do not (a fee, interest), record it first (for example as an expense paid through this account), then match it here.</p>}
      <Card className="overflow-x-auto !p-0">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-slate-500"><th className="px-4 py-2">Date</th><th>Description</th><th>Reference</th><th className="text-right">Amount</th><th className="text-right">Matched</th><th>Status</th><th>Matched to</th></tr></thead>
          <tbody>{(lines.data ?? []).map((l) => (
            <tr key={l.id} className="border-b align-top last:border-0">
              <td className="px-4 py-2 whitespace-nowrap">{l.date}</td><td>{l.description}</td><td>{l.reference}</td>
              <td className={`text-right ${Number(l.amount) < 0 ? 'text-red-700' : ''}`}>{money(l.amount)}</td><td className="text-right">{money(l.matched_amount)}</td>
              <td><Badge value={l.status} tone={tone(l.status)} /></td>
              <td className="py-2 pr-4">
                {l.matches.map((m) => (
                  <div key={m.id} className="flex items-center gap-2">
                    <span className={m.stale ? 'text-red-600 line-through' : ''}>{m.reference} {m.ledger_date} · {money(m.amount)}{m.stale ? ' (voided)' : ''}</span>
                    {!done && <button type="button" className="text-xs text-indigo-600 underline" disabled={busy} onClick={() => run(() => banking.unmatch(sid, m.id))}>Unmatch</button>}
                  </div>))}
                {!done && l.status !== 'matched' && <Button variant="subtle" className="mt-1" onClick={() => setPicking(l)}>Match…</Button>}
              </td>
            </tr>))}</tbody>
        </table>
      </Card>
      {picking && <CandidateModal statementId={sid} line={picking} onClose={() => setPicking(null)} onDone={() => { setPicking(null); reload() }} />}
    </div>
  )
}

function CandidateModal({ statementId, line, onClose, onDone }: { statementId: number; line: BankLine; onClose(): void; onDone(): void }) {
  const [days, setDays] = useState(30)
  const cands = useFetch<BankCandidate[]>(() => banking.candidates(statementId, line.id, days), [line.id, days])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const left = Math.abs(Number(line.amount)) - Number(line.matched_amount)
  const pick = async (c: BankCandidate) => {
    setBusy(true); setError(null)
    try { await banking.match(statementId, line.id, c.journal_line); onDone() } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal title={`Match ${money(line.amount)} on ${line.date}`} onClose={onClose} wide>
      <ErrorBox error={error} />
      <p className="mb-3 text-sm text-slate-600">Still to match: {money(left)}. If an entry is smaller than the line, only its amount is matched and the rest stays open.</p>
      <div className="mb-3 w-40"><Label text="Look within (days)"><Input type="number" min={0} max={366} value={days} onChange={(e) => setDays(Number(e.target.value))} /></Label></div>
      {cands.loading ? <Spinner /> : !cands.data?.length ? <p className="text-sm text-slate-500">No unmatched entries on this account in that window. Record the transaction first, then match it.</p> : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-500"><th>Date</th><th>Reference</th><th>Party</th><th className="text-right">Left to clear</th><th /></tr></thead>
          <tbody>{cands.data.map((c) => (
            <tr key={c.journal_line} className="border-t">
              <td>{c.date}</td><td>{c.reference} <span className="text-slate-400">{c.source_type}</span></td><td>{c.party ?? ''}</td>
              <td className="text-right">{money(c.remaining)}{c.exact && <span className="ml-2 text-green-700">exact</span>}</td>
              <td className="text-right"><Button variant="subtle" disabled={busy} onClick={() => pick(c)}>Match</Button></td>
            </tr>))}</tbody>
        </table>
      )}
    </Modal>
  )
}
