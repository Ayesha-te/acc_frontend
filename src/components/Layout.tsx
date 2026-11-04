import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import { Button, Select } from './ui'

const nav: [string, [string, string][]][] = [
  ['', [['/', 'Dashboard']]],
  ['Sales', [['/sales', 'Sales invoices'], ['/sales/returns', 'Sales returns'], ['/receipts', 'Receipts (money in)']]],
  ['Purchases', [['/purchases', 'Purchase invoices'], ['/purchases/returns', 'Purchase returns'], ['/payments', 'Payments (money out)'], ['/expenses', 'Expenses']]],
  ['Vouchers', [['/vouchers/journal', 'Journal vouchers'], ['/vouchers/general', 'General vouchers'], ['/vouchers/contra', 'Contra (cash ⇄ bank)'], ['/vouchers/opening', 'Opening balances']]],
  ['Banking', [['/banking', 'Bank statements']]],
  ['Reports', [['/reports/profit-loss', 'Profit & Loss'], ['/reports/balance-sheet', 'Balance Sheet'], ['/reports/trial-balance', 'Trial Balance'],
    ['/reports/aging', 'Aging'], ['/reports/vendor', 'Vendor report'], ['/reports/sales-summary', 'Sales summary'], ['/reports/vat-summary', 'VAT summary']]],
  ['Stock & production', [['/inventory/items', 'Items'], ['/inventory/stock', 'Stock on hand'], ['/inventory/production', 'Production']]],
  ['Van loading', [['/dispatch/loads', 'Van loads'], ['/dispatch/vehicles', 'Vehicles']]],
  ['Setup', [['/parties', 'Customers & suppliers'], ['/accounts', 'Chart of accounts'], ['/settings/tax-rates', 'Tax rates'], ['/settings/branches', 'Branches'], ['/settings/period-lock', 'Period lock']]],
]

const quick: [string, string][] = [
  ['/sales/new', 'Sales invoice'], ['/purchases/new', 'Purchase invoice'], ['/receipts/new', 'Receive money'],
  ['/payments/new', 'Pay a supplier'], ['/expenses/new', 'Expense'], ['/vouchers/journal/new', 'Journal entry'], ['/inventory/production/new', 'Production run'], ['/dispatch/loads/new', 'Load a van'],
]

function QuickCreate() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div className="relative" ref={ref}>
      <Button aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>+ New</Button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          {quick.map(([to, label]) => (
            <Link key={to} to={to} role="menuitem" className="block px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700">{label}</Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function Layout() {
  const { orgs, org, selectOrg, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  const canWrite = !!org && org.role !== 'viewer'
  useEffect(() => setMenuOpen(false), [pathname]) // close the mobile menu after navigating

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile top bar; the full menu is collapsed below the md breakpoint. */}
      <header className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white md:hidden">
        <span className="font-semibold">Accounting</span>
        <div className="flex items-center gap-2">
          {canWrite && <QuickCreate />}
          <Button variant="ghost" className="!bg-transparent !text-white" aria-expanded={menuOpen} aria-controls="app-menu" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? 'Close' : 'Menu'}
          </Button>
        </div>
      </header>
      <aside id="app-menu"
        className={`${menuOpen ? 'block' : 'hidden'} w-full shrink-0 bg-slate-900 p-4 text-slate-300 md:sticky md:top-0 md:block md:h-screen md:w-64 md:overflow-y-auto`}>
        <div className="mb-5 hidden text-lg font-semibold text-white md:block">Accounting</div>
        <div className="rounded-lg bg-slate-800 p-2">
          <div className="px-1 pb-1 text-[10px] uppercase tracking-wider text-slate-400">Organization</div>
          <Select className="!border-slate-700 !bg-slate-800 !text-white" value={org?.id ?? ''} onChange={(e) => selectOrg(Number(e.target.value))} aria-label="Organization">
            {!org && <option value="">No organization</option>}
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
          <NavLink to="/organizations" className="mt-1 block px-1 text-xs text-indigo-300 hover:text-indigo-200">Manage organizations</NavLink>
        </div>
        {!org && (
          <p role="status" className="mt-3 rounded-md bg-amber-100 p-2 text-xs text-amber-900">
            Create an organization first. The other sections unlock once you have one.
          </p>
        )}
        <nav className="mt-4 space-y-4">
          {nav.filter(([group]) => group !== 'Banking' || org?.role === 'owner' || org?.role === 'admin').map(([group, items]) => (
            <div key={group || 'top'}>
              {group && <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group}</div>}
              {items.map(([to, label]) =>
                org ? (
                  <NavLink key={to} to={to} end
                    className={({ isActive }) => `block rounded-md px-2 py-1.5 text-sm ${isActive ? 'bg-indigo-600 font-medium text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                    {label}
                  </NavLink>
                ) : (
                  <span key={to} aria-disabled="true" title="Create an organization first"
                    className="block cursor-not-allowed rounded px-2 py-1.5 text-sm text-slate-600">{label}</span>
                ),
              )}
            </div>
          ))}
        </nav>
        <Button variant="ghost" className="mt-6 w-full !border-slate-700 !bg-transparent !text-slate-300 hover:!bg-slate-800" onClick={logout}>Sign out</Button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col bg-slate-50">
        <div className="no-print hidden items-center justify-between border-b border-slate-200 bg-white px-6 py-3 md:flex">
          <span className="text-sm text-slate-500">{org ? <>Working in <strong className="text-slate-800">{org.name}</strong></> : 'No organization selected'}</span>
          {canWrite && <QuickCreate />}
        </div>
        <main className="min-w-0 flex-1 p-4 md:p-6"><Outlet /></main>
      </div>
    </div>
  )
}
