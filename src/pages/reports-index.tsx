import { Link } from "react-router-dom";
import {
  ArrowsLeftRight as ArrowLeftRight,
  BookOpen,
  Calendar,
  FileText as FileCheck,
  FileXls as FileSpreadsheet,
  Heart,
  Money as Banknote,
  Package,
  PaperPlaneTilt as Send,
  Pill,
  Receipt,
  Scales as Scale,
  TrendUp as TrendingUp,
  Wallet,
  Warning as AlertTriangle,
} from "@phosphor-icons/react";
import { intlLocale } from "@/lib/intl";

interface ReportLink {
  to: string;
  title: string;
  description: string;
  icon: typeof TrendingUp;
  category: "sales" | "inventory" | "finance" | "pharmacy";
}

const reports: ReportLink[] = [
  {
    to: "/reports/sales",
    title: "Sales Reports",
    description: "Revenue trends, top products, payment methods",
    icon: TrendingUp,
    category: "sales",
  },
  {
    to: "/reports/daily-operations",
    title: "Day Book (End of Day)",
    description: "Comprehensive close-of-day: every product sold (qty, revenue, profit), payments, returns, cash movement",
    icon: BookOpen,
    category: "sales",
  },
  {
    to: "/reports/zreport",
    title: "Z-Report",
    description: "Minimal till summary for cash reconciliation and shift handover",
    icon: FileSpreadsheet,
    category: "sales",
  },
  {
    to: "/reports/tips",
    title: "Tips & Gratuities",
    description: "Track tips by staff member, payment method, and period",
    icon: Heart,
    category: "sales",
  },
  {
    to: "/reports/inventory",
    title: "Inventory Reports",
    description: "Stock valuation, reorder list, dead stock",
    icon: Package,
    category: "inventory",
  },
  {
    to: "/pnl",
    title: "Profit & Loss",
    description: "Full P&L statement with margin analysis",
    icon: Scale,
    category: "finance",
  },
  {
    to: "/expenses",
    title: "Expenses",
    description: "Track and categorize business expenses",
    icon: Receipt,
    category: "finance",
  },
  {
    to: "/cash-register",
    title: "Cash Register",
    description: "Shift management and variance tracking",
    icon: Wallet,
    category: "finance",
  },
  {
    to: "/pharmacy/expiry",
    title: "Expiry Alerts",
    description: "Stock expiring within 30/60/90 days",
    icon: AlertTriangle,
    category: "pharmacy",
  },
  {
    to: "/pharmacy",
    title: "Prescriptions",
    description: "Prescription history and dispensing log",
    icon: Pill,
    category: "pharmacy",
  },
  {
    to: "/inventory/stock",
    title: "Stock Movements",
    description: "All inventory movements (audit trail)",
    icon: ArrowLeftRight,
    category: "inventory",
  },
  {
    to: "/vat-report",
    title: "VAT Return",
    description: "Monthly VAT3 return summary for KRA filing",
    icon: FileCheck,
    category: "finance",
  },
  {
    to: "/etims",
    title: "eTIMS Submissions",
    description: "KRA invoice submission status and queue",
    icon: Send,
    category: "finance",
  },
];

const categories = [
  { id: "sales", label: "Sales", icon: TrendingUp },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "finance", label: "Finance & Accounting", icon: Banknote },
  { id: "pharmacy", label: "Pharmacy", icon: Pill },
] as const;

export function ReportsIndexPage() {
  const today = new Date().toLocaleDateString(intlLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">All reports and analytics in one place</p>
        </div>
        <div className="text-right">
          <Calendar className="h-4 w-4 text-muted-foreground inline mr-1.5" />
          <span className="text-xs text-muted-foreground">{today}</span>
        </div>
      </div>

      {categories.map((cat) => {
        const items = reports.filter((r) => r.category === cat.id);
        if (items.length === 0) return null;
        return (
          <section key={cat.id}>
            <div className="flex items-center gap-2 mb-3">
              <cat.icon className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {cat.label}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((report) => (
                <Link
                  key={report.to}
                  to={report.to}
                  className="border border-border rounded-lg p-4 hover:bg-accent/30 hover:border-accent transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <report.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium">{report.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {report.description}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
