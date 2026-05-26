import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Pill,
  BarChart3,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Search,
  FileCheck,
  Shield,
  Receipt,
  Truck,
  Users,
  RotateCcw,
  ClipboardCheck,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { SokoLogo } from "@/components/soko-logo";
import { APP_NAME } from "@/lib/brand";
import { useAuthStore } from "@/stores/auth";
import { hasAnyPermission, type Permission } from "@/lib/permissions";

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  /** Show this item only if user has at least one of these permissions. Empty = always show. */
  permissions: Permission[];
}

const navItems: NavItem[] = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", permissions: [] },
  { to: "/pos", icon: ShoppingCart, label: "POS", permissions: ["pos.use"] },
  { to: "/sales", icon: Receipt, label: "Sales", permissions: ["sales.view"] },
  { to: "/returns", icon: RotateCcw, label: "Returns", permissions: ["sales.refund"] },
  { to: "/inventory", icon: Package, label: "Inventory", permissions: ["inventory.view"] },
  { to: "/purchase-orders", icon: Truck, label: "Purchases", permissions: ["purchase_orders.view"] },
  { to: "/stock-take", icon: ClipboardCheck, label: "Stock Take", permissions: ["stock_take.use"] },
  { to: "/suppliers", icon: Truck, label: "Suppliers", permissions: ["suppliers.view"] },
  { to: "/customers", icon: Users, label: "Customers", permissions: ["customers.view"] },
  { to: "/pharmacy", icon: Pill, label: "Pharmacy", permissions: ["pharmacy.dispense"] },
  { to: "/reports", icon: BarChart3, label: "Reports", permissions: ["reports.view", "reports.zreport"] },
  { to: "/etims", icon: FileCheck, label: "eTIMS", permissions: ["etims.view"] },
  { to: "/claims", icon: Shield, label: "Claims", permissions: ["claims.view"] },
  { to: "/settings", icon: Settings, label: "Settings", permissions: ["settings.business"] },
];

export function Sidebar({ onCommandOpen }: { onCommandOpen: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const user = useAuthStore((s) => s.user);

  const visibleNav = navItems.filter(
    (item) => item.permissions.length === 0 || hasAnyPermission(user, item.permissions),
  );

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-sidebar h-full transition-all duration-200",
        collapsed ? "w-[52px]" : "w-[200px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-12 px-3 border-b border-border gap-2">
        <SokoLogo size={24} />
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight">{APP_NAME}</span>
        )}
      </div>

      {/* Search trigger */}
      <button
        onClick={onCommandOpen}
        data-tour="cmd-k"
        className={cn(
          "mx-2 mt-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors",
          collapsed && "justify-center"
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">Search...</span>
            <kbd className="text-[10px] bg-muted px-1 rounded">⌘K</kbd>
          </>
        )}
      </button>

      {/* Nav */}
      <nav className="flex-1 mt-2 px-2 space-y-0.5">
        {visibleNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                collapsed && "justify-center"
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-border text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? (
          <ChevronsRight className="h-4 w-4" />
        ) : (
          <ChevronsLeft className="h-4 w-4" />
        )}
      </button>
    </aside>
  );
}
