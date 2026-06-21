/**
 * Sales hub — /sales-hub
 *
 * Sales history, returns, invoicing, recurring, promotions, held.
 * /sales (sales history) keeps working as a direct route.
 */
import { useAuthStore } from "@/stores/auth";
import { hasPermission, type Permission } from "@/lib/permissions";
import {
  ArrowCounterClockwise as RotateCcw,
  ArrowsClockwise as RefreshCw,
  FileText,
  Receipt,
  Tag,
} from "@phosphor-icons/react";
import { HubLayout } from "@/components/layout/hub-layout";
import { SalesHistoryPage } from "@/pages/sales-history";
import { ReturnsPage } from "@/pages/returns";
import { InvoicingPage } from "@/pages/invoicing";
import { RecurringInvoicesPage } from "@/pages/recurring-invoices";
import { PromotionsPage } from "@/pages/promotions";

export function SalesHubPage() {
  const user = useAuthStore((s) => s.user);
  const has = (perm: string) => hasPermission(user, perm as Permission);
  return (
    <HubLayout
      eyebrow="Commerce"
      title="Sales"
      description="Receipts, refunds, invoices, promotions — everything that follows the till."
      tabs={[
        { id: "history", label: "Sales", icon: Receipt, component: SalesHistoryPage, permission: "sales.view" },
        { id: "returns", label: "Returns", icon: RotateCcw, component: ReturnsPage, permission: "sales.refund" },
        { id: "invoicing", label: "Invoicing", icon: FileText, component: InvoicingPage, permission: "invoicing.view" },
        { id: "recurring", label: "Recurring", icon: RefreshCw, component: RecurringInvoicesPage, permission: "invoicing.create" },
        { id: "promotions", label: "Promotions", icon: Tag, component: PromotionsPage, permission: "promotions.manage" },
      ]}
      hasPermission={has}
    />
  );
}
