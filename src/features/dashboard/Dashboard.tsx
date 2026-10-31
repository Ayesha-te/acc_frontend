import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { documents, report } from '../../api/endpoints'
import { Badge, Card, ErrorBox, PageHeader, Spinner, StatCard } from '../../components/ui'
import { money, periodPresets, todayDubai } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'
import { useAuth } from '../auth/AuthContext'

const actions: [string, string, string][] = [
  ['/sales/new', 'New sales invoice', 'Bill a customer'],
  ['/receipts/new', 'Receive money', 'Record a customer payment'],
  ['/purchases/new', 'New purchase invoice', 'Record a supplier bill'],
  ['/payments/new', 'Pay a supplier', 'Record a payment out'],
  ['/vouchers/journal/new', 'Journal entry', 'Adjustments and corrections'],
  ['/dispatch/loads/new', 'Load a van', 'Send stock out for delivery'],
]

export function Dashboard() {
  const { org } = useAuth()
  const canWrite = org?.role !== 'viewer'
  const month = periodPresets()[0]
  const { data, loading, error } = useFetch(async () => {
    const [ar, ap, bal, pl, sales, purchases] = await Promise.all([
      report('aging', { type: 'receivable', as_of: todayDubai() }),
      report('aging', { type: 'payable', as_of: todayDubai() }),
      api<any[]>('/accounts/balances/'),
      report('profit-loss', { date_from: month.from, date_to: month.to }),
      documents('sales/invoices').list({ page_size: 5, kind: 'invoice' }),
      documents('purchases/invoices').list({ page_size: 5, kind: 'invoice' }),
    ])
    const cash = bal.filter((b) => b.is_cash_bank).reduce((s, b) => s + Number(b.debit) - Number(b.credit), 0)
    return { ar, ap, cash, pl, sales: sales.results, purchases: purchases.results }
  }, [org?.id])

  const recent = (title: string, rows: any[], to: string) => (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        <Link to={to} className="text-sm text-indigo-600 hover:underline">View all</Link>
      </div>
      {rows.length === 0 ? <p className="px-4 py-6 text-sm text-slate-500">Nothing yet.</p> : (
        <ul>
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-sm first:border-t-0">
              <div><div className="font-medium">{r.number}</div><div className="text-xs text-slate-500">{r.party_name} · {r.date}</div></div>
              <div className="text-right"><div className="tabular-nums">{money(r.total)}</div><Badge value={r.status} /></div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`${org?.name ?? ''} · ${todayDubai()}`} />
      <ErrorBox error={error} />
      {loading && !data && <Spinner />}
      {data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Customers owe you" value={money(data.ar.totals.ledger_balance)} hint="Receivables" tone="text-emerald-700" />
            <StatCard label="You owe suppliers" value={money(data.ap.totals.ledger_balance)} hint="Payables" tone="text-amber-700" />
            <StatCard label="Cash & bank" value={money(data.cash)} hint="Across cash and bank accounts" />
            <StatCard label={`Profit — ${month.label.toLowerCase()}`} value={money(data.pl.net_profit)} hint={`Income ${money(data.pl.total_income)} · Expenses ${money(data.pl.total_expenses)}`}
              tone={Number(data.pl.net_profit) < 0 ? 'text-red-600' : 'text-slate-900'} />
          </div>
          {canWrite && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Quick actions</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {actions.map(([to, title, text]) => (
                  <Link key={to} to={to} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow">
                    <div className="font-medium text-slate-900">{title}</div>
                    <div className="text-sm text-slate-500">{text}</div>
                  </Link>
                ))}
              </div>
            </section>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {recent('Recent sales', data.sales, '/sales')}
            {recent('Recent purchases', data.purchases, '/purchases')}
          </div>
        </div>
      )}
    </div>
  )
}
