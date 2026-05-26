import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuthStore } from "@/stores/auth";
import { AppShell } from "@/components/layout/app-shell";
import { LicenseGuard } from "@/components/license-guard";
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
          <Route path="/pos" element={<POSPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/inventory/categories" element={<CategoriesPage />} />
          <Route path="/inventory/stock" element={<StockPage />} />
          <Route path="/inventory/import" element={<ImportProductsPage />} />
          <Route path="/sales" element={<SalesHistoryPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/settings/users" element={<UsersPage />} />
          <Route path="/pharmacy" element={<PharmacyPage />} />
          <Route path="/pharmacy/expiry" element={<ExpiryPage />} />
          <Route path="/reports" element={<ReportsIndexPage />} />
          <Route path="/reports/sales" element={<ReportsPage />} />
          <Route path="/reports/inventory" element={<InventoryReportsPage />} />
          <Route path="/reports/zreport" element={<ZReportPage />} />
          <Route path="/pharmacy/doctors" element={<DoctorsPage />} />
          <Route path="/pharmacy/refills" element={<RefillsPage />} />
          <Route path="/petty-cash" element={<PettyCashPage />} />
          <Route path="/promotions" element={<PromotionsPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/pnl" element={<PnLPage />} />
          <Route path="/cash-register" element={<CashRegisterPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/backup" element={<BackupPage />} />
          <Route path="/audit" element={<AuditLogPage />} />
          <Route path="/settings/network" element={<NetworkSettingsPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="/purchase-orders/new" element={<NewPurchaseOrderPage />} />
          <Route path="/purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/returns" element={<ReturnsPage />} />
          <Route path="/returns/new" element={<NewReturnPage />} />
          <Route path="/stock-take" element={<StockTakesPage />} />
          <Route path="/stock-take/:id" element={<StockTakeDetailPage />} />
          <Route path="/patients/:id" element={<PatientProfilePage />} />
          <Route path="/settings/modules" element={<ModulesPage />} />
          <Route path="/settings/payments" element={<PaymentSettingsPage />} />
          <Route path="/settings/etims" element={<EtimsSettingsPage />} />
          <Route path="/settings/insurance" element={<InsuranceSettingsPage />} />
          <Route path="/settings/license" element={<LicensePage />} />
          <Route path="/claims" element={<ClaimsPage />} />
          <Route path="/etims" element={<EtimsQueuePage />} />
          <Route path="/vat-report" element={<VatReportPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster position="bottom-right" />
    </BrowserRouter>
  );
}

export default App;
