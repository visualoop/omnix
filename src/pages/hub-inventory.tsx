/**
 * Inventory hub — /inventory
 *
 * Tabs across products, categories, transfers, purchases, stock take,
 * damages, suppliers. /inventory (Products list) stays the direct deep-link.
 *
 * Header summary strip: products / units / stock value at cost / low-stock /
 * expiring — computed from live SQL so the operator lands on a page that
 * already tells them what needs attention today.
 */
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { hasPermission, type Permission } from "@/lib/permissions";
import {
  ArrowsLeftRight as ArrowLeftRight,
  Building as Building2,
  ClipboardText as ClipboardCheck,
  SquaresFour,
  Tag,
  Truck,
  Warning as AlertTriangle,
  Package,
} from "@phosphor-icons/react";
import { HubLayout } from "@/components/layout/hub-layout";
import { InventoryPage } from "@/pages/inventory";
import { CategoriesSettingsPage } from "@/pages/settings-categories";
import { GoodsReceiptsPage } from "@/pages/goods-receipts";
import { StockTransfersPage } from "@/pages/stock-transfers";
import { PurchaseOrdersPage } from "@/pages/purchase-orders";
import { StockTakesPage } from "@/pages/stock-take";
import { SuppliersPage } from "@/pages/suppliers";
import { DamagesPage } from "@/pages/damages";
import { query } from "@/lib/db";
import { money as KES } from "@/lib/money";

interface Kpis {
  products: number;
  units: number;
  stockValueCost: number;
  lowStock: number;
  expiring: number;
}

async function loadKpis(): Promise<Kpis> {
  // One SQL trip per KPI keeps it readable. Errors on any query short-circuit
  // to zero for that field so the header never fails to render.
  const [productsRow] = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM products WHERE active = 1 AND COALESCE(kind, 'physical') = 'physical' AND COALESCE(is_service, 0) = 0`,
  ).catch(() => [{ n: 0 }]);
  const [unitsRow] = await query<{ n: number; v: number }>(
    `SELECT COALESCE(SUM(quantity), 0) AS n, COALESCE(SUM(quantity * buying_price), 0) AS v FROM batches WHERE quantity > 0`,
  ).catch(() => [{ n: 0, v: 0 }]);
  const [lowRow] = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM products p
       WHERE p.active = 1 AND COALESCE(p.kind, 'physical') = 'physical'
         AND COALESCE(p.is_service, 0) = 0
         AND (
           SELECT COALESCE(SUM(quantity), 0) FROM batches WHERE product_id = p.id
         ) <= COALESCE(p.reorder_level, 0)
         AND COALESCE(p.reorder_level, 0) > 0`,
  ).catch(() => [{ n: 0 }]);
  const [expiringRow] = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM batches
       WHERE quantity > 0
         AND expiry_date IS NOT NULL
         AND expiry_date <= date('now', '+90 days')
         AND expiry_date > date('now')`,
  ).catch(() => [{ n: 0 }]);
  return {
    products: productsRow?.n ?? 0,
    units: unitsRow?.n ?? 0,
    stockValueCost: unitsRow?.v ?? 0,
    lowStock: lowRow?.n ?? 0,
    expiring: expiringRow?.n ?? 0,
  };
}

function KpiTile({ label, value, tone }: { label: string; value: string; tone?: "warning" | "danger" }) {
  const toneCls =
    tone === "danger" ? "text-rose-600" :
    tone === "warning" ? "text-amber-600" :
    "text-foreground";
  return (
    <div className="flex flex-col items-end px-3 py-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`font-mono tabular-nums text-[13px] font-semibold mt-0.5 ${toneCls}`}>{value}</span>
    </div>
  );
}

export function InventoryHubPage() {
  const user = useAuthStore((s) => s.user);
  const has = (perm: string) => hasPermission(user, perm as Permission);
  const [kpis, setKpis] = useState<Kpis | null>(null);

  useEffect(() => {
    loadKpis().then(setKpis).catch(() => setKpis({ products: 0, units: 0, stockValueCost: 0, lowStock: 0, expiring: 0 }));
  }, []);

  const summary = kpis ? (
    <div className="flex flex-wrap items-center gap-4 divide-x divide-border/60">
      <KpiTile label="Products" value={kpis.products.toLocaleString()} />
      <KpiTile label="Units" value={kpis.units.toLocaleString()} />
      <KpiTile label="Stock value" value={KES(kpis.stockValueCost)} />
      <KpiTile
        label="Low stock"
        value={kpis.lowStock.toLocaleString()}
        tone={kpis.lowStock > 0 ? "warning" : undefined}
      />
      <KpiTile
        label="Expiring 90d"
        value={kpis.expiring.toLocaleString()}
        tone={kpis.expiring > 0 ? "warning" : undefined}
      />
    </div>
  ) : undefined;

  return (
    <HubLayout
      eyebrow="Operations"
      title="Inventory"
      description="Products, stock movements, purchases, and the people you buy from."
      summary={summary}
      tabs={[
        { id: "products", label: "Products", icon: SquaresFour, component: InventoryPage, permission: "inventory.view" },
        { id: "categories", label: "Categories", icon: Tag, component: CategoriesSettingsPage, permission: "inventory.edit" },
        { id: "transfers", label: "Transfers", icon: ArrowLeftRight, component: StockTransfersPage, permission: "inventory.view" },
        { id: "purchases", label: "Purchases", icon: Truck, component: PurchaseOrdersPage, permission: "purchase_orders.view" },
        { id: "receipts", label: "Receipts", icon: Package, component: GoodsReceiptsPage, permission: "purchase_orders.view" },
        { id: "stock-take", label: "Stock take", icon: ClipboardCheck, component: StockTakesPage, permission: "stock_take.use" },
        { id: "damages", label: "Damages", icon: AlertTriangle, component: DamagesPage, permission: "inventory.edit" },
        { id: "suppliers", label: "Suppliers", icon: Building2, component: SuppliersPage, permission: "suppliers.view" },
      ]}
      hasPermission={has}
    />
  );
}
