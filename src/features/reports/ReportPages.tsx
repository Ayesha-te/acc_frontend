import { useState } from 'react'
import { report } from '../../api/endpoints'
import { Badge, Card, Select } from '../../components/ui'
import { downloadCsv } from '../../lib/csv'
import { money } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'
import { useAuth } from '../auth/AuthContext'
import { Amount, AsOfBar, RangeBar, ReportShell, Section, useAsOf, useRange } from './ReportShell'

const th = 'px-4 py-2 font-medium'
const Table = ({ head, children, right = 1 }: { head: string[]; children: React.ReactNode; right?: number }) => (
  <Card className="overflow-x-auto p-0">
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
        <tr>{head.map((h, i) => <th key={h} className={`${th} ${i >= head.length - right ? 'text-right' : ''}`}>{h}</th>)}</tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </Card>
)

export function ProfitLossPage() {
  const { org } = useAuth()
  const r = useRange()
  const { data, loading, error } = useFetch(() => report('profit-loss', { date_from: r.from, date_to: r.to }), [org?.id, r.from, r.to])
  return (
    <ReportShell title="Profit & Loss" subtitle="Income less expenses for the period" loading={loading} error={error}
      filters={<RangeBar r={r} />}
      onCsv={data && (() => downloadCsv('profit-loss.csv', ['Section', 'Code', 'Account', 'Amount'], [
        ...data.income.map((x: any) => ['Income', x.code, x.name, x.amount]), ['Income', '', 'Total income', data.total_income],
        ...data.expenses.map((x: any) => ['Expense', x.code, x.name, x.amount]), ['Expense', '', 'Total expenses', data.total_expenses],
        ['', '', 'Net profit', data.net_profit]]))}>
      {data && (
        <div className="space-y-4">
          <Section title="Income" rows={data.income} total={data.total_income} totalLabel="Total income" />
          <Section title="Expenses" rows={data.expenses} total={data.total_expenses} totalLabel="Total expenses" />
          <Card className="flex items-center justify-between text-lg font-semibold"><span>{Number(data.net_profit) < 0 ? 'Net loss' : 'Net profit'}</span><Amount v={data.net_profit} bold /></Card>
        </div>
      )}
    </ReportShell>
  )
}

export function BalanceSheetPage() {
  const { org } = useAuth()
  const a = useAsOf()
  const { data, loading, error } = useFetch(() => report('balance-sheet', { as_of: a.asOf }), [org?.id, a.asOf])
  return (
    <ReportShell title="Balance Sheet" subtitle="What you own, owe and the owners' stake" loading={loading} error={error}
      filters={<AsOfBar v={a.asOf} set={a.setAsOf} />}
      note="Profit that has not yet been closed into equity is shown as 'Current year earnings'; once a fiscal year is closed, its result moves to 'Retained earnings (prior fiscal years)'."
      onCsv={data && (() => downloadCsv('balance-sheet.csv', ['Section', 'Code', 'Account', 'Amount'], [
        ...data.assets.map((x: any) => ['Assets', x.code, x.name, x.amount]), ['Assets', '', 'Total assets', data.total_assets],
        ...data.liabilities.map((x: any) => ['Liabilities', x.code, x.name, x.amount]), ['Liabilities', '', 'Total liabilities', data.total_liabilities],
        ...data.equity.map((x: any) => ['Equity', x.code, x.name, x.amount]), ['Equity', '', 'Retained earnings (prior fiscal years)', data.retained_earnings_prior_years], ['Equity', '', 'Current year earnings', data.current_year_earnings],
        ['Equity', '', 'Total liabilities and equity', data.total_liabilities_and_equity]]))}>
      {data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Assets" rows={data.assets} total={data.total_assets} totalLabel="Total assets" />
          <div className="space-y-4">
            <Section title="Liabilities" rows={data.liabilities} total={data.total_liabilities} totalLabel="Total liabilities" />
            <Section title="Equity" rows={[...data.equity, { name: 'Retained earnings (prior fiscal years)', amount: data.retained_earnings_prior_years }, { name: 'Current year earnings', amount: data.current_year_earnings }]}
              total={String(Number(data.total_equity) + Number(data.current_period_earnings))} totalLabel="Total equity" />
            <Card className="flex items-center justify-between text-sm">
              <span>Liabilities + equity = {money(data.total_liabilities_and_equity)}</span>
              <Badge value={data.balanced ? 'balanced' : 'out of balance'} tone={data.balanced ? 'posted' : 'void'} />
            </Card>
          </div>
        </div>
      )}
    </ReportShell>
  )
}

export function TrialBalancePage() {
  const { org } = useAuth()
  const a = useAsOf()
  const { data, loading, error } = useFetch(() => report('trial-balance', { as_of: a.asOf }), [org?.id, a.asOf])
  return (
    <ReportShell title="Trial Balance" subtitle="Every account's balance; debits must equal credits" loading={loading} error={error}
      filters={<AsOfBar v={a.asOf} set={a.setAsOf} />}
      onCsv={data && (() => downloadCsv('trial-balance.csv', ['Code', 'Account', 'Type', 'Debit', 'Credit'],
        [...data.rows.map((x: any) => [x.code, x.name, x.type, x.debit, x.credit]), ['', 'Total', '', data.total_debit, data.total_credit]]))}>
      {data && (
        <Table head={['Code', 'Account', 'Type', 'Debit', 'Credit']} right={2}>
          {data.rows.map((x: any) => (
            <tr key={x.account} className="border-t border-slate-100">
              <td className="px-4 py-2 text-slate-500">{x.code}</td><td className="px-4 py-2" style={{ paddingLeft: 16 + (x.depth ?? 0) * 18 }}>{x.name}{(x.rollup_debit !== x.debit || x.rollup_credit !== x.credit) && <span className="ml-2 text-xs text-slate-400">(with sub-accounts: {Number(x.rollup_debit) ? `Dr ${money(x.rollup_debit)}` : Number(x.rollup_credit) ? `Cr ${money(x.rollup_credit)}` : '0'})</span>}</td><td className="px-4 py-2 capitalize text-slate-500">{x.type}</td>
              <td className="px-4 py-2 text-right tabular-nums">{Number(x.debit) ? money(x.debit) : ''}</td>
              <td className="px-4 py-2 text-right tabular-nums">{Number(x.credit) ? money(x.credit) : ''}</td>
            </tr>
          ))}
          {!data.rows.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No entries yet.</td></tr>}
          <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
            <td className="px-4 py-2" colSpan={3}>Total {data.balanced ? '✓ balanced' : '✗ OUT OF BALANCE'}</td>
            <td className="px-4 py-2 text-right tabular-nums">{money(data.total_debit)}</td><td className="px-4 py-2 text-right tabular-nums">{money(data.total_credit)}</td>
          </tr>
        </Table>
      )}
    </ReportShell>
  )
}

export function AgingPage() {
  const { org } = useAuth()
  const a = useAsOf()
  const [type, setType] = useState<'receivable' | 'payable'>('receivable')
  const { data, loading, error } = useFetch(() => report('aging', { type, as_of: a.asOf }), [org?.id, type, a.asOf])
  return (
    <ReportShell title="Aging" subtitle="Unpaid invoices by how long they are overdue" loading={loading} error={error}
      filters={<>
        <label className="text-xs text-slate-500">Show<Select className="mt-0.5 w-48" value={type} onChange={(e) => setType(e.target.value as any)} aria-label="Aging type">
          <option value="receivable">Customers (receivable)</option><option value="payable">Suppliers (payable)</option></Select></label>
        <AsOfBar v={a.asOf} set={a.setAsOf} />
      </>}
      note="Days overdue are counted from each invoice's due date. 'Unapplied / adjustments' is money received or paid that is not yet matched to an invoice (negative = credit), plus journal adjustments, so the total always agrees with the ledger."
      onCsv={data && (() => downloadCsv(`aging-${type}.csv`, ['Party', ...data.labels, 'Outstanding', 'Unapplied/adjustments', 'Ledger balance'],
        [...data.rows.map((r: any) => [r.party_name, ...data.labels.map((l: string) => r.buckets[l]), r.outstanding, r.unapplied, r.ledger_balance]),
          ['Total', ...data.labels.map((l: string) => data.totals.buckets[l]), data.totals.outstanding, data.totals.unapplied, data.totals.ledger_balance]]))}>
      {data && (
        <Table head={[type === 'receivable' ? 'Customer' : 'Supplier', ...data.labels.map((l: string) => (l === 'current' ? 'Not yet due' : `${l} days`)), 'Outstanding', 'Unapplied / adjustments', 'Ledger balance']} right={data.labels.length + 3}>
          {data.rows.map((r: any) => (
            <tr key={r.party} className="border-t border-slate-100">
              <td className="px-4 py-2 font-medium">{r.party_name}</td>
              {data.labels.map((l: string) => <td key={l} className="px-4 py-2 text-right"><Amount v={r.buckets[l]} /></td>)}
              <td className="px-4 py-2 text-right"><Amount v={r.outstanding} bold /></td><td className="px-4 py-2 text-right"><Amount v={r.unapplied} /></td><td className="px-4 py-2 text-right"><Amount v={r.ledger_balance} bold /></td>
            </tr>
          ))}
          {!data.rows.length && <tr><td colSpan={data.labels.length + 4} className="px-4 py-8 text-center text-slate-500">Nothing outstanding as of this date.</td></tr>}
          {data.rows.length > 0 && (
            <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
              <td className="px-4 py-2">Total</td>
              {data.labels.map((l: string) => <td key={l} className="px-4 py-2 text-right"><Amount v={data.totals.buckets[l]} bold /></td>)}
              <td className="px-4 py-2 text-right"><Amount v={data.totals.outstanding} bold /></td><td className="px-4 py-2 text-right"><Amount v={data.totals.unapplied} bold /></td><td className="px-4 py-2 text-right"><Amount v={data.totals.ledger_balance} bold /></td>
            </tr>
          )}
        </Table>
      )}
    </ReportShell>
  )
}

export function VendorReportPage() {
  const { org } = useAuth()
  const r = useRange('year')
  const { data, loading, error } = useFetch(() => report('vendor', { date_from: r.from, date_to: r.to }), [org?.id, r.from, r.to])
  const cols = ['opening', 'purchases', 'returns', 'payments', 'other', 'closing']
  return (
    <ReportShell title="Vendor report" subtitle="What you bought from, and paid, each supplier" loading={loading} error={error}
      filters={<RangeBar r={r} />}
      onCsv={data && (() => downloadCsv('vendor-report.csv', ['Supplier', ...cols], [...data.rows.map((x: any) => [x.party_name, ...cols.map((c) => x[c])]), ['Total', ...cols.map((c) => data.totals[c])]]))}>
      {data && (
        <Table head={['Supplier', 'Opening', 'Purchases', 'Returns', 'Payments', 'Adjustments', 'Closing balance']} right={6}>
          {data.rows.map((x: any) => (
            <tr key={x.party} className="border-t border-slate-100">
              <td className="px-4 py-2 font-medium">{x.party_name}</td>
              {cols.map((c) => <td key={c} className="px-4 py-2 text-right"><Amount v={x[c]} bold={c === 'closing'} /></td>)}
            </tr>
          ))}
          {!data.rows.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No supplier activity in this period.</td></tr>}
          {data.rows.length > 0 && (
            <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
              <td className="px-4 py-2">Total</td>{cols.map((c) => <td key={c} className="px-4 py-2 text-right"><Amount v={data.totals[c]} bold /></td>)}
            </tr>
          )}
        </Table>
      )}
    </ReportShell>
  )
}

export function SalesSummaryPage() {
  const { org } = useAuth()
  const r = useRange('year')
  const [group, setGroup] = useState('month')
  const { data, loading, error } = useFetch(() => report('sales-summary', { date_from: r.from, date_to: r.to, group_by: group }), [org?.id, r.from, r.to, group])
  const cols = ['sales', 'sales_tax', 'returns_subtotal', 'net_sales', 'net_total']
  return (
    <ReportShell title="Sales summary" subtitle="Sales, returns and tax over time or by customer" loading={loading} error={error}
      filters={<>
        <RangeBar r={r} />
        <label className="text-xs text-slate-500">Group by<Select className="mt-0.5 w-40" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Group by">
          <option value="month">Month</option><option value="day">Day</option><option value="customer">Customer</option></Select></label>
      </>}
      onCsv={data && (() => downloadCsv('sales-summary.csv', ['Group', 'Invoices', 'Returns', ...cols], [...data.rows.map((x: any) => [x.label, x.invoices, x.returns, ...cols.map((c) => x[c])]),
        ['Total', data.totals.invoices, data.totals.returns, ...cols.map((c) => data.totals[c])]]))}>
      {data && (
        <Table head={[group === 'customer' ? 'Customer' : 'Period', 'Invoices', 'Returns', 'Sales', 'Sales tax', 'Returned', 'Net sales', 'Net incl. tax']} right={5}>
          {data.rows.map((x: any) => (
            <tr key={x.key} className="border-t border-slate-100">
              <td className="px-4 py-2 font-medium">{x.label}</td><td className="px-4 py-2 text-right">{x.invoices}</td><td className="px-4 py-2 text-right">{x.returns}</td>
              {cols.map((c) => <td key={c} className="px-4 py-2 text-right"><Amount v={x[c]} bold={c === 'net_total'} /></td>)}
            </tr>
          ))}
          {!data.rows.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No sales in this period.</td></tr>}
          {data.rows.length > 0 && (
            <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
              <td className="px-4 py-2">Total</td><td className="px-4 py-2 text-right">{data.totals.invoices}</td><td className="px-4 py-2 text-right">{data.totals.returns}</td>
              {cols.map((c) => <td key={c} className="px-4 py-2 text-right"><Amount v={data.totals[c]} bold /></td>)}
            </tr>
          )}
        </Table>
      )}
    </ReportShell>
  )
}

export function VatSummaryPage() {
  const { org } = useAuth()
  const r = useRange('quarter')
  const { data, loading, error } = useFetch(() => report('vat-summary', { date_from: r.from, date_to: r.to }), [org?.id, r.from, r.to])
  return (
    <ReportShell title="VAT summary" subtitle="Tax charged on sales and paid on purchases" loading={loading} error={error}
      filters={<RangeBar r={r} />}
      note="A summary from your ledger to help prepare a return. It is not a filing and does not follow an official return layout; nothing is submitted to any tax authority."
      onCsv={data && (() => downloadCsv('vat-summary.csv', ['Item', 'Amount'], [['Output tax charged', data.output_tax.charged], ['Output tax returned', data.output_tax.returned], ['Net output tax', data.output_tax.net],
        ['Input tax paid', data.input_tax.paid], ['Input tax returned', data.input_tax.returned], ['Net input tax', data.input_tax.net], ['Net payable', data.net_payable]]))}>
      {data && (
        <div className="grid gap-4 md:grid-cols-2">
          <Section title="Tax on sales (output)" rows={[{ name: 'Charged on invoices', amount: data.output_tax.charged }, { name: 'Reversed by returns', amount: String(-Number(data.output_tax.returned)) }]} total={data.output_tax.net} totalLabel="Net output tax" />
          <Section title="Tax on purchases (input)" rows={[{ name: 'Paid on invoices', amount: data.input_tax.paid }, { name: 'Reversed by returns', amount: String(-Number(data.input_tax.returned)) }]} total={data.input_tax.net} totalLabel="Net input tax" />
          <Card className="flex items-center justify-between text-lg font-semibold md:col-span-2">
            <span>{Number(data.net_payable) < 0 ? 'Net refundable' : 'Net payable'}</span><Amount v={data.net_payable} bold />
          </Card>
        </div>
      )}
    </ReportShell>
  )
}

export function VatReturnPage() {
  const { org } = useAuth()
  const r = useRange('quarter')
  const { data, loading, error } = useFetch(() => report('vat-return', { date_from: r.from, date_to: r.to }), [org?.id, r.from, r.to])
  const table = (title: string, s: any) => (
    <Card className="overflow-x-auto p-0">
      <h2 className="px-4 pt-4 text-sm font-semibold">{title}</h2>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2">Rate</th><th className="text-right">Taxable amount</th><th className="px-4 text-right">Tax</th></tr></thead>
        <tbody>
          {s.rows.map((x: any) => <tr key={x.rate} className="border-t border-slate-100"><td className="px-4 py-2">{Number(x.rate)}%{Number(x.rate) === 0 && <span className="ml-1 text-xs text-slate-400">(zero-rated or exempt; not distinguished)</span>}</td><td className="text-right tabular-nums">{money(x.taxable)}</td><td className="px-4 text-right tabular-nums">{money(x.tax)}</td></tr>)}
          <tr className="border-t font-semibold"><td className="px-4 py-2">Total</td><td className="text-right tabular-nums">{money(s.taxable)}</td><td className="px-4 text-right tabular-nums">{money(s.tax)}</td></tr>
        </tbody>
      </table>
    </Card>
  )
  return (
    <ReportShell title="VAT return worksheet" subtitle="Taxable amounts and tax by rate, from posted documents" loading={loading} error={error}
      filters={<RangeBar r={r} />}
      note="A worksheet to help prepare a return, reconciled to your tax accounts. It is not a filing and does not follow an official return layout. Entries made by manual journals appear under 'other ledger adjustments'."
      onCsv={data && (() => downloadCsv('vat-return.csv', ['Side', 'Rate', 'Taxable', 'Tax'], [...data.output.rows.map((x: any) => ['Output', x.rate, x.taxable, x.tax]), ...data.input.rows.map((x: any) => ['Input', x.rate, x.taxable, x.tax]), ['Net payable', '', '', data.net_payable]]))}>
      {data && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">{table('Sales and other income (output)', data.output)}{table('Purchases and expenses (input)', data.input)}</div>
          <Card className="flex items-center justify-between text-lg font-semibold"><span>{Number(data.net_payable) < 0 ? 'Net refundable' : 'Net payable'}</span><Amount v={data.net_payable} bold /></Card>
          {(Number(data.other_ledger_adjustments.output_tax) !== 0 || Number(data.other_ledger_adjustments.input_tax) !== 0) && (
            <Card className="text-sm text-amber-800">Other ledger adjustments (manual journals): output tax {money(data.other_ledger_adjustments.output_tax)}, input tax {money(data.other_ledger_adjustments.input_tax)}. They are not in the totals above.</Card>)}
        </div>
      )}
    </ReportShell>
  )
}
