/**
 * Inventory hub — /inventory
 *
 * Tabs across products, categories, transfers, purchases, stock take,
 * suppliers. /inventory (Products list) stays the direct deep-link.
 */
import { useAuthStore } from "@/stores/auth";
import { hasPermission, type Permission } from "@/lib/permissions";
import { Package, Tag, ArrowLeftRight, Truck, ClipboardCheck, Building2 } from "lucide-react";
import { HubLayout } from "@/components/layout/hub-layout";
import { InventoryPage } from "@/pages/inventory";
import { CategoriesSettingsPage } from "@/pages/settings-categories";
import { StockTransfersPage } from "@/pages/stock-transfers";
import { PurchaseOrdersPage } from "@/pages/purchase-orders";
import { StockTakesPage } from "@/pages/stock-take";
import { SuppliersPage } from "@/pages/suppliers";

export function InventoryHubPage() {
  const user = useAuthStore((s) => s.user);
  const has = (perm: string) => hasPermission(user, perm as Permission);
  return (
    <HubLayout
      eyebrow="Operations"
      title="Inventory"
      description="Products, stock movements, purchases, and the people you buy from."
      tabs={[
        { id: "products", label: "Products", icon: Package, component: InventoryPage, permission: "inventory.view" },
        { id: "categories", label: "Categories", icon: Tag, component: CategoriesSettingsPage, permission: "inventory.edit" },
        { id: "transfers", label: "Transfers", icon: ArrowLeftRight, component: StockTransfersPage, permission: "inventory.view" },
        { id: "purchases", label: "Purchases", icon: Truck, component: PurchaseOrdersPage, permission: "purchase_orders.view" },
        { id: "stock-take", label: "Stock take", icon: ClipboardCheck, component: StockTakesPage, permission: "stock_take.use" },
        { id: "suppliers", label: "Suppliers", icon: Building2, component: SuppliersPage, permission: "suppliers.view" },
      ]}
      hasPermission={has}
    />
  );
}
