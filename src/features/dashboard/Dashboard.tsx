import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { documents, report } from '../../api/endpoints'
import { Icon, IconName } from '../../components/icons'
import { Badge, Card, CardTitle, ErrorBox, KpiCard, PageHeader, Spinner } from '../../components/ui'
import { money, periodPresets, todayDubai } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'
import { useAuth, useCan } from '../auth/AuthContext'
import { moduleOf } from '../../components/Layout'

const icons: IconName[] = ['invoice', 'receipt', 'cart', 'payment', 'ledger', 'truck']
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
  const can = useCan()
  const quickActions = actions.map((a, i) => [...a, icons[i]] as const).filter(([to]) => can(moduleOf(to), 'create'))
  const month = periodPresets()[0]
  // Each widget loads only when the member may see that data (the server would refuse the rest).
  const show = { reports: can('reports'), cash: can('chart_of_accounts'), sales: can('sales_invoices'), purchases: can('purchase_invoices') }
  const { data, loading, error } = useFetch(async () => {
    const skip = Promise.resolve(null)
    const [ar, ap, bal, pl, sales, purchases] = await Promise.all([
      show.reports ? report('aging', { type: 'receivable', as_of: todayDubai() }) : skip,
      show.reports ? report('aging', { type: 'payable', as_of: todayDubai() }) : skip,
      show.cash ? api<any[]>('/accounts/balances/') : skip,
      show.reports ? report('profit-loss', { date_from: month.from, date_to: month.to }) : skip,
      show.sales ? documents('sales/invoices').list({ page_size: 5, kind: 'invoice' }) : skip,
      show.purchases ? documents('purchases/invoices').list({ page_size: 5, kind: 'invoice' }) : skip,
    ])
    const cash = bal ? bal.filter((b: any) => b.is_cash_bank).reduce((s: number, b: any) => s + Number(b.debit) - Number(b.credit), 0) : null
    return { ar, ap, cash, pl, sales: sales?.results ?? null, purchases: purchases?.results ?? null }
  }, [org?.id, JSON.stringify(show)])

  const recent = (title: string, icon: IconName, rows: any[], to: string) => (
    <Card className="!rounded-3xl !p-5">
      <CardTitle icon={icon} title={title} right={<Link to={to} className="text-sm font-semibold text-indigo-700 hover:underline">View all</Link>} />
      {rows.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Nothing yet.</p> : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Icon name={icon} size={18} /></span>
              <div className="min-w-0 flex-1"><div className="font-bold text-indigo-800">{r.number}</div><div className="truncate text-xs text-slate-500">{r.party_name} · {r.date}</div></div>
              <div className="text-right"><div className="font-semibold tabular-nums text-slate-900">{money(r.total)}</div><Badge value={r.status} icon /></div>
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
          {(data.pl || data.ar || data.cash !== null) && <div className="grid gap-5 lg:grid-cols-[1.2fr_2fr]">
            {data.pl && <div className="bg-hero-violet relative overflow-hidden rounded-3xl p-6 shadow-card ring-1 ring-fuchsia-200/50">
              <div className="pointer-events-none absolute -bottom-12 -right-10 h-40 w-60 rounded-full bg-violet-300/40 blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-2 text-[15px] font-semibold text-slate-700"><Icon name="reports" size={18} className="text-indigo-600" />Profit — {month.label.toLowerCase()}</div>
                <div className={`mt-2 text-[34px] font-extrabold tracking-tight tabular-nums ${Number(data.pl.net_profit) < 0 ? 'text-red-600' : 'text-slate-900'}`}>{money(data.pl.net_profit)}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full bg-white/80 px-3 py-1 font-medium text-emerald-700 ring-1 ring-emerald-200">Income {money(data.pl.total_income)}</span>
                  <span className="rounded-full bg-white/80 px-3 py-1 font-medium text-rose-700 ring-1 ring-rose-200">Expenses {money(data.pl.total_expenses)}</span>
                </div>
              </div>
            </div>}
            <div className="grid gap-4 sm:grid-cols-3">
              {data.ar && <KpiCard label="Customers owe you" icon="arrowDown" tone="green" value={money(data.ar.totals.ledger_balance)} foot={<Link to="/reports/aging" className="text-emerald-700 hover:underline">Receivables · aging</Link>} />}
              {data.ap && <KpiCard label="You owe suppliers" icon="arrowUp" tone="amber" value={money(data.ap.totals.ledger_balance)} foot={<Link to="/reports/vendor" className="text-amber-700 hover:underline">Payables</Link>} />}
              {data.cash !== null && <KpiCard label="Cash & bank" icon="bank" tone="violet" value={money(data.cash)} foot={<span className="text-indigo-700">Across cash and bank accounts</span>} />}
            </div>
          </div>}
          {quickActions.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-bold text-slate-900">Quick actions</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {quickActions.map(([to, title, text, icon]) => (
                  <Link key={to} to={to} className="group flex items-center gap-3 rounded-2xl bg-white/90 p-4 shadow-card ring-1 ring-slate-200/60 transition hover:-translate-y-0.5 hover:shadow-float hover:ring-indigo-200">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 transition group-hover:bg-btn-violet group-hover:text-white"><Icon name={icon} size={20} /></span>
                    <span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900">{title}</span><span className="block text-sm text-slate-500">{text}</span></span>
                    <Icon name="arrowRight" size={18} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                  </Link>
                ))}
              </div>
            </section>
          )}
          <div className="grid gap-5 lg:grid-cols-2">
            {data.sales && recent('Recent sales', 'invoice', data.sales, '/sales')}
            {data.purchases && recent('Recent purchases', 'cart', data.purchases, '/purchases')}
          </div>
        </div>
      )}
    </div>
  )
}
