import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuthStore } from "@/stores/auth";
import { AppShell } from "@/components/layout/app-shell";
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
import { ExpiryPage } from "@/pages/expiry";
import { ReportsPage } from "@/pages/reports";
import { ReportsIndexPage } from "@/pages/reports-index";
import { InventoryReportsPage } from "@/pages/inventory-reports";
import { ZReportPage } from "@/pages/zreport";
import { DoctorsPage } from "@/pages/doctors";
import { RefillsPage } from "@/pages/refills";
import { PettyCashPage } from "@/pages/petty-cash";
import { PromotionsPage } from "@/pages/promotions";
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
          <Route path="/settings/users" element={<RequireRole permission="users.view"><UsersPage /></RequireRole>} />
          <Route path="/pharmacy" element={<RequireRole permission="pharmacy.dispense"><PharmacyPage /></RequireRole>} />
          <Route path="/pharmacy/expiry" element={<RequireRole permission="inventory.view"><ExpiryPage /></RequireRole>} />
          <Route path="/reports" element={<RequireRole permission={["reports.view", "reports.zreport"]}><ReportsIndexPage /></RequireRole>} />
          <Route path="/reports/sales" element={<RequireRole permission="reports.view"><ReportsPage /></RequireRole>} />
          <Route path="/reports/inventory" element={<RequireRole permission="reports.view"><InventoryReportsPage /></RequireRole>} />
          <Route path="/reports/zreport" element={<RequireRole permission="reports.zreport"><ZReportPage /></RequireRole>} />
          <Route path="/pharmacy/doctors" element={<RequireRole permission="pharmacy.doctors.manage"><DoctorsPage /></RequireRole>} />
          <Route path="/pharmacy/refills" element={<RequireRole permission="pharmacy.refill"><RefillsPage /></RequireRole>} />
          <Route path="/petty-cash" element={<RequireRole permission="petty_cash.use"><PettyCashPage /></RequireRole>} />
          <Route path="/promotions" element={<RequireRole permission="promotions.manage"><PromotionsPage /></RequireRole>} />
          <Route path="/expenses" element={<RequireRole permission="expenses.view"><ExpensesPage /></RequireRole>} />
          <Route path="/pnl" element={<RequireRole permission="reports.pnl"><PnLPage /></RequireRole>} />
          <Route path="/cash-register" element={<RequireRole permission="cash_register.use"><CashRegisterPage /></RequireRole>} />
          <Route path="/settings" element={<RequireRole permission="settings.business"><SettingsPage /></RequireRole>} />
          <Route path="/settings/backup" element={<RequireRole permission="settings.backup"><BackupPage /></RequireRole>} />
          <Route path="/audit" element={<RequireRole permission="audit.view"><AuditLogPage /></RequireRole>} />
          <Route path="/settings/network" element={<RequireRole permission="settings.network"><NetworkSettingsPage /></RequireRole>} />
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
          <Route path="/settings/modules" element={<RequireRole permission="settings.modules"><ModulesPage /></RequireRole>} />
          <Route path="/settings/payments" element={<RequireRole permission="settings.business"><PaymentSettingsPage /></RequireRole>} />
          <Route path="/settings/etims" element={<RequireRole permission="etims.view"><EtimsSettingsPage /></RequireRole>} />
          <Route path="/settings/insurance" element={<RequireRole permission="claims.view"><InsuranceSettingsPage /></RequireRole>} />
          <Route path="/settings/license" element={<RequireRole permission="license.view"><LicensePage /></RequireRole>} />
          <Route path="/claims" element={<RequireRole permission="claims.view"><ClaimsPage /></RequireRole>} />
          <Route path="/etims" element={<RequireRole permission="etims.view"><EtimsQueuePage /></RequireRole>} />
          <Route path="/vat-report" element={<RequireRole permission="reports.view"><VatReportPage /></RequireRole>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster position="bottom-right" />
    </BrowserRouter>
  );
}

export default App;
