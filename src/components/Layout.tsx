import { NavLink, Outlet } from 'react-router-dom'
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
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="w-full shrink-0 border-b border-slate-200 bg-white p-4 md:w-60 md:border-b-0 md:border-r">
        <div className="mb-4 font-bold text-indigo-700">Accounting</div>
        <Select value={org?.id ?? ''} onChange={(e) => selectOrg(Number(e.target.value))} aria-label="Organization">
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </Select>
        <NavLink to="/organizations" className="mt-1 block text-xs text-indigo-600">Manage organizations</NavLink>
        <nav className="mt-4 space-y-4">
          {nav.map(([group, items]) => (
            <div key={group}>
              <div className="mb-1 text-xs font-semibold uppercase text-slate-400">{group}</div>
              {items.map(([to, label]) => (
                <NavLink key={to} to={to} end
                  className={({ isActive }) => `block rounded px-2 py-1 text-sm ${isActive ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-slate-700 hover:bg-slate-100'}`}>
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <Button variant="ghost" className="mt-6 w-full" onClick={logout}>Sign out</Button>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-6"><Outlet /></main>
    </div>
  )
}
