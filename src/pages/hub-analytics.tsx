/**
 * Analytics hub — /analytics
 *
 * Single front door for everything reporting-shaped: dashboard, sales
 * reports, inventory reports, Z-report, P&L, daily ops, VAT report,
 * eTIMS queue, tips report.
 *
 * Direct routes (/dashboard, /pnl, /reports/...) stay intact for deep
 * links and bookmarks.
 */
import { useAuthStore } from "@/stores/auth";
import { hasPermission, type Permission } from "@/lib/permissions";
import {
  ChartBar as BarChart3,
  ChartLine as LineChart,
  ClipboardText as ClipboardList,
  Coins,
  FileText,
  FileXls as FileSpreadsheet,
  House as LayoutDashboard,
  Package as Boxes,
  PaperPlaneTilt as Send,
} from "@phosphor-icons/react";
import { HubLayout } from "@/components/layout/hub-layout";
import { DashboardPage } from "@/pages/dashboard";
import { ReportsPage } from "@/pages/reports";
import { InventoryReportsPage } from "@/pages/inventory-reports";
import { ZReportPage } from "@/pages/zreport";
import { PnLPage } from "@/pages/pnl";
import { DailyOperationsPage } from "@/pages/daily-operations";
import { VatReportPage } from "@/pages/vat-report";
import { EtimsQueuePage } from "@/pages/etims-queue";
import { TipsReportPage } from "@/pages/tips-report";

export function AnalyticsHubPage() {
  const user = useAuthStore((s) => s.user);
  const has = (perm: string) => hasPermission(user, perm as Permission);
  return (
    <HubLayout
      eyebrow="Insights"
      title="Analytics"
      description="What's happening, what happened, what it means."
      tabs={[
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, component: DashboardPage, permission: "reports.view" },
        { id: "sales", label: "Sales reports", icon: BarChart3, component: ReportsPage, permission: "reports.view" },
        { id: "inventory", label: "Inventory reports", icon: Boxes, component: InventoryReportsPage, permission: "reports.view" },
        { id: "zreport", label: "Z-Report", icon: FileText, component: ZReportPage, permission: "reports.zreport" },
        { id: "pnl", label: "P&L", icon: LineChart, component: PnLPage, permission: "reports.pnl" },
        { id: "daily-ops", label: "Daily ops", icon: ClipboardList, component: DailyOperationsPage, permission: "reports.view" },
        { id: "vat", label: "VAT report", icon: FileSpreadsheet, component: VatReportPage, permission: "reports.view" },
        { id: "etims", label: "eTIMS", icon: Send, component: EtimsQueuePage, permission: "etims.view" },
        { id: "tips", label: "Tips", icon: Coins, component: TipsReportPage, permission: "reports.view" },
      ]}
      hasPermission={has}
    />
  );
}
