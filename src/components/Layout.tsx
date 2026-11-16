import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { documents } from '../api/endpoints'
import { useAuth, useCan } from '../features/auth/AuthContext'
import { money, todayDubai } from '../lib/format'
import { Icon, IconName } from './icons'
import { Button, Modal, useDismiss } from './ui'

type NavItem = [to: string, label: string, icon: IconName]
type NavGroup = { group: string; icon: IconName; items: NavItem[] }

// Same routes as before; only grouped with icons. Order and permissions are unchanged.
const nav: NavGroup[] = [
  { group: '', icon: 'home', items: [['/', 'Dashboard', 'home']] },
  { group: 'Sales', icon: 'invoice', items: [['/sales/quotes', 'Quotes', 'quote'], ['/sales/orders', 'Sales orders', 'orders'], ['/sales', 'Sales invoices', 'invoice'], ['/sales/returns', 'Sales returns', 'returns'], ['/receipts', 'Receipts (money in)', 'receipt'], ['/credits/sales', 'Customer credits', 'credit'], ['/recurring', 'Recurring invoices', 'recurring']] },
  { group: 'Purchases', icon: 'cart', items: [['/purchases/orders', 'Purchase orders', 'cart'], ['/purchases', 'Purchase invoices', 'invoice'], ['/purchases/returns', 'Purchase returns', 'returns'], ['/payments', 'Payments (money out)', 'payment'], ['/credits/purchases', 'Supplier credits', 'credit'], ['/expenses', 'Expenses', 'expense'], ['/recurring-expenses', 'Recurring expenses', 'recurring']] },
  { group: 'Vouchers', icon: 'voucher', items: [['/vouchers/journal', 'Journal vouchers', 'ledger'], ['/vouchers/general', 'General vouchers', 'voucher'], ['/vouchers/contra', 'Contra (cash ⇄ bank)', 'bank'], ['/vouchers/opening', 'Opening balances', 'file']] },
  { group: 'Banking', icon: 'bank', items: [['/banking', 'Bank statements', 'bank'], ['/banking/rules', 'Bank rules', 'filter']] },
  { group: 'Reports', icon: 'reports', items: [['/reports/profit-loss', 'Profit & Loss', 'reports'], ['/reports/balance-sheet', 'Balance Sheet', 'ledger'], ['/reports/trial-balance', 'Trial Balance', 'ledger'],
    ['/reports/aging', 'Aging', 'clock'], ['/reports/vendor', 'Vendor report', 'users'], ['/reports/sales-summary', 'Sales summary', 'barChart'], ['/reports/vat-summary', 'VAT summary', 'pieChart'], ['/reports/vat-return', 'VAT return worksheet', 'file']] },
  { group: 'Stock & production', icon: 'box', items: [['/inventory/items', 'Items', 'box'], ['/inventory/stock', 'Stock on hand', 'box'], ['/inventory/valuation', 'Valuation', 'barChart'], ['/inventory/production', 'Production', 'settings']] },
  { group: 'Van loading', icon: 'truck', items: [['/dispatch/loads', 'Van loads', 'truck'], ['/dispatch/vehicles', 'Vehicles', 'truck']] },
  { group: 'Setup', icon: 'settings', items: [['/parties', 'Customers & suppliers', 'users'], ['/accounts', 'Chart of accounts', 'ledger'], ['/settings/tax-rates', 'Tax rates', 'pieChart'], ['/settings/branches', 'Branches', 'building'], ['/settings/period-lock', 'Period lock', 'clock'], ['/settings/approvals', 'Approvals', 'checkCircle'], ['/settings/users', 'Users & permissions', 'users']] },
]

/** Permission module each page belongs to (the server enforces the same; this only hides what would be refused). */
const PAGE_MODULE: [string, string][] = [
  ['/sales/quotes', 'quotes'], ['/sales/orders', 'sales_orders'], ['/sales/returns', 'sales_returns'], ['/sales', 'sales_invoices'],
  ['/receipts', 'receipts'], ['/credits/sales', 'customer_credits'], ['/recurring-expenses', 'expenses'], ['/recurring', 'sales_invoices'],
  ['/purchases/orders', 'purchase_orders'], ['/purchases/returns', 'purchase_returns'], ['/purchases', 'purchase_invoices'],
  ['/payments', 'payments'], ['/credits/purchases', 'supplier_credits'], ['/expenses', 'expenses'], ['/vouchers', 'ledger'],
  ['/banking', 'banking'], ['/reports', 'reports'], ['/inventory', 'inventory'], ['/dispatch', 'inventory'], ['/parties', 'contacts'],
  ['/accounts', 'chart_of_accounts'], ['/settings/users', 'users'], ['/settings', 'settings'], ['/', 'dashboard'],
]
export const moduleOf = (path: string) => (PAGE_MODULE.find(([p]) => (p === '/' ? path === '/' : path === p || path.startsWith(p + '/'))) ?? [, 'dashboard'])[1] as string

const quick: [string, string][] = [
  ['/sales/new', 'Sales invoice'], ['/purchases/new', 'Purchase invoice'], ['/receipts/new', 'Receive money'],
  ['/payments/new', 'Pay a supplier'], ['/expenses/new', 'Expense'], ['/vouchers/journal/new', 'Journal entry'], ['/inventory/production/new', 'Production run'], ['/dispatch/loads/new', 'Load a van'],
]

/** The nav item (and its group) that best matches the current path: exact match first, then longest prefix. */
function findNav(pathname: string, groups: NavGroup[]) {
  let best: { group: NavGroup; item: NavItem } | null = null
  for (const g of groups) for (const it of g.items) {
    const hit = pathname === it[0] || (it[0] !== '/' && pathname.startsWith(it[0] + '/'))
    if (hit && (!best || it[0].length > best.item[0].length)) best = { group: g, item: it }
  }
  return best
}

const store = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* storage unavailable: preference just isn't remembered */ } },
}

function QuickCreate() {
  const can = useCan()
  const items = quick.filter(([to]) => can(moduleOf(to), 'create'))
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss(open, close)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])
  return (
    <div className="relative" ref={ref}>
      <Button aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="plus" size={16} strokeWidth={2.4} /><span className="hidden sm:inline">New</span></Button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-56 animate-fade-in rounded-2xl border border-slate-200 bg-white p-1.5 shadow-float">
          {items.map(([to, label]) => (
            <Link key={to} to={to} role="menuitem" className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700">{label}</Link>
          ))}
        </div>
      )}
    </div>
  )
}

/** Ctrl/⌘+K command palette: jump to any page or quick-create action. */
function CommandPalette({ groups, canWrite, onClose }: { groups: NavGroup[]; canWrite: boolean; onClose(): void }) {
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const navigate = useNavigate()
  const can = useCan()
  const all = useMemo(() => [
    ...groups.flatMap((g) => g.items.map(([to, label, icon]) => ({ to, label, hint: g.group || 'Home', icon }))),
    ...(canWrite ? quick.filter(([to]) => can(moduleOf(to), 'create')).map(([to, label]) => ({ to, label: `New ${label.toLowerCase()}`, hint: 'Create', icon: 'plus' as IconName })) : []),
  ], [groups, canWrite, can])
  const hits = all.filter((x) => `${x.label} ${x.hint}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 10)
  useEffect(() => setI(0), [q])
  const go = (to: string) => { onClose(); navigate(to) }
  return (
    <Modal title="Search" onClose={onClose}>
      <div className="relative">
        <Icon name="search" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages and actions…" aria-label="Search pages and actions"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(x + 1, hits.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(x - 1, 0)) }
            if (e.key === 'Enter' && hits[i]) go(hits[i].to)
          }}
          className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15" />
      </div>
      <ul className="mt-3 max-h-80 overflow-y-auto" role="listbox">
        {hits.map((h, n) => (
          <li key={h.to + h.label} role="option" aria-selected={n === i}>
            <button type="button" onMouseEnter={() => setI(n)} onClick={() => go(h.to)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${n === i ? 'bg-indigo-50 text-indigo-800' : 'text-slate-700'}`}>
              <Icon name={h.icon} size={17} className="text-indigo-500" /><span className="flex-1">{h.label}</span><span className="text-xs text-slate-400">{h.hint}</span>
            </button>
          </li>
        ))}
        {!hits.length && <li className="px-3 py-6 text-center text-sm text-slate-500">No pages match “{q}”.</li>}
      </ul>
    </Modal>
  )
}

/** Bell with real overdue sales invoices (read-only `payment_status=overdue` list). */
function Notifications({ orgId }: { orgId: number }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<{ count: number; rows: any[] } | null>(null)
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss(open, close)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    let live = true
    const load = () => documents('sales/invoices').list({ kind: 'invoice', payment_status: 'overdue', page_size: 5, ordering: 'date' })
      .then((r) => live && setData({ count: r.count, rows: r.results })).catch(() => live && setData(null))
    load()
    const t = window.setInterval(load, 5 * 60_000)
    return () => { live = false; window.clearInterval(t) }
  }, [orgId])
  const n = data?.count ?? 0
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} aria-label={`Notifications${n ? `: ${n} overdue invoices` : ''}`} aria-expanded={open}
        className="relative grid h-10 w-10 place-items-center rounded-xl text-slate-600 transition hover:bg-white hover:text-indigo-700 hover:shadow-card">
        <Icon name="bell" size={21} />
        {n > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 animate-fade-in rounded-2xl border border-slate-200 bg-white p-2 shadow-float">
          <div className="px-2 pb-2 pt-1 text-sm font-bold text-slate-900">Notifications</div>
          {!n ? <p className="px-2 py-4 text-sm text-slate-500">You're all caught up. No overdue invoices.</p> : (
            <>
              <p className="px-2 pb-2 text-xs text-slate-500">{n} sales invoice{n === 1 ? ' is' : 's are'} overdue</p>
              {data!.rows.map((r) => (
                <Link key={r.id} to="/sales?status=overdue" className="flex items-center justify-between gap-2 rounded-xl px-2 py-2 text-sm hover:bg-rose-50">
                  <span className="min-w-0"><span className="block font-semibold text-slate-800">{r.number}</span><span className="block truncate text-xs text-slate-500">{r.party_name} · due {r.due_date ?? r.date}</span></span>
                  <span className="tabular-nums text-slate-700">{money(r.total)}</span>
                </Link>
              ))}
              <Link to="/sales?status=overdue" className="mt-1 block rounded-xl px-2 py-2 text-center text-sm font-semibold text-indigo-700 hover:bg-indigo-50">View overdue invoices</Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function UserMenu({ onShortcuts }: { onShortcuts(): void }) {
  const { org, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss(open, close)
  const initials = (org?.name ?? '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu"
        className="flex items-center gap-1 rounded-full p-0.5 pr-1.5 transition hover:bg-white hover:shadow-card">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-btn-violet text-sm font-bold text-white shadow-sm">{initials}</span>
        <Icon name="chevronDown" size={16} className="text-slate-500" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-60 animate-fade-in rounded-2xl border border-slate-200 bg-white p-1.5 shadow-float">
          <div className="px-3 py-2">
            <div className="truncate text-sm font-bold text-slate-900">{org?.name ?? 'No organization'}</div>
            {org && <div className="text-xs capitalize text-slate-500">Role: {org.role} · {org.base_currency}</div>}
          </div>
          <div className="my-1 h-px bg-slate-100" />
          <Link to="/organizations" role="menuitem" onClick={close} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"><Icon name="building" size={16} />Manage organizations</Link>
          <button type="button" role="menuitem" onClick={() => { close(); onShortcuts() }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"><Icon name="keyboard" size={16} />Keyboard shortcuts</button>
          <button type="button" role="menuitem" onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"><Icon name="logout" size={16} />Sign out</button>
        </div>
      )}
    </div>
  )
}

function Sidebar({ groups, collapsed, onToggle, mobile, onCloseMobile }: { groups: NavGroup[]; collapsed: boolean; onToggle(): void; mobile: boolean; onCloseMobile(): void }) {
  const { orgs, org, selectOrg } = useAuth()
  const { pathname } = useLocation()
  const active = findNav(pathname, groups)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(store.get('nav.groups') ?? '') } catch { return { Sales: true, Purchases: true } }
  })
  const isOpen = (g: string) => !g || openGroups[g] || active?.group.group === g
  const toggleGroup = (g: string) => setOpenGroups((s) => { const n = { ...s, [g]: !isOpen(g) }; store.set('nav.groups', JSON.stringify(n)); return n })
  const rail = collapsed && !mobile

  const link = ([to, label, icon]: NavItem) => org ? (
    <NavLink key={to} to={to} end title={rail ? label : undefined}
      className={({ isActive }) => `group flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] transition ${rail ? 'justify-center' : ''} ${isActive
        ? 'bg-gradient-to-r from-violet-500 to-indigo-600 font-semibold text-white shadow-[0_8px_20px_-8px_rgb(139_92_246/0.9)] ring-1 ring-white/20'
        : 'text-violet-100/80 hover:bg-white/8 hover:text-white'}`}>
      <Icon name={icon} size={19} className="shrink-0" />{!rail && <span className="truncate">{label}</span>}
    </NavLink>
  ) : (
    <span key={to} aria-disabled="true" title="Create an organization first"
      className={`flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2 text-[14px] text-violet-100/30 ${rail ? 'justify-center' : ''}`}>
      <Icon name={icon} size={19} className="shrink-0" />{!rail && <span className="truncate">{label}</span>}
    </span>
  )

  return (
    <aside id="app-menu" aria-label="Main navigation"
      className={`app-sidebar flex h-full flex-col text-white ${rail ? 'w-[84px]' : 'w-[270px]'} transition-[width] duration-200`}>
      <div className={`flex items-center gap-2.5 pb-4 pt-5 ${rail ? 'justify-center px-2' : 'px-4'}`}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-400 via-violet-500 to-indigo-600 shadow-lg ring-1 ring-white/20">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3 3 21h4.2l1.6-3.6h6.4L16.8 21H21zm-1.8 11.2L12 10l1.8 4.2z" fill="#fff" /></svg>
        </span>
        {!rail && <div className="min-w-0 flex-1"><div className="whitespace-nowrap text-[18px] font-bold leading-tight tracking-tight">Accounting Pro</div><div className="truncate text-[11px] text-violet-200/70">Business Accounting Suite</div></div>}
        {mobile
          ? <button type="button" onClick={onCloseMobile} aria-label="Close menu" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20"><Icon name="x" size={18} /></button>
          : !rail && <button type="button" onClick={onToggle} aria-label="Collapse sidebar" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-violet-100 hover:bg-white/20"><Icon name="chevronsLeft" size={18} /></button>}
      </div>
      {rail && <button type="button" onClick={onToggle} aria-label="Expand sidebar" className="mx-auto mb-3 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-violet-100 hover:bg-white/20"><Icon name="chevronsRight" size={18} /></button>}

      {!rail && (
        <div className="px-4">
          <div className="mb-1.5 px-1 text-xs font-medium text-violet-200/70">Organization</div>
          <div className="relative">
            <Icon name="building" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-violet-100" />
            <select value={org?.id ?? ''} onChange={(e) => selectOrg(Number(e.target.value))} aria-label="Organization"
              className="w-full appearance-none rounded-xl border border-white/15 bg-white/8 py-2.5 pl-10 pr-9 text-sm font-medium text-white focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-400/40 [&>option]:text-slate-900">
              {!org && <option value="">No organization</option>}
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <Icon name="chevronDown" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-violet-100" />
          </div>
          <NavLink to="/organizations" className="mt-1.5 block px-1 text-xs text-violet-300 hover:text-white">Manage organizations</NavLink>
          {!org && (
            <p role="status" className="mt-3 rounded-xl bg-amber-100 p-2 text-xs text-amber-900">
              Create an organization first. The other sections unlock once you have one.
            </p>
          )}
        </div>
      )}

      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3 pb-6">
        {groups.map((g) => (
          <div key={g.group || 'top'} className={g.group ? 'pt-2' : ''}>
            {g.group && !rail && (
              <button type="button" onClick={() => toggleGroup(g.group)} aria-expanded={!!isOpen(g.group)}
                className="mb-1 flex w-full items-center justify-between rounded-lg px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-violet-200/60 hover:text-violet-100">
                {g.group}<Icon name="chevronDown" size={15} className={`transition-transform ${isOpen(g.group) ? '' : '-rotate-90'}`} />
              </button>
            )}
            {g.group && rail && <div className="mx-auto my-2 h-px w-8 bg-white/10" />}
            {(rail || isOpen(g.group)) && <div className="space-y-0.5">{g.items.map(link)}</div>}
          </div>
        ))}
      </nav>
    </aside>
  )
}

export function Layout() {
  const { org } = useAuth()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => store.get('nav.collapsed') === '1')
  const [palette, setPalette] = useState(false)
  const [shortcuts, setShortcuts] = useState(false)
  const can = useCan()
  const canWrite = !!org && quick.some(([to]) => can(moduleOf(to), 'create'))
  // Pages the member may view. Banking also needs an unrestricted role (bank data spans every branch).
  const groups = useMemo(() => nav
    .filter(({ group }) => group !== 'Banking' || org?.role === 'owner' || org?.role === 'admin')
    .map((g) => ({ ...g, items: g.items.filter(([to]) => to === '/' || can(moduleOf(to), 'view')) }))
    .filter((g) => g.items.length), [org?.role, org?.permissions]) // eslint-disable-line react-hooks/exhaustive-deps
  const crumb = findNav(pathname, groups)
  const mainRef = useRef<HTMLElement>(null)
  useEffect(() => { setMenuOpen(false); mainRef.current?.scrollTo?.({ top: 0 }) }, [pathname]) // close the mobile menu after navigating
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(true) } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  const toggle = () => setCollapsed((c) => { store.set('nav.collapsed', c ? '0' : '1'); return !c })
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <div className="no-print sticky top-0 hidden h-screen shrink-0 lg:block"><Sidebar groups={groups} collapsed={collapsed} onToggle={toggle} mobile={false} onCloseMobile={() => {}} /></div>
      {/* Mobile / tablet drawer */}
      {menuOpen && (
        <div className="no-print fixed inset-0 z-40 lg:hidden" onMouseDown={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-indigo-950/50 backdrop-blur-[2px]" />
          <div className="relative h-full w-[270px] max-w-[85vw] animate-fade-in" onMouseDown={(e) => e.stopPropagation()}>
            <Sidebar groups={groups} collapsed={false} onToggle={toggle} mobile onCloseMobile={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex items-center gap-2 border-b border-white/60 bg-[#f7f5fe]/80 px-4 py-3 backdrop-blur-md sm:gap-3 md:px-8">
          <button type="button" className="grid h-10 w-10 place-items-center rounded-xl text-slate-700 hover:bg-white lg:hidden" aria-label="Open menu"
            aria-expanded={menuOpen} aria-controls="app-menu" onClick={() => setMenuOpen(true)}><Icon name="menu" size={22} /></button>
          <nav aria-label="Breadcrumb" className="min-w-0 flex-1 text-sm">
            {org ? (
              <ol className="flex min-w-0 items-center gap-1.5 text-slate-500">
                {crumb?.group.group && <><li className="flex items-center gap-1 font-semibold text-indigo-700"><Link to={crumb.group.items[0][0]} className="flex items-center gap-0.5 hover:underline"><Icon name="chevronLeft" size={16} strokeWidth={2.4} />{crumb.group.group}</Link></li><li aria-hidden className="text-slate-300">/</li></>}
                <li className="truncate font-medium text-slate-700">{crumb?.item[1] ?? (pathname === '/organizations' ? 'Organizations' : 'Dashboard')}</li>
                <li className="ml-2 hidden truncate text-xs text-slate-400 xl:block">· {org.name}</li>
              </ol>
            ) : <span className="text-slate-500">No organization selected</span>}
          </nav>
          <button type="button" onClick={() => setPalette(true)} aria-label="Search pages and actions"
            className="hidden h-11 w-72 items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-3.5 text-sm text-slate-400 shadow-sm transition hover:border-indigo-200 md:flex xl:w-80">
            <Icon name="search" size={19} className="text-slate-500" /><span className="flex-1 text-left">Search anything…</span>
            <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-xs font-semibold text-slate-600">{isMac ? '⌘' : 'Ctrl'} K</kbd>
          </button>
          <button type="button" onClick={() => setPalette(true)} aria-label="Search" className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 hover:bg-white md:hidden"><Icon name="search" size={20} /></button>
          {org && can('sales_invoices', 'view') && <Notifications orgId={org.id} />}
          <button type="button" onClick={() => setShortcuts(true)} aria-label="Help and keyboard shortcuts"
            className="hidden h-10 w-10 place-items-center rounded-xl text-slate-600 transition hover:bg-white hover:text-indigo-700 hover:shadow-card sm:grid"><Icon name="help" size={21} /></button>
          {canWrite && <QuickCreate />}
          <UserMenu onShortcuts={() => setShortcuts(true)} />
        </header>
        <main ref={mainRef} className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-6"><Outlet /></main>
      </div>

      {palette && <CommandPalette groups={org ? groups : []} canWrite={canWrite} onClose={() => setPalette(false)} />}
      {shortcuts && (
        <Modal title="Help & keyboard shortcuts" onClose={() => setShortcuts(false)}>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex justify-between"><span>Search pages and actions</span><kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 text-xs font-semibold">{isMac ? '⌘' : 'Ctrl'} K</kbd></li>
            <li className="flex justify-between"><span>Move through search results</span><kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 text-xs font-semibold">↑ ↓ Enter</kbd></li>
            <li className="flex justify-between"><span>Close a dialog or panel</span><kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 text-xs font-semibold">Esc</kbd></li>
          </ul>
          <p className="mt-4 text-xs text-slate-500">Dates follow Dubai time ({todayDubai()}). Overdue means a posted invoice still has a balance after its due date.</p>
        </Modal>
      )}
    </div>
  )
}
