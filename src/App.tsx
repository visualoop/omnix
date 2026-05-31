import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog";
import { useAuthStore } from "@/stores/auth";
import { AppShell } from "@/components/layout/app-shell";
import { SettingsLayout } from "@/components/layout/settings-layout";
import { LicenseGuard } from "@/components/license-guard";
import { RequireRole } from "@/components/require-role";
import { LoginPage } from "@/pages/login";
import { SetupWizard } from "@/pages/setup";
import { DashboardPage } from "@/pages/dashboard";
import { InventoryPage } from "@/pages/inventory";
import { CategoriesPage } from "@/pages/categories";
import { StockPage } from "@/pages/stock";
import { POSPage } from "@/pages/pos";
import { PharmacyPage } from "@/pages/pharmacy";
import { ControlledRegisterPage } from "@/pages/controlled-register";
import { ColdChainPage } from "@/pages/cold-chain";
import { AmrReportPage } from "@/pages/amr-report";
import { ExpiryPage } from "@/pages/expiry";
import { ReportsPage } from "@/pages/reports";
import { ReportsIndexPage } from "@/pages/reports-index";
import { InventoryReportsPage } from "@/pages/inventory-reports";
import { ZReportPage } from "@/pages/zreport";
import { TipsReportPage } from "@/pages/tips-report";
import { DoctorsPage } from "@/pages/doctors";
import { RefillsPage } from "@/pages/refills";
import { PettyCashPage } from "@/pages/petty-cash";
import { PromotionsPage } from "@/pages/promotions";
import { BranchesPage } from "@/pages/branches";
import { StockTransfersPage } from "@/pages/stock-transfers";
import { NewStockTransferPage } from "@/pages/stock-transfer-new";
import { StockTransferDetailPage } from "@/pages/stock-transfer-detail";
import { EmployeesPage } from "@/pages/employees";
import { AttendancePage } from "@/pages/attendance";
import { LeavePage } from "@/pages/leave";
import { PayrollPage } from "@/pages/payroll";
import { InvoicingPage } from "@/pages/invoicing";
import { NewDocumentPage } from "@/pages/invoice-new";
import { DocumentDetailPage } from "@/pages/invoice-detail";
import { RecurringInvoicesPage } from "@/pages/recurring-invoices";
import { CustomerDisplayPage } from "@/pages/customer-display";
import { BankingPage } from "@/pages/banking";
import { BankAccountDetailPage } from "@/pages/banking-detail";
import { BrandsPage } from "@/pages/retail-brands";
import { ShrinkagePage } from "@/pages/retail-shrinkage";
import { LaybysPage } from "@/pages/retail-laybys";
import { SpecialOrdersPage } from "@/pages/retail-special-orders";
import { RetailDashboardPage } from "@/pages/retail-dashboard";
import { QuickAddProductsPage } from "@/pages/quick-add";
import { ExpensesPage } from "@/pages/expenses";
import { PnLPage } from "@/pages/pnl";
import { CashRegisterPage } from "@/pages/cash-register";
import { PaymentSettingsPage } from "@/pages/payment-settings";
import { EtimsSettingsPage } from "@/pages/etims-settings";
import { InsuranceSettingsPage } from "@/pages/insurance-settings";
import { ClaimsPage } from "@/pages/claims";
import { EtimsQueuePage } from "@/pages/etims-queue";
import { VatReportPage } from "@/pages/vat-report";
import { LicensePage } from "@/pages/license";
import { ImportProductsPage } from "@/pages/import-products";
import { SalesHistoryPage } from "@/pages/sales-history";
import { UsersPage } from "@/pages/users";
import { SettingsPage } from "@/pages/settings";
import { BackupPage } from "@/pages/backup";
import { AuditLogPage } from "@/pages/audit";
import { NetworkSettingsPage } from "@/pages/network-settings";
import { SuppliersPage } from "@/pages/suppliers";
import { PurchaseOrdersPage, NewPurchaseOrderPage, PurchaseOrderDetailPage } from "@/pages/purchase-orders";
import { CustomersPage } from "@/pages/customers";
import { ReturnsPage, NewReturnPage } from "@/pages/returns";
import { StockTakesPage, StockTakeDetailPage } from "@/pages/stock-take";
import { PatientProfilePage } from "@/pages/patient-profile";
import { ModulesPage } from "@/pages/modules";

function App() {
  return (
    <LicenseGuard>
      <AppContent />
    </LicenseGuard>
  );
}

function AppContent() {
  const { user, isSetupComplete, setupChecked, refreshSetupState } = useAuthStore();

  useEffect(() => {
    // Initialize DB mode (detects standalone/client) before checking setup
    import("@/lib/db").then(({ initDb }) => {
      initDb().then(() => refreshSetupState());
    });
  }, [refreshSetupState]);

  // Wait until we've checked the DB at least once
  if (!setupChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // First run: setup wizard
  if (!isSetupComplete) {
    return (
      <>
        <SetupWizard />
        <Toaster position="bottom-right" />
        <ConfirmDialogHost />
      </>
    );
  }

  // Not logged in: login page
  if (!user) {
    return (
      <>
        <LoginPage />
        <Toaster position="bottom-right" />
      </>
    );
  }

  // Logged in: app shell
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="/pos" element={<RequireRole permission="pos.use"><POSPage /></RequireRole>} />
          <Route path="/inventory" element={<RequireRole permission="inventory.view"><InventoryPage /></RequireRole>} />
          <Route path="/inventory/categories" element={<RequireRole permission="inventory.edit"><CategoriesPage /></RequireRole>} />
          <Route path="/inventory/stock" element={<RequireRole permission="inventory.view"><StockPage /></RequireRole>} />
          <Route path="/inventory/import" element={<RequireRole permission="inventory.edit"><ImportProductsPage /></RequireRole>} />
          <Route path="/sales" element={<RequireRole permission="sales.view"><SalesHistoryPage /></RequireRole>} />
          <Route path="/users" element={<RequireRole permission="users.view"><UsersPage /></RequireRole>} />
          <Route path="/pharmacy" element={<RequireRole permission="pharmacy.dispense"><PharmacyPage /></RequireRole>} />
          <Route path="/pharmacy/expiry" element={<RequireRole permission="inventory.view"><ExpiryPage /></RequireRole>} />
          <Route path="/reports" element={<RequireRole permission={["reports.view", "reports.zreport"]}><ReportsIndexPage /></RequireRole>} />
          <Route path="/reports/sales" element={<RequireRole permission="reports.view"><ReportsPage /></RequireRole>} />
          <Route path="/reports/inventory" element={<RequireRole permission="reports.view"><InventoryReportsPage /></RequireRole>} />
          <Route path="/reports/zreport" element={<RequireRole permission="reports.zreport"><ZReportPage /></RequireRole>} />
          <Route path="/reports/tips" element={<RequireRole permission="reports.view"><TipsReportPage /></RequireRole>} />
          <Route path="/pharmacy/doctors" element={<RequireRole permission="pharmacy.doctors.manage"><DoctorsPage /></RequireRole>} />
          <Route path="/pharmacy/refills" element={<RequireRole permission="pharmacy.refill"><RefillsPage /></RequireRole>} />
          <Route path="/pharmacy/controlled-register" element={<RequireRole permission="pharmacy.dispense"><ControlledRegisterPage /></RequireRole>} />
          <Route path="/pharmacy/cold-chain" element={<RequireRole permission="pharmacy.dispense"><ColdChainPage /></RequireRole>} />
          <Route path="/pharmacy/amr" element={<RequireRole permission="reports.view"><AmrReportPage /></RequireRole>} />
          <Route path="/petty-cash" element={<RequireRole permission="petty_cash.use"><PettyCashPage /></RequireRole>} />
          <Route path="/promotions" element={<RequireRole permission="promotions.manage"><PromotionsPage /></RequireRole>} />
          <Route path="/stock-transfers" element={<RequireRole permission="inventory.view"><StockTransfersPage /></RequireRole>} />
          <Route path="/stock-transfers/new" element={<RequireRole permission="inventory.view"><NewStockTransferPage /></RequireRole>} />
          <Route path="/stock-transfers/:id" element={<RequireRole permission="inventory.view"><StockTransferDetailPage /></RequireRole>} />
          <Route path="/hr/employees" element={<RequireRole permission="hr.employees.view"><EmployeesPage /></RequireRole>} />
          <Route path="/hr/attendance" element={<RequireRole permission="hr.attendance.view"><AttendancePage /></RequireRole>} />
          <Route path="/hr/leave" element={<RequireRole permission="hr.leave.request"><LeavePage /></RequireRole>} />
          <Route path="/hr/payroll" element={<RequireRole permission="hr.payroll.view"><PayrollPage /></RequireRole>} />
          <Route path="/invoicing" element={<RequireRole permission="invoicing.view"><InvoicingPage /></RequireRole>} />
          <Route path="/invoicing/invoice/new" element={<RequireRole permission="invoicing.create"><NewDocumentPage type="invoice" /></RequireRole>} />
          <Route path="/invoicing/quotation/new" element={<RequireRole permission="invoicing.create"><NewDocumentPage type="quotation" /></RequireRole>} />
          <Route path="/invoicing/invoice/:id" element={<RequireRole permission="invoicing.view"><DocumentDetailPage type="invoice" /></RequireRole>} />
          <Route path="/invoicing/quotation/:id" element={<RequireRole permission="invoicing.view"><DocumentDetailPage type="quotation" /></RequireRole>} />
          <Route path="/invoicing/recurring" element={<RequireRole permission="invoicing.create"><RecurringInvoicesPage /></RequireRole>} />
          <Route path="/banking" element={<RequireRole permission="banking.view"><BankingPage /></RequireRole>} />
          <Route path="/banking/:id" element={<RequireRole permission="banking.view"><BankAccountDetailPage /></RequireRole>} />
          <Route path="/retail/brands" element={<RequireRole permission="retail.brands.manage"><BrandsPage /></RequireRole>} />
          <Route path="/retail/dashboard" element={<RequireRole permission="reports.view"><RetailDashboardPage /></RequireRole>} />
          <Route path="/inventory/quick-add" element={<RequireRole permission="inventory.edit"><QuickAddProductsPage /></RequireRole>} />
          <Route path="/retail/shrinkage" element={<RequireRole permission="retail.shrinkage.record"><ShrinkagePage /></RequireRole>} />
          <Route path="/retail/laybys" element={<RequireRole permission="retail.laybys.use"><LaybysPage /></RequireRole>} />
          <Route path="/retail/special-orders" element={<RequireRole permission="retail.special_orders.use"><SpecialOrdersPage /></RequireRole>} />
          <Route path="/expenses" element={<RequireRole permission="expenses.view"><ExpensesPage /></RequireRole>} />
          <Route path="/pnl" element={<RequireRole permission="reports.pnl"><PnLPage /></RequireRole>} />
          <Route path="/cash-register" element={<RequireRole permission="cash_register.use"><CashRegisterPage /></RequireRole>} />
          <Route path="/settings" element={<SettingsLayout />}>
            <Route index element={<RequireRole permission="settings.business"><SettingsPage /></RequireRole>} />
            <Route path="branches" element={<RequireRole permission="settings.business"><BranchesPage /></RequireRole>} />
            <Route path="users" element={<RequireRole permission="users.view"><UsersPage /></RequireRole>} />
            <Route path="payments" element={<RequireRole permission="settings.business"><PaymentSettingsPage /></RequireRole>} />
            <Route path="etims" element={<RequireRole permission="etims.view"><EtimsSettingsPage /></RequireRole>} />
            <Route path="insurance" element={<RequireRole permission="claims.view"><InsuranceSettingsPage /></RequireRole>} />
            <Route path="network" element={<RequireRole permission="settings.network"><NetworkSettingsPage /></RequireRole>} />
            <Route path="modules" element={<RequireRole permission="settings.modules"><ModulesPage /></RequireRole>} />
            <Route path="backup" element={<RequireRole permission="settings.backup"><BackupPage /></RequireRole>} />
            <Route path="audit" element={<RequireRole permission="audit.view"><AuditLogPage /></RequireRole>} />
            <Route path="license" element={<RequireRole permission="license.view"><LicensePage /></RequireRole>} />
          </Route>
          <Route path="/audit" element={<RequireRole permission="audit.view"><AuditLogPage /></RequireRole>} />
          <Route path="/suppliers" element={<RequireRole permission="suppliers.view"><SuppliersPage /></RequireRole>} />
          <Route path="/purchase-orders" element={<RequireRole permission="purchase_orders.view"><PurchaseOrdersPage /></RequireRole>} />
          <Route path="/purchase-orders/new" element={<RequireRole permission="purchase_orders.create"><NewPurchaseOrderPage /></RequireRole>} />
          <Route path="/purchase-orders/:id" element={<RequireRole permission="purchase_orders.view"><PurchaseOrderDetailPage /></RequireRole>} />
          <Route path="/customers" element={<RequireRole permission="customers.view"><CustomersPage /></RequireRole>} />
          <Route path="/returns" element={<RequireRole permission="sales.refund"><ReturnsPage /></RequireRole>} />
          <Route path="/returns/new" element={<RequireRole permission="sales.refund"><NewReturnPage /></RequireRole>} />
          <Route path="/stock-take" element={<RequireRole permission="stock_take.use"><StockTakesPage /></RequireRole>} />
          <Route path="/stock-take/:id" element={<RequireRole permission="stock_take.use"><StockTakeDetailPage /></RequireRole>} />
          <Route path="/patients/:id" element={<RequireRole permission="customers.view"><PatientProfilePage /></RequireRole>} />
          <Route path="/claims" element={<RequireRole permission="claims.view"><ClaimsPage /></RequireRole>} />
          <Route path="/etims" element={<RequireRole permission="etims.view"><EtimsQueuePage /></RequireRole>} />
          <Route path="/vat-report" element={<RequireRole permission="reports.view"><VatReportPage /></RequireRole>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
        {/* Customer-facing display — opens in separate window, no shell/sidebar */}
        <Route path="/customer-display" element={<CustomerDisplayPage />} />
      </Routes>
      <Toaster position="bottom-right" />
      <ConfirmDialogHost />
    </BrowserRouter>
  );
}

export default App;
