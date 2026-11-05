import { Navigate, Route, Routes } from 'react-router-dom'
import { expenses } from './api/endpoints'
import { Layout } from './components/Layout'
import { Column, Register } from './components/Register'
import { Dashboard } from './features/dashboard/Dashboard'
import { useAuth } from './features/auth/AuthContext'
import { LoginPage } from './features/auth/LoginPage'
import { LoadForm, LoadsPage, VehiclesPage } from './features/dispatch/DispatchPages'
import { ItemsPage, ProductionForm, StockPage } from './features/inventory/InventoryPages'
import { AgingPage, BalanceSheetPage, ProfitLossPage, SalesSummaryPage, TrialBalancePage, VatReturnPage, VatSummaryPage, VendorReportPage } from './features/reports/ReportPages'
import { InvoiceForm } from './features/sales/DocumentForm'
import { AccountsPage, ApprovalSettingsPage, BranchesPage, OrganizationsPage, PartiesPage, PeriodLockPage, TaxRatesPage } from './features/setup/SetupPages'
import { CashForm } from './features/treasury/CashForm'
import { VoucherForm } from './features/vouchers/VoucherForm'
import { ExpenseForm } from './features/expenses/ExpenseForm'
import { BankRulesPage, BankStatementPage, BankStatementsPage } from './features/banking/BankingPages'
import { CreditsPage } from './features/treasury/CreditsPage'
import { OrderForm, OrdersPage } from './features/orders/OrderPages'
import { RecurringExpenseForm, RecurringExpensesPage, RecurringForm, RecurringPage } from './features/recurring/RecurringPages'
import { ValuationPage } from './features/inventory/ValuationPage'
import { money } from './lib/format'

const amt = (key: string, label: string): Column => ({ key, label, align: 'right', render: (r) => money(r[key]) })
const invoiceCols: Column[] = [
  { key: 'number', label: 'Number' }, { key: 'date', label: 'Date' }, { key: 'due_date', label: 'Due' }, { key: 'party_name', label: 'Party' },
  amt('subtotal', 'Subtotal'), amt('tax_total', 'Tax'), amt('total', 'Total'), { key: 'status', label: 'Status' },
]
const returnCols: Column[] = invoiceCols.filter((c) => c.key !== 'due_date')
const cashCols: Column[] = [
  { key: 'number', label: 'Number' }, { key: 'date', label: 'Date' }, { key: 'party_name', label: 'Party' },
  { key: 'method', label: 'Method' }, { key: 'reference', label: 'Reference' }, amt('amount', 'Amount'), amt('unapplied', 'Unapplied'), { key: 'status', label: 'Status' },
]
const expenseCols: Column[] = [
  { key: 'number', label: 'Number' }, { key: 'date', label: 'Date' }, { key: 'expense_account_name', label: 'Category' },
  { key: 'vendor_name', label: 'Supplier', render: (r) => r.vendor_name ?? '' }, { key: 'reference', label: 'Reference' },
  amt('tax_total', 'Tax'), amt('total', 'Total'), { key: 'status', label: 'Status' },
  { key: 'has_receipt', label: 'Receipt', render: (r) => r.has_receipt ? <button type="button" className="text-indigo-600 underline" onClick={() => expenses.downloadReceipt(r.id, r.number).catch((e) => alert(e.message))}>Download</button> : '' },
]
const voucherCols: Column[] = [{ key: 'number', label: 'Number' }, { key: 'date', label: 'Date' }, { key: 'narration', label: 'Narration' }, amt('total', 'Amount'), { key: 'status', label: 'Status' }]
const productionCols: Column[] = [
  { key: 'number', label: 'Number' }, { key: 'date', label: 'Date' }, { key: 'item_name', label: 'Product made' },
  { key: 'quantity', label: 'Quantity', align: 'right', render: (r) => Number(r.quantity).toLocaleString(undefined, { maximumFractionDigits: 4 }) },
  { key: 'location_name', label: 'Location' }, { key: 'status', label: 'Status' },
]

export default function App() {
  const { authed, ready, org } = useAuth()
  if (!authed) return <LoginPage />
  if (!ready) return <div className="p-8 text-slate-500">Loading…</div>
  const w = !!org && org.role !== 'viewer'
  // Keyed by organization so no page keeps data from another organization after a switch.
  const k = org?.id
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="organizations" element={<OrganizationsPage />} />
        {!org ? <Route path="*" element={<Navigate to="/organizations" replace />} /> : (
          <>
            <Route index element={<Dashboard key={k} />} />
            <Route path="sales" element={<Register key={k} title="Sales invoices" subtitle="Bills you have sent to customers" path="sales/invoices" columns={invoiceCols} extraQuery={{ kind: 'invoice' }} createTo="/sales/new" createLabel="New invoice" canWrite={w} />} />
            <Route path="sales/new" element={<InvoiceForm path="sales/invoices" partyKind="customer" kind="invoice" backTo="/sales" title="New sales invoice" />} />
            <Route path="sales/returns" element={<Register key={k} title="Sales returns" subtitle="Goods or amounts customers sent back" path="sales/invoices" columns={returnCols} extraQuery={{ kind: 'return' }} createTo="/sales/returns/new" createLabel="New return" canWrite={w} />} />
            <Route path="sales/returns/new" element={<InvoiceForm path="sales/invoices" partyKind="customer" kind="return" backTo="/sales/returns" title="New sales return" />} />
            <Route path="purchases" element={<Register key={k} title="Purchase invoices" subtitle="Bills received from suppliers" path="purchases/invoices" columns={invoiceCols} extraQuery={{ kind: 'invoice' }} createTo="/purchases/new" createLabel="New invoice" canWrite={w} />} />
            <Route path="purchases/new" element={<InvoiceForm path="purchases/invoices" partyKind="supplier" kind="invoice" backTo="/purchases" title="New purchase invoice" />} />
            <Route path="purchases/returns" element={<Register key={k} title="Purchase returns" subtitle="Goods or amounts you sent back to suppliers" path="purchases/invoices" columns={returnCols} extraQuery={{ kind: 'return' }} createTo="/purchases/returns/new" createLabel="New return" canWrite={w} />} />
            <Route path="purchases/returns/new" element={<InvoiceForm path="purchases/invoices" partyKind="supplier" kind="return" backTo="/purchases/returns" title="New purchase return" />} />
            <Route path="receipts" element={<Register key={k} title="Receipts" subtitle="Money received from customers" path="receipts" columns={cashCols} createTo="/receipts/new" createLabel="Receive money" canWrite={w} />} />
            <Route path="receipts/new" element={<CashForm path="receipts" partyKind="customer" title="Receive money from a customer" />} />
            <Route path="payments" element={<Register key={k} title="Payments" subtitle="Money paid to suppliers" path="payments" columns={cashCols} createTo="/payments/new" createLabel="Pay a supplier" canWrite={w} />} />
            <Route path="payments/new" element={<CashForm path="payments" partyKind="supplier" title="Pay a supplier" />} />
            <Route path="sales/quotes" element={<OrdersPage key={k} kind="quote" />} />
            <Route path="sales/quotes/new" element={<OrderForm key={k} kind="quote" />} />
            <Route path="sales/quotes/:id/edit" element={<OrderForm key={k} kind="quote" />} />
            <Route path="sales/orders" element={<OrdersPage key={k} kind="order" />} />
            <Route path="sales/orders/new" element={<OrderForm key={k} kind="order" />} />
            <Route path="sales/orders/:id/edit" element={<OrderForm key={k} kind="order" />} />
            <Route path="purchases/orders" element={<OrdersPage key={k} kind="purchase" />} />
            <Route path="purchases/orders/new" element={<OrderForm key={k} kind="purchase" />} />
            <Route path="purchases/orders/:id/edit" element={<OrderForm key={k} kind="purchase" />} />
            <Route path="recurring" element={<RecurringPage key={k} />} />
            <Route path="recurring/new" element={<RecurringForm key={k} />} />
            <Route path="recurring-expenses" element={<RecurringExpensesPage key={k} />} />
            <Route path="recurring-expenses/new" element={<RecurringExpenseForm key={k} />} />
            <Route path="credits/sales" element={<CreditsPage key={k} side="sales" />} />
            <Route path="credits/purchases" element={<CreditsPage key={k} side="purchases" />} />
            <Route path="banking" element={<BankStatementsPage key={k} />} />
            <Route path="banking/rules" element={<BankRulesPage key={k} />} />
            <Route path="banking/:id" element={<BankStatementPage key={k} />} />
            <Route path="expenses" element={<Register key={k} title="Expenses" subtitle="Money spent without a supplier bill" path="expenses" columns={expenseCols} createTo="/expenses/new" createLabel="New expense" canWrite={w} />} />
            <Route path="expenses/new" element={<ExpenseForm key={k} />} />
            {(['journal', 'general', 'contra', 'opening'] as const).map((t) => [
              <Route key={t} path={`vouchers/${t}`} element={<Register key={`${k}${t}`} title={`${t[0].toUpperCase()}${t.slice(1)} vouchers`}
                subtitle={{ journal: 'Standard accounting adjustments and journal entries', general: 'General transactions with no dedicated screen', contra: 'Transfers between cash and bank accounts', opening: 'Balances brought forward when you started using the system' }[t]}
                path="vouchers" columns={voucherCols} extraQuery={{ type: t }} createTo={`/vouchers/${t}/new`} createLabel="New voucher" canWrite={w} />} />,
              <Route key={`${t}-new`} path={`vouchers/${t}/new`} element={<VoucherForm type={t} />} />,
            ])}
            <Route path="reports/profit-loss" element={<ProfitLossPage key={k} />} />
            <Route path="reports/balance-sheet" element={<BalanceSheetPage key={k} />} />
            <Route path="reports/trial-balance" element={<TrialBalancePage key={k} />} />
            <Route path="reports/aging" element={<AgingPage key={k} />} />
            <Route path="reports/vendor" element={<VendorReportPage key={k} />} />
            <Route path="reports/sales-summary" element={<SalesSummaryPage key={k} />} />
            <Route path="reports/vat-summary" element={<VatSummaryPage key={k} />} />
            <Route path="reports/vat-return" element={<VatReturnPage key={k} />} />
            <Route path="inventory/valuation" element={<ValuationPage key={k} />} />
            <Route path="inventory/items" element={<ItemsPage key={k} />} />
            <Route path="inventory/stock" element={<StockPage key={k} />} />
            <Route path="inventory/production" element={<Register key={k} title="Production" subtitle="Raw materials consumed to make finished goods" path="inventory/production" columns={productionCols} createTo="/inventory/production/new" createLabel="New production run" canWrite={w} />} />
            <Route path="inventory/production/new" element={<ProductionForm key={k} />} />
            <Route path="dispatch/vehicles" element={<VehiclesPage key={k} />} />
            <Route path="dispatch/loads" element={<LoadsPage key={k} />} />
            <Route path="dispatch/loads/new" element={<LoadForm key={k} />} />
            <Route path="parties" element={<PartiesPage key={k} />} />
            <Route path="accounts" element={<AccountsPage key={k} />} />
            <Route path="settings/tax-rates" element={<TaxRatesPage key={k} />} />
            <Route path="settings/branches" element={<BranchesPage key={k} />} />
            <Route path="settings/approvals" element={<ApprovalSettingsPage key={k} />} />
            <Route path="settings/period-lock" element={<PeriodLockPage key={k} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Route>
    </Routes>
  )
}
