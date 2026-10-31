import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Column, Register } from './components/Register'
import { useAuth } from './features/auth/AuthContext'
import { LoginPage } from './features/auth/LoginPage'
import { InvoiceForm } from './features/sales/DocumentForm'
import { AccountsPage, OrganizationsPage, PartiesPage } from './features/setup/SetupPages'
import { CashForm } from './features/treasury/CashForm'
import { VoucherForm } from './features/vouchers/VoucherForm'
import { money } from './lib/format'

const amt = (key: string) => ({ key, label: key.replace('_', ' '), align: 'right' as const, render: (r: any) => money(r[key]) })
const invoiceCols: Column[] = [
  { key: 'number', label: 'Number' }, { key: 'date', label: 'Date' }, { key: 'party_name', label: 'Party' },
  amt('subtotal'), amt('tax_total'), amt('total'), { key: 'status', label: 'Status' },
]
const cashCols: Column[] = [
  { key: 'number', label: 'Number' }, { key: 'date', label: 'Date' }, { key: 'party_name', label: 'Party' },
  { key: 'method', label: 'Method' }, { key: 'reference', label: 'Reference' }, amt('amount'), { key: 'status', label: 'Status' },
]
const voucherCols: Column[] = [{ key: 'number', label: 'Number' }, { key: 'date', label: 'Date' }, { key: 'narration', label: 'Narration' }, amt('total'), { key: 'status', label: 'Status' }]

export default function App() {
  const { authed, ready, org } = useAuth()
  if (!authed) return <LoginPage />
  if (!ready) return <div className="p-8 text-slate-500">Loading…</div>
  const w = !!org && org.role !== 'viewer'
  // `key={org.id}` remounts pages on organization switch so no data from one org lingers in another's view.
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/sales" replace />} />
        <Route path="organizations" element={<OrganizationsPage />} />
        {!org ? <Route path="*" element={<Navigate to="/organizations" replace />} /> : (
          <>
            <Route path="sales" element={<Register key={org.id} title="Sales register" path="sales/invoices" columns={invoiceCols} extraQuery={{ kind: 'invoice' }} createTo="/sales/new" canWrite={w} />} />
            <Route path="sales/new" element={<InvoiceForm path="sales/invoices" partyKind="customer" kind="invoice" backTo="/sales" title="New sales invoice" />} />
            <Route path="sales/returns" element={<Register key={org.id} title="Sales returns" path="sales/invoices" columns={invoiceCols} extraQuery={{ kind: 'return' }} createTo="/sales/returns/new" canWrite={w} />} />
            <Route path="sales/returns/new" element={<InvoiceForm path="sales/invoices" partyKind="customer" kind="return" backTo="/sales/returns" title="New sales return" />} />
            <Route path="purchases" element={<Register key={org.id} title="Purchase register" path="purchases/invoices" columns={invoiceCols} extraQuery={{ kind: 'invoice' }} createTo="/purchases/new" canWrite={w} />} />
            <Route path="purchases/new" element={<InvoiceForm path="purchases/invoices" partyKind="supplier" kind="invoice" backTo="/purchases" title="New purchase invoice" />} />
            <Route path="purchases/returns" element={<Register key={org.id} title="Purchase returns" path="purchases/invoices" columns={invoiceCols} extraQuery={{ kind: 'return' }} createTo="/purchases/returns/new" canWrite={w} />} />
            <Route path="purchases/returns/new" element={<InvoiceForm path="purchases/invoices" partyKind="supplier" kind="return" backTo="/purchases/returns" title="New purchase return" />} />
            <Route path="receipts" element={<Register key={org.id} title="Receipt register" path="receipts" columns={cashCols} createTo="/receipts/new" canWrite={w} />} />
            <Route path="receipts/new" element={<CashForm path="receipts" partyKind="customer" title="New receipt" />} />
            <Route path="payments" element={<Register key={org.id} title="Payment register" path="payments" columns={cashCols} createTo="/payments/new" canWrite={w} />} />
            <Route path="payments/new" element={<CashForm path="payments" partyKind="supplier" title="New payment" />} />
            {(['general', 'journal', 'contra'] as const).map((t) => [
              <Route key={t} path={`vouchers/${t}`} element={<Register key={`${org.id}${t}`} title={`${t[0].toUpperCase()}${t.slice(1)} voucher register`} path="vouchers" columns={voucherCols} extraQuery={{ type: t }} createTo={`/vouchers/${t}/new`} canWrite={w} />} />,
              <Route key={`${t}-new`} path={`vouchers/${t}/new`} element={<VoucherForm type={t} />} />,
            ])}
            <Route path="parties" element={<PartiesPage />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="*" element={<Navigate to="/sales" replace />} />
          </>
        )}
      </Route>
    </Routes>
  )
}
