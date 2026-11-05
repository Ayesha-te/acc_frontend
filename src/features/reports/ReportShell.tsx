import { ReactNode, useState } from 'react'
import { Button, Card, ErrorBox, Input, PageHeader, Spinner } from '../../components/ui'
import { money, periodPresets, todayDubai } from '../../lib/format'

/** Date-range state with one-click presets (all computed from today's date in Dubai). */
export function useRange(initial = 'month') {
  const presets = periodPresets()
  const start = presets.find((p) => p.key === initial) ?? presets[0]
  const [from, setFrom] = useState(start.from)
  const [to, setTo] = useState(start.to)
  const [active, setActive] = useState(start.key)
  return {
    from, to, active, presets,
    setFrom: (v: string) => { setFrom(v); setActive('') },
    setTo: (v: string) => { setTo(v); setActive('') },
    pick: (key: string) => { const p = presets.find((x) => x.key === key)!; setFrom(p.from); setTo(p.to); setActive(key) },
  }
}

export function useAsOf() {
  const [asOf, setAsOf] = useState(todayDubai())
  return { asOf, setAsOf }
}

export function RangeBar({ r }: { r: ReturnType<typeof useRange> }) {
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {r.presets.map((p) => (
          <button key={p.key} onClick={() => r.pick(p.key)}
            className={`rounded-full px-3 py-1 text-sm ${r.active === p.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{p.label}</button>
        ))}
      </div>
      <label className="text-xs text-slate-500">From<Input type="date" className="mt-0.5 w-40" value={r.from} onChange={(e) => r.setFrom(e.target.value)} aria-label="From date" /></label>
      <label className="text-xs text-slate-500">To<Input type="date" className="mt-0.5 w-40" value={r.to} onChange={(e) => r.setTo(e.target.value)} aria-label="To date" /></label>
    </>
  )
}

export function AsOfBar({ v, set }: { v: string; set(x: string): void }) {
  return <label className="text-xs text-slate-500">As of<Input type="date" className="mt-0.5 w-40" value={v} onChange={(e) => set(e.target.value)} aria-label="As of date" /></label>
}

export function ReportShell({ title, subtitle, filters, loading, error, onCsv, children, note }: {
  title: string; subtitle?: string; filters: ReactNode; loading: boolean; error: string | null; onCsv?: () => void; children: ReactNode; note?: string
}) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle}
        actions={<div className="no-print flex gap-2">{onCsv && <Button variant="ghost" onClick={onCsv}>Export CSV</Button>}<Button variant="ghost" onClick={() => window.print()}>Print</Button></div>} />
      <Card className="no-print mb-4 flex flex-wrap items-end gap-3">{filters}</Card>
      <ErrorBox error={error} />
      {note && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{note}</p>}
      {loading && <Spinner />}
      <div className={loading ? 'opacity-50' : ''}>{children}</div>
    </div>
  )
}

export const Amount = ({ v, bold }: { v: string | number; bold?: boolean }) => (
  <span className={`tabular-nums ${Number(v) < 0 ? 'text-red-600' : ''} ${bold ? 'font-semibold' : ''}`}>{money(v)}</span>
)

export function Section({ title, rows, total, totalLabel }: { title: string; rows: { code?: string; name: string; amount: string; depth?: number; rollup_amount?: string }[]; total: string; totalLabel: string }) {
  const nested = rows.some((r) => r.depth !== undefined && r.rollup_amount !== undefined && r.rollup_amount !== r.amount)
  return (
    <Card className="p-0">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold">{title}</div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100 first:border-t-0">
              <td className="px-4 py-2 text-slate-500">{r.code}</td><td className="px-4 py-2" style={{ paddingLeft: 16 + (r.depth ?? 0) * 18 }}>{r.name}</td>
              {nested && <td className="px-4 py-2 text-right text-slate-400" title="Including sub-accounts">{r.rollup_amount !== undefined && r.rollup_amount !== r.amount ? <Amount v={r.rollup_amount} /> : ''}</td>}
              <td className="px-4 py-2 text-right"><Amount v={r.amount} /></td>
            </tr>
          ))}
          {!rows.length && <tr><td className="px-4 py-3 text-slate-500" colSpan={4}>No entries in this period.</td></tr>}
          <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
            <td className="px-4 py-2" colSpan={nested ? 3 : 2}>{totalLabel}</td><td className="px-4 py-2 text-right"><Amount v={total} bold /></td>
          </tr>
        </tbody>
      </table>
    </Card>
  )
}
