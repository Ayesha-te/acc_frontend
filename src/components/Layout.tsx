import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import { Button, Select } from './ui'

const nav: [string, [string, string][]][] = [
  ['Sales', [['/sales', 'Sales register'], ['/sales/returns', 'Sales returns'], ['/receipts', 'Receipts']]],
  ['Purchases', [['/purchases', 'Purchase register'], ['/purchases/returns', 'Purchase returns'], ['/payments', 'Payments']]],
  ['Vouchers', [['/vouchers/general', 'General'], ['/vouchers/journal', 'Journal'], ['/vouchers/contra', 'Contra']]],
  ['Setup', [['/parties', 'Customers & suppliers'], ['/accounts', 'Chart of accounts']]],
]

export function Layout() {
  const { orgs, org, selectOrg, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setMenuOpen(false), [pathname]) // close the mobile menu after navigating

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile top bar; the full menu is collapsed below the md breakpoint. */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <span className="font-bold text-indigo-700">Accounting</span>
        <Button variant="ghost" aria-expanded={menuOpen} aria-controls="app-menu" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? 'Close' : 'Menu'}
        </Button>
      </header>
      <aside id="app-menu"
        className={`${menuOpen ? 'block' : 'hidden'} w-full shrink-0 border-b border-slate-200 bg-white p-4 md:block md:w-60 md:border-b-0 md:border-r`}>
        <div className="mb-4 hidden font-bold text-indigo-700 md:block">Accounting</div>
        <Select value={org?.id ?? ''} onChange={(e) => selectOrg(Number(e.target.value))} aria-label="Organization">
          {!org && <option value="">No organization</option>}
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </Select>
        <NavLink to="/organizations" className="mt-1 block text-xs text-indigo-600">Manage organizations</NavLink>
        {!org && (
          <p role="status" className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
            Create an organization first. The other sections unlock once you have one.
          </p>
        )}
        <nav className="mt-4 space-y-4">
          {nav.map(([group, items]) => (
            <div key={group}>
              <div className="mb-1 text-xs font-semibold uppercase text-slate-400">{group}</div>
              {items.map(([to, label]) =>
                org ? (
                  <NavLink key={to} to={to} end
                    className={({ isActive }) => `block rounded px-2 py-1 text-sm ${isActive ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-slate-700 hover:bg-slate-100'}`}>
                    {label}
                  </NavLink>
                ) : (
                  <span key={to} aria-disabled="true" title="Create an organization first"
                    className="block cursor-not-allowed rounded px-2 py-1 text-sm text-slate-400">{label}</span>
                ),
              )}
            </div>
          ))}
        </nav>
        <Button variant="ghost" className="mt-6 w-full" onClick={logout}>Sign out</Button>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-6"><Outlet /></main>
    </div>
  )
}
