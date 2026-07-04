import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog";
import { TouchTextKeyboardProvider } from "@/components/ui/touch-text-keyboard-provider";
import { useAuthStore } from "@/stores/auth";
import { useF11Fullscreen } from "@/hooks/use-f11-fullscreen";
import { WindowTitlebar, TITLEBAR_HEIGHT_PX } from "@/components/layout/window-titlebar";
import { useAutoUpdate } from "@/hooks/use-auto-update";
import { useLanAutostart } from "@/hooks/use-lan-autostart";
import { useAlertScanner } from "@/hooks/use-alert-scanner";
import { useOfflineQueueDrainer } from "@/hooks/use-offline-queue-drainer";
import { useBackgroundJobs } from "@/hooks/use-background-jobs";
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
import { POSSalePage } from "@/pages/pos-sale";
import { POSOverviewPage } from "@/pages/pos-overview";
import { PharmacyPage } from "@/pages/pharmacy";
import { PrescriptionDetailPage } from "@/pages/prescription-detail";
import { ControlledRegisterPage } from "@/pages/controlled-register";
import { ColdChainPage } from "@/pages/cold-chain";
import { AmrReportPage } from "@/pages/amr-report";
import { ExpiryPage } from "@/pages/expiry";
import { WastageReportPage } from "@/pages/wastage-report";
import { ReportsPage } from "@/pages/reports";
import { AiWorkspacePage } from "@/pages/ai-workspace";
import { AiChatV2Page } from "@/pages/ai-chat-v2";
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
import { CustomerDisplayQueuePage } from "@/pages/customer-display-queue";
import { DailyOperationsPage } from "@/pages/daily-operations";
import { CustomerDisplaySettingsPage } from "@/pages/settings-customer-display";
import { AiSettingsPage } from "@/pages/settings-ai";
import { ReceiptSettingsPage } from "@/pages/settings-receipt";
import { PrintSettingsPage } from "@/pages/settings-print";
import { ScannerSettingsPage } from "@/pages/settings-scanner";
import { SettingsUpdatesPage } from "@/pages/settings-updates";
import { SettingsAutostartPage } from "@/pages/settings-autostart";
import { Settings2FAPage } from "@/pages/settings-2fa";
import { NotificationsPage } from "@/pages/notifications";
import { TrialBalancePage } from "@/pages/trial-balance";
import { BalanceSheetPage } from "@/pages/balance-sheet";
import { ChartOfAccountsPage } from "@/pages/chart-of-accounts";
import { ReservationsPage } from "@/pages/reservations";
import { KitchenDisplayPage } from "@/pages/kitchen-display";
import { AreaDetailPage } from "@/pages/area-detail";
import { TableDetailPage } from "@/pages/table-detail";
import { RoomTypeDetailPage } from "@/pages/room-type-detail";
import { RoomDetailPage } from "@/pages/room-detail";
import { MenuItemDetailPage } from "@/pages/menu-item-detail";
import { BrandDetailPage } from "@/pages/brand-detail";
import { QuotationDetailPage } from "@/pages/quotation-detail";
import { ContractorDetailPage } from "@/pages/contractor-detail";
import { PeripheralsPage } from "@/pages/peripherals";
import { CashFlowStatementPage } from "@/pages/cash-flow-statement";
import { PeriodClosePage } from "@/pages/period-close";
import { ApprovalsPage } from "@/pages/approvals";
import { DebitNotesPage } from "@/pages/debit-notes";
import { BankReconciliationPage } from "@/pages/bank-reconciliation";
import { RecallsPage } from "@/pages/recalls";
import { ReorderSuggestionsPage } from "@/pages/reorder-suggestions";
import { SalesTargetsPage } from "@/pages/sales-targets";
import { FixedAssetsPage } from "@/pages/fixed-assets";
import { CurrenciesPage } from "@/pages/currencies";
import { FollowUpsPage } from "@/pages/follow-ups";
import { RoomStatusPage } from "@/pages/room-status";
import { AnalyticsPage } from "@/pages/analytics";
import { LanServicePage } from "@/pages/lan-service";
import { StockAgingPage, DeadStockPage } from "@/pages/stock-aging";
import { DataQualityPage, CostCentresPage, DeliveriesPage, AnomaliesPage } from "@/pages/platform-pages";
import { GlobalSearchDialog } from "@/components/global-search";
import { TaxSettingsPage } from "@/pages/settings-taxes";
import { CategoriesSettingsPage } from "@/pages/settings-categories";
import { UnitsSettingsPage } from "@/pages/settings-units";
// Hub pages — flat sidebar with tabs inside each domain
import { PeopleHubPage } from "@/pages/hub-people";
import { SalesHubPage } from "@/pages/hub-sales";
import { InventoryHubPage } from "@/pages/hub-inventory";
import { BankingHubPage } from "@/pages/hub-banking";
import { AnalyticsHubPage } from "@/pages/hub-analytics";
import { PharmacyHubPage, RetailHubPage, HardwareHubPage, HospitalityHubPage } from "@/pages/hub-modules";
import { PriceListSettingsPage } from "@/pages/settings-price-lists";
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
// LicensePage import removed in v0.25.0 — /settings/license now redirects
// to /settings/licenses at the route level, so the legacy single-licence
// view is unreachable. If we ever need to resurrect it, re-import from
// "@/pages/license".
import { SettingsLicensesPage } from "@/pages/settings-licenses";
import { SettingsPharmacyLicensesPage } from "@/pages/settings-pharmacy-licenses";
import { SettingsDisplayPage } from "@/pages/settings-display";
import { ImportProductsPage } from "@/pages/import-products";
import { DamagesPage } from "@/pages/damages";
import { SalesHistoryPage } from "@/pages/sales-history";
import { UsersPage } from "@/pages/users";
import { SettingsPage } from "@/pages/settings";
import { SettingsRolesPage } from "@/pages/settings-roles";
import { SettingsGroupsPage } from "@/pages/settings-groups";
import { SettingsAccessAuditPage } from "@/pages/settings-access-audit";
import { BackupPage } from "@/pages/backup";
import { CloudBackupPage } from "@/pages/cloud-backup";
import { AuditLogPage } from "@/pages/audit";
import { NetworkSettingsPage } from "@/pages/network-settings";
import { SuppliersPage } from "@/pages/suppliers";
import { PurchaseOrdersPage, NewPurchaseOrderPage, PurchaseOrderDetailPage } from "@/pages/purchase-orders";
import { CustomersPage } from "@/pages/customers";
import { CustomerDetailPage } from "@/pages/customer-detail";
import { SupplierDetailPage } from "@/pages/supplier-detail";
import { ProductDetailPage } from "@/pages/product-detail";
import { SaleDetailPage } from "@/pages/sale-detail";
import { EmployeeDetailPage } from "@/pages/employee-detail";
import { BranchDetailPage } from "@/pages/branch-detail";
import { ReturnsPage, NewReturnPage } from "@/pages/returns";
import { StockTakesPage, StockTakeDetailPage } from "@/pages/stock-take";
import { PatientProfilePage } from "@/pages/patient-profile";
import { ModulesPage } from "@/pages/modules";
import { AppearanceSettingsPage } from "@/pages/settings-appearance";
import {
  HardwareQuotationsPage, HardwareDeliveryNotesPage,
  HardwareAccountsPage, HardwareCommissionsPage, HardwareReportsPage,
} from "@/pages/hardware";
import { HardwareSettingsPage } from "@/pages/settings-hardware";
import {
  HospitalityDashboardPage, HospitalityTablesPage, HospitalityMenuPage,
  HospitalityOrdersPage,
  HospitalityRoomsPage, HospitalityBookingsPage, HospitalityFoliosPage,
  HospitalityRecipesPage, HospitalityReportsPage,
} from "@/pages/hospitality";
import { HospitalitySettingsPage } from "@/pages/settings-hospitality";

function App() {
  // Customer-facing display runs in a separate window with NO license/auth/setup
  // guards — it must never show the activation or setup wizard to a customer.
  if (window.location.pathname.startsWith("/customer-display")) {
    return <CustomerDisplayShell />;
  }
  // Kitchen Display Screen also runs in a separate window on a wall-mounted
  // kitchen tablet — no chrome, no sidebar, just the live ticket board.
  if (window.location.pathname.startsWith("/kitchen-display")) {
    return <KitchenDisplayShell />;
  }
  return (
    <LicenseGuard>
      <AppContent />
    </LicenseGuard>
  );
}

/** Customer-display window — separate Tauri window with its own root.
 *  F11 toggles fullscreen on this window too, matching the operator's
 *  expectation of a standard Windows app. */
function CustomerDisplayShell() {
  useF11Fullscreen();
  return (
    <BrowserRouter>
      <WindowTitlebar title="Customer Display" />
      <div style={{ marginTop: TITLEBAR_HEIGHT_PX }}>
        <Routes>
          <Route path="/customer-display/queue" element={<CustomerDisplayQueuePage />} />
          <Route path="*" element={<CustomerDisplayPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

/** Kitchen Display window — chrome-less, fullscreen-friendly. */
function KitchenDisplayShell() {
  useF11Fullscreen();
  return (
    <BrowserRouter>
      <WindowTitlebar title="Kitchen Display" />
      <div style={{ marginTop: TITLEBAR_HEIGHT_PX }}>
        <Routes>
          <Route path="*" element={<KitchenDisplayPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

function AppContent() {
  useF11Fullscreen();
  useAutoUpdate();
  useLanAutostart();
  useAlertScanner();
  useOfflineQueueDrainer();
  useBackgroundJobs();

  // Install crash telemetry handlers once on boot.
  useEffect(() => {
    import("@/services/telemetry").then(({ installGlobalHandlers }) => installGlobalHandlers());
    // Load persisted i18n locale.
    import("@/lib/i18n").then(({ loadPersistedLocale }) => loadPersistedLocale());
  }, []);
  const { user, isSetupComplete, setupChecked, refreshSetupState } = useAuthStore();

  useEffect(() => {
    // Bust the WebView2 cache after every auto-update so customers
    // immediately see the new UI, not the stale one held in memory.
    import("@/lib/version-bust").then(({ bustOnVersionChange }) => bustOnVersionChange());

    // Initialize DB mode (detects standalone/client) before checking setup
    import("@/lib/db").then(({ initDb }) => {
      initDb().then(() => {
        refreshSetupState();
        // Load active country (defaults to 'KE' for unconfigured installs)
        import("@/stores/country").then(({ useCountry }) => useCountry.getState().load().catch(() => {}));
        // Load UI density preference (touch vs comfortable) — drives
        // bigger targets on tablet/touchscreen POS terminals.
        import("@/stores/density").then(({ useDensityStore }) => useDensityStore.getState().load().catch(() => {}));
        // Seed the RBAC permission catalog + system-role grants (idempotent).
        import("@/services/rbac").then(({ seedRbac }) => seedRbac().catch(() => {}));
        // Run DB maintenance (sales rollup, churn prune, optimize) when
        // due — deferred well past boot so it never competes with the
        // first paint or the first sale. Throttled to ~once a day.
        setTimeout(() => {
          import("@/services/db-maintenance")
            .then(({ runMaintenanceIfDue }) => runMaintenanceIfDue().catch(() => {}))
            .catch(() => {});
        }, 30000);
        // Restore effective-permission cache for a persisted session.
        if (useAuthStore.getState().user) {
          useAuthStore.getState().loadPermissions();
        }
      });
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
      <BrowserRouter>
        <WindowTitlebar />
        <div style={{ marginTop: TITLEBAR_HEIGHT_PX }}>
          <SetupWizard />
        </div>
        <Toaster position="bottom-right" />
        <ConfirmDialogHost />
      </BrowserRouter>
    );
  }

  // Not logged in: login page
  if (!user) {
    return (
      <BrowserRouter>
        <WindowTitlebar />
        <div style={{ marginTop: TITLEBAR_HEIGHT_PX }}>
          <LoginPage />
        </div>
        <Toaster position="bottom-right" />
      </BrowserRouter>
    );
  }

  // Logged in: app shell
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="/ai" element={<AiWorkspacePage />} />
          <Route path="/ai/v2" element={<AiChatV2Page />} />
          <Route path="/pos" element={<RequireRole permission="pos.use"><POSOverviewPage /></RequireRole>} />
          <Route path="/pos/sale" element={<RequireRole permission="pos.use"><POSSalePage /></RequireRole>} />
          <Route path="/inventory" element={<RequireRole permission="inventory.view"><InventoryHubPage /></RequireRole>} />
          <Route path="/inventory/products" element={<RequireRole permission="inventory.view"><InventoryPage /></RequireRole>} />
          <Route path="/inventory/products/:id" element={<RequireRole permission="inventory.view"><ProductDetailPage /></RequireRole>} />
          <Route path="/inventory/categories" element={<RequireRole permission="inventory.edit"><CategoriesPage /></RequireRole>} />
          <Route path="/inventory/stock" element={<RequireRole permission="inventory.view"><StockPage /></RequireRole>} />
          <Route path="/inventory/import" element={<RequireRole permission="inventory.edit"><ImportProductsPage /></RequireRole>} />
          <Route path="/inventory/damages" element={<RequireRole permission="inventory.edit"><DamagesPage /></RequireRole>} />
          <Route path="/sales" element={<RequireRole permission="sales.view"><SalesHubPage /></RequireRole>} />
          <Route path="/sales/history" element={<RequireRole permission="sales.view"><SalesHistoryPage /></RequireRole>} />
          <Route path="/sales/:id" element={<RequireRole permission="sales.view"><SaleDetailPage /></RequireRole>} />
          <Route path="/users" element={<RequireRole permission="users.view"><UsersPage /></RequireRole>} />
          <Route path="/pharmacy" element={<RequireRole permission="pharmacy.dispense"><PharmacyHubPage /></RequireRole>} />
          <Route path="/pharmacy/dispense" element={<RequireRole permission="pharmacy.dispense"><PharmacyPage /></RequireRole>} />
          <Route path="/pharmacy/prescriptions/:id" element={<RequireRole permission="pharmacy.dispense"><PrescriptionDetailPage /></RequireRole>} />
          <Route path="/pharmacy/expiry" element={<RequireRole permission="inventory.view"><ExpiryPage /></RequireRole>} />
          <Route path="/reports" element={<RequireRole permission={["reports.view", "reports.zreport"]}><ReportsIndexPage /></RequireRole>} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/accounting/chart-of-accounts" element={<RequireRole permission="reports.pnl"><ChartOfAccountsPage /></RequireRole>} />
          <Route path="/accounting/trial-balance" element={<RequireRole permission="reports.pnl"><TrialBalancePage /></RequireRole>} />
          <Route path="/accounting/balance-sheet" element={<RequireRole permission="reports.pnl"><BalanceSheetPage /></RequireRole>} />
          <Route path="/accounting/cash-flow" element={<RequireRole permission="reports.pnl"><CashFlowStatementPage /></RequireRole>} />
          <Route path="/accounting/period-close" element={<RequireRole permission="reports.pnl"><PeriodClosePage /></RequireRole>} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/procurement/debit-notes" element={<RequireRole permission="purchase_orders.view"><DebitNotesPage /></RequireRole>} />
          <Route path="/banking/:id/reconcile" element={<RequireRole permission="banking.reconcile"><BankReconciliationPage /></RequireRole>} />
          <Route path="/pharmacy/recalls" element={<RequireRole permission="pharmacy.dispense"><RecallsPage /></RequireRole>} />
          <Route path="/inventory/reorder" element={<RequireRole permission="inventory.view"><ReorderSuggestionsPage /></RequireRole>} />
          <Route path="/people/sales-targets" element={<RequireRole permission="reports.view"><SalesTargetsPage /></RequireRole>} />
          <Route path="/accounting/fixed-assets" element={<RequireRole permission="reports.pnl"><FixedAssetsPage /></RequireRole>} />
          <Route path="/reports/dead-stock" element={<RequireRole permission="reports.view"><DeadStockPage /></RequireRole>} />
          <Route path="/crm/follow-ups" element={<RequireRole permission="customers.view"><FollowUpsPage /></RequireRole>} />
          <Route path="/hospitality/rooms" element={<RequireRole permission="hospitality.housekeeping.manage"><RoomStatusPage /></RequireRole>} />
          <Route path="/reports/analytics" element={<RequireRole permission="reports.view"><AnalyticsPage /></RequireRole>} />
          <Route path="/reports/stock-aging" element={<RequireRole permission="reports.view"><StockAgingPage /></RequireRole>} />
          <Route path="/data-quality" element={<RequireRole permission="audit.view"><DataQualityPage /></RequireRole>} />
          <Route path="/accounting/cost-centres" element={<RequireRole permission="reports.pnl"><CostCentresPage /></RequireRole>} />
          <Route path="/deliveries" element={<RequireRole permission="sales.view"><DeliveriesPage /></RequireRole>} />
          <Route path="/anomalies" element={<RequireRole permission="reports.view"><AnomaliesPage /></RequireRole>} />
          <Route path="/hospitality/reservations" element={<RequireRole permission="hospitality.bookings.manage"><ReservationsPage /></RequireRole>} />
          <Route path="/hospitality/kitchen" element={<RequireRole permission="hospitality.kitchen.bump"><KitchenDisplayPage /></RequireRole>} />
          <Route path="/hospitality/areas/:id" element={<RequireRole permission="hospitality.tables.manage"><AreaDetailPage /></RequireRole>} />
          <Route path="/hospitality/tables/:id" element={<RequireRole permission="hospitality.tables.manage"><TableDetailPage /></RequireRole>} />
          <Route path="/hospitality/room-types/:id" element={<RequireRole permission="hospitality.bookings.manage"><RoomTypeDetailPage /></RequireRole>} />
          <Route path="/hospitality/rooms/:id" element={<RequireRole permission="hospitality.bookings.manage"><RoomDetailPage /></RequireRole>} />
          <Route path="/retail/brands/:id" element={<RequireRole permission="retail.brands.manage"><BrandDetailPage /></RequireRole>} />
          <Route path="/hardware/quotations/:id" element={<RequireRole permission="hardware.quotations.manage"><QuotationDetailPage /></RequireRole>} />
          <Route path="/hardware/accounts/:customerId" element={<RequireRole permission="hardware.accounts.manage"><ContractorDetailPage /></RequireRole>} />
          <Route path="/reports/sales" element={<RequireRole permission="reports.view"><ReportsPage /></RequireRole>} />
          <Route path="/reports/inventory" element={<RequireRole permission="reports.view"><InventoryReportsPage /></RequireRole>} />
          <Route path="/reports/wastage" element={<RequireRole permission="reports.view"><WastageReportPage /></RequireRole>} />
          <Route path="/reports/zreport" element={<RequireRole permission="reports.zreport"><ZReportPage /></RequireRole>} />
          <Route path="/reports/tips" element={<RequireRole permission="reports.view"><TipsReportPage /></RequireRole>} />
          <Route path="/reports/daily-operations" element={<RequireRole permission={["reports.view", "reports.zreport"]}><DailyOperationsPage /></RequireRole>} />
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
          <Route path="/people" element={<RequireRole permission={["hr.employees.view","hr.attendance.view","hr.leave.request","hr.payroll.view"]}><PeopleHubPage /></RequireRole>} />
          <Route path="/hr/employees" element={<RequireRole permission="hr.employees.view"><EmployeesPage /></RequireRole>} />
          <Route path="/hr/employees/:id" element={<RequireRole permission="hr.employees.view"><EmployeeDetailPage /></RequireRole>} />
          <Route path="/hr/attendance" element={<RequireRole permission="hr.attendance.view"><AttendancePage /></RequireRole>} />
          <Route path="/hr/leave" element={<RequireRole permission="hr.leave.request"><LeavePage /></RequireRole>} />
          <Route path="/hr/payroll" element={<RequireRole permission="hr.payroll.view"><PayrollPage /></RequireRole>} />
          <Route path="/invoicing" element={<RequireRole permission="invoicing.view"><InvoicingPage /></RequireRole>} />
          <Route path="/invoicing/invoice/new" element={<RequireRole permission="invoicing.create"><NewDocumentPage type="invoice" /></RequireRole>} />
          <Route path="/invoicing/quotation/new" element={<RequireRole permission="invoicing.create"><NewDocumentPage type="quotation" /></RequireRole>} />
          <Route path="/invoicing/invoice/:id" element={<RequireRole permission="invoicing.view"><DocumentDetailPage type="invoice" /></RequireRole>} />
          <Route path="/invoicing/quotation/:id" element={<RequireRole permission="invoicing.view"><DocumentDetailPage type="quotation" /></RequireRole>} />
          <Route path="/invoicing/recurring" element={<RequireRole permission="invoicing.create"><RecurringInvoicesPage /></RequireRole>} />
          <Route path="/banking" element={<RequireRole permission={["banking.view","petty_cash.use","expenses.view"]}><BankingHubPage /></RequireRole>} />
          <Route path="/banking/accounts" element={<RequireRole permission="banking.view"><BankingPage /></RequireRole>} />
          <Route path="/banking/:id" element={<RequireRole permission="banking.view"><BankAccountDetailPage /></RequireRole>} />
          <Route path="/analytics" element={<RequireRole permission={["reports.view","reports.pnl","etims.view"]}><AnalyticsHubPage /></RequireRole>} />
          <Route path="/retail" element={<RequireRole permission="reports.view"><RetailHubPage /></RequireRole>} />
          <Route path="/hardware" element={<RequireRole permission="hardware.reports.view"><HardwareHubPage /></RequireRole>} />
          <Route path="/hospitality" element={<RequireRole permission="hospitality.tables.manage"><HospitalityHubPage /></RequireRole>} />
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
            <Route path="branches/:id" element={<RequireRole permission="settings.business"><BranchDetailPage /></RequireRole>} />
            <Route path="users" element={<RequireRole permission="users.view"><UsersPage /></RequireRole>} />
            <Route path="roles" element={<RequireRole permission="users.manage"><SettingsRolesPage /></RequireRole>} />
            <Route path="groups" element={<RequireRole permission="users.manage"><SettingsGroupsPage /></RequireRole>} />
            <Route path="access-audit" element={<RequireRole permission="users.manage"><SettingsAccessAuditPage /></RequireRole>} />
            <Route path="payments" element={<RequireRole permission="settings.business"><PaymentSettingsPage /></RequireRole>} />
            <Route path="etims" element={<RequireRole permission="etims.view"><EtimsSettingsPage /></RequireRole>} />
            <Route path="insurance" element={<RequireRole permission="claims.view"><InsuranceSettingsPage /></RequireRole>} />
            <Route path="network" element={<RequireRole permission="settings.network"><NetworkSettingsPage /></RequireRole>} />
            <Route path="modules" element={<RequireRole permission="settings.modules"><ModulesPage /></RequireRole>} />
            <Route path="appearance" element={<RequireRole permission="settings.business"><AppearanceSettingsPage /></RequireRole>} />
            <Route path="backup" element={<RequireRole permission="settings.backup"><BackupPage /></RequireRole>} />
            <Route path="cloud-backup" element={<RequireRole permission="settings.backup"><CloudBackupPage /></RequireRole>} />
            <Route path="taxes" element={<RequireRole permission="settings.business"><TaxSettingsPage /></RequireRole>} />
            <Route path="categories" element={<RequireRole permission="inventory.edit"><CategoriesSettingsPage /></RequireRole>} />
            <Route path="units" element={<RequireRole permission="inventory.edit"><UnitsSettingsPage /></RequireRole>} />
            <Route path="price-lists" element={<RequireRole permission="retail.price_lists.manage"><PriceListSettingsPage /></RequireRole>} />
            <Route path="customer-display" element={<RequireRole permission="settings.business"><CustomerDisplaySettingsPage /></RequireRole>} />
            <Route path="ai" element={<RequireRole permission="settings.business"><AiSettingsPage /></RequireRole>} />
            <Route path="receipt" element={<RequireRole permission="settings.business"><ReceiptSettingsPage /></RequireRole>} />
            <Route path="printing" element={<RequireRole permission="settings.business"><PrintSettingsPage /></RequireRole>} />
            <Route path="scanner" element={<RequireRole permission="settings.business"><ScannerSettingsPage /></RequireRole>} />
            <Route path="updates" element={<RequireRole permission="settings.business"><SettingsUpdatesPage /></RequireRole>} />
            <Route path="autostart" element={<RequireRole permission="settings.business"><SettingsAutostartPage /></RequireRole>} />
            <Route path="2fa" element={<Settings2FAPage />} />
            <Route path="lan-service" element={<RequireRole permission="settings.network"><LanServicePage /></RequireRole>} />
            <Route path="currencies" element={<RequireRole permission="settings.business"><CurrenciesPage /></RequireRole>} />
            <Route path="peripherals" element={<RequireRole permission="settings.business"><PeripheralsPage /></RequireRole>} />
            <Route path="hardware/units" element={<RequireRole permission="hardware.accounts.manage"><HardwareSettingsPage /></RequireRole>} />
            <Route path="hospitality/service-charge" element={<RequireRole permission="hospitality.service_charge.manage"><HospitalitySettingsPage /></RequireRole>} />
            <Route path="audit" element={<RequireRole permission="audit.view"><AuditLogPage /></RequireRole>} />
            {/* Legacy path — kept as a redirect for one release cycle so old
                bookmarks continue to resolve. New home is /settings/licenses. */}
            <Route path="license" element={<Navigate to="/settings/licenses" replace />} />
            <Route path="licenses" element={<RequireRole permission="license.view"><SettingsLicensesPage /></RequireRole>} />
            <Route path="pharmacy-licenses" element={<RequireRole permission="pharmacy.dispense"><SettingsPharmacyLicensesPage /></RequireRole>} />
            <Route path="display" element={<RequireRole permission="settings.business"><SettingsDisplayPage /></RequireRole>} />
          </Route>
          <Route path="/audit" element={<Navigate to="/settings/audit" replace />} />
          <Route path="/suppliers" element={<RequireRole permission="suppliers.view"><SuppliersPage /></RequireRole>} />
          <Route path="/suppliers/:id" element={<RequireRole permission="suppliers.view"><SupplierDetailPage /></RequireRole>} />
          <Route path="/purchase-orders" element={<RequireRole permission="purchase_orders.view"><PurchaseOrdersPage /></RequireRole>} />
          <Route path="/purchase-orders/new" element={<RequireRole permission="purchase_orders.create"><NewPurchaseOrderPage /></RequireRole>} />
          <Route path="/purchase-orders/:id" element={<RequireRole permission="purchase_orders.view"><PurchaseOrderDetailPage /></RequireRole>} />
          <Route path="/customers" element={<RequireRole permission="customers.view"><CustomersPage /></RequireRole>} />
          <Route path="/customers/:id" element={<RequireRole permission="customers.view"><CustomerDetailPage /></RequireRole>} />
          <Route path="/returns" element={<RequireRole permission="sales.refund"><ReturnsPage /></RequireRole>} />
          <Route path="/returns/new" element={<RequireRole permission="sales.refund"><NewReturnPage /></RequireRole>} />
          <Route path="/stock-take" element={<RequireRole permission="stock_take.use"><StockTakesPage /></RequireRole>} />
          <Route path="/stock-take/:id" element={<RequireRole permission="stock_take.use"><StockTakeDetailPage /></RequireRole>} />
          <Route path="/patients/:id" element={<RequireRole permission="customers.view"><PatientProfilePage /></RequireRole>} />
          <Route path="/claims" element={<RequireRole permission="claims.view"><ClaimsPage /></RequireRole>} />
          <Route path="/etims" element={<RequireRole permission="etims.view"><EtimsQueuePage /></RequireRole>} />
          <Route path="/vat-report" element={<RequireRole permission="reports.view"><VatReportPage /></RequireRole>} />
          {/* Hardware module */}
          <Route path="/hardware/dashboard" element={<Navigate to="/hardware" replace />} />
          <Route path="/hardware/quotations" element={<RequireRole permission="hardware.quotations.manage"><HardwareQuotationsPage /></RequireRole>} />
          <Route path="/hardware/delivery-notes" element={<RequireRole permission="hardware.delivery_notes.manage"><HardwareDeliveryNotesPage /></RequireRole>} />
          <Route path="/hardware/accounts" element={<RequireRole permission="hardware.accounts.manage"><HardwareAccountsPage /></RequireRole>} />
          <Route path="/hardware/commissions" element={<RequireRole permission="hardware.commissions.view"><HardwareCommissionsPage /></RequireRole>} />
          <Route path="/hardware/reports" element={<RequireRole permission="hardware.reports.view"><HardwareReportsPage /></RequireRole>} />
          {/* Hospitality module */}
          <Route path="/hospitality/dashboard" element={<RequireRole permission="hospitality.reports.view"><HospitalityDashboardPage /></RequireRole>} />
          <Route path="/hospitality/tables" element={<RequireRole permission="hospitality.tables.manage"><HospitalityTablesPage /></RequireRole>} />
          <Route path="/hospitality/menu" element={<RequireRole permission="hospitality.menu.manage"><HospitalityMenuPage /></RequireRole>} />
          <Route path="/hospitality/menu/:id" element={<RequireRole permission="hospitality.menu.manage"><MenuItemDetailPage /></RequireRole>} />
          <Route path="/hospitality/orders" element={<RequireRole permission="hospitality.orders.take"><HospitalityOrdersPage /></RequireRole>} />
          <Route path="/hospitality/rooms" element={<RequireRole permission="hospitality.bookings.manage"><HospitalityRoomsPage /></RequireRole>} />
          <Route path="/hospitality/bookings" element={<RequireRole permission="hospitality.bookings.manage"><HospitalityBookingsPage /></RequireRole>} />
          <Route path="/hospitality/checkin" element={<RequireRole permission="hospitality.checkin.manage"><HospitalityBookingsPage /></RequireRole>} />
          <Route path="/hospitality/housekeeping" element={<Navigate to="/hospitality/rooms?status=dirty" replace />} />
          <Route path="/hospitality/folios" element={<RequireRole permission="hospitality.folios.manage"><HospitalityFoliosPage /></RequireRole>} />
          <Route path="/hospitality/recipes" element={<RequireRole permission="hospitality.recipes.manage"><HospitalityRecipesPage /></RequireRole>} />
          <Route path="/hospitality/reports" element={<RequireRole permission="hospitality.reports.view"><HospitalityReportsPage /></RequireRole>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
        {/* Customer-facing display — opens in separate window, no shell/sidebar */}
        <Route path="/customer-display" element={<CustomerDisplayPage />} />
      </Routes>
      <Toaster position="bottom-right" />
      <ConfirmDialogHost />
      <TouchTextKeyboardProvider />
      <GlobalSearchDialog />
    </BrowserRouter>
  );
}

export default App;
