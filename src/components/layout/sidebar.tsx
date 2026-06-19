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
  Receipt,
  Users,
  Wrench,
  UtensilsCrossed,
  ShoppingBag,
  Landmark,
  Banknote,
  UserCog,
  // ModuleGroup component (no longer used) was the only consumer of
  // the rest. Keeping a lean barrel since most icons came from there.
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { OmnixLogo } from "@/components/omnix-logo";
import { ModuleLogo } from "@/components/module-logos";
import { APP_NAME } from "@/lib/brand";
import { useAuthStore } from "@/stores/auth";
import { useActiveModule, MODULE_DEFINITIONS, type ModuleId } from "@/stores/active-module";
import { hasAnyPermission, type Permission } from "@/lib/permissions";
import { isFeatureAvailable, getFeatureModule } from "@/lib/module-features";
import { isModuleEntitled } from "@/stores/entitlements";
import { useEntitlements } from "@/stores/entitlements";
import { useCountry } from "@/stores/country";
import { pharmacyTerm } from "@/lib/locale";

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  /** Show this item only if user has at least one of these permissions. Empty = always show. */
  permissions: Permission[];
}

/**
 * Flat hub-page sidebar — every entry is a top-level destination,
 * never a submenu. Functional domains (Sales, Inventory, People,
 * Banking, Analytics) become hub pages that arrange their child
 * routes as horizontal tabs. Module verticals (Pharmacy, Retail,
 * Hardware, Hospitality) follow the same pattern.
 *
 * The old MODULE_GROUPS expand/collapse pattern is gone — clicking
 * a module now lands on the module hub page and the child screens
 * appear as tabs there. The sidebar stays at ~10 entries no matter
 * how many features ship.
 */
const CORE_NAV: NavItem[] = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", permissions: [] },
  { to: "/pos", icon: ShoppingCart, label: "POS", permissions: ["pos.use"] },
  { to: "/sales", icon: Receipt, label: "Sales", permissions: ["sales.view"] },
  { to: "/inventory", icon: Package, label: "Inventory", permissions: ["inventory.view"] },
  { to: "/customers", icon: Users, label: "Customers", permissions: ["customers.view"] },
  { to: "/people", icon: UserCog, label: "People", permissions: ["hr.employees.view","hr.attendance.view","hr.leave.request","hr.payroll.view"] },
  { to: "/banking", icon: Landmark, label: "Banking", permissions: ["banking.view","petty_cash.use","expenses.view"] },
  { to: "/cash-register", icon: Banknote, label: "Cash Register", permissions: ["cash_register.use"] },
  { to: "/analytics", icon: BarChart3, label: "Analytics", permissions: ["reports.view","reports.pnl","etims.view"] },
];

/**
 * Module verticals — each lands on its hub page directly.
 * The hub page shows all child screens as tabs.
 */
const MODULE_NAV_ENTRIES: Partial<Record<ModuleId, NavItem>> = {
  dawa: { to: "/pharmacy", icon: Pill, label: "Pharmacy", permissions: ["pharmacy.dispense"] },
  retail: { to: "/retail", icon: ShoppingBag, label: "Retail", permissions: ["reports.view"] },
  hardware: { to: "/hardware", icon: Wrench, label: "Hardware", permissions: ["hardware.reports.view"] },
  hospitality: { to: "/hospitality", icon: UtensilsCrossed, label: "Hospitality", permissions: ["hospitality.tables.manage"] },
};

export function Sidebar({ onCommandOpen }: { onCommandOpen: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const user = useAuthStore((s) => s.user);
  const activeModuleId = useActiveModule((s) => s.active);
  const loadModule = useActiveModule((s) => s.load);
  const activeModule = MODULE_DEFINITIONS[activeModuleId];
  // Subscribe so the nav recomputes once entitlements hydrate from the license.
  useEntitlements((s) => s.modules);

  // Lazy-load active module from DB on first mount
  if (!useActiveModule.getState().loaded) {
    loadModule().catch(() => {});
  }

  // The active module gets a single flat entry that links to its hub page.
  // No more expand/collapse submenus; child screens live as tabs on the hub.
  const moduleEntry =
    activeModuleId !== "core" ? MODULE_NAV_ENTRIES[activeModuleId] : undefined;
  const countryCode = useCountry((s) => s.code);
  const activeModuleEntry =
    moduleEntry && activeModuleId === "dawa"
      ? { ...moduleEntry, label: pharmacyTerm(countryCode) }
      : moduleEntry;

  const itemVisible = (item: NavItem) => {
    const owner = getFeatureModule(item.to);
    if (owner && !isModuleEntitled(owner)) return false;
    return (
      (item.permissions.length === 0 || hasAnyPermission(user, item.permissions)) &&
      isFeatureAvailable(item.to, activeModuleId)
    );
  };

  const visibleCore = CORE_NAV.filter(itemVisible);
  const showModuleEntry = activeModuleEntry ? itemVisible(activeModuleEntry) : false;

  // The module entry sits right under POS for muscle memory.
  const insertIdx = visibleCore.findIndex((i) => i.to === "/pos") + 1;
  const before = visibleCore.slice(0, insertIdx || visibleCore.length);
  const after = visibleCore.slice(insertIdx || visibleCore.length);

  return (
    <aside
      className={cn(
        "flex flex-col glass-sidebar h-full transition-all duration-200",
        collapsed ? "w-[52px]" : "w-[200px]",
      )}
    >
      {/* Logo + Active Module */}
      <div className="flex items-center h-12 px-3 border-b border-border/60 gap-2">
        {activeModule && activeModule.id !== "core" ? (
          <ModuleLogo moduleId={activeModule.id} size={22} rounded />
        ) : (
          <OmnixLogo size={22} />
        )}
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 text-sm font-semibold tracking-tight leading-tight">
              {activeModule && activeModule.id !== "core" ? activeModule.shortName : APP_NAME}
            </div>
            {activeModule && activeModule.id !== "core" && (
              <div className="text-[10px] text-muted-foreground font-medium leading-tight mt-0.5">
                Powered by {APP_NAME}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search trigger */}
      <button
        onClick={onCommandOpen}
        data-tour="cmd-k"
        className={cn(
          "mx-2 mt-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground transition-all duration-150 cursor-pointer",
          collapsed && "justify-center",
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
      <nav className="flex-1 mt-2 px-2 space-y-0.5 overflow-auto min-h-0 pb-2">
        {before.map((item) => (
          <NavRow key={item.to} item={item} collapsed={collapsed} />
        ))}

        {/* Active-module hub entry (flat — child screens are tabs on the hub) */}
        {activeModuleEntry && showModuleEntry && (
          <NavRow item={activeModuleEntry} collapsed={collapsed} />
        )}

        {after.map((item) => (
          <NavRow key={item.to} item={item} collapsed={collapsed} />
        ))}

        {/* Settings (always last, always single row — its own shell) */}
        <NavRow
          item={{
            to: "/settings",
            icon: Settings,
            label: "Settings",
            permissions: ["settings.business"],
          }}
          collapsed={collapsed}
        />
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-border/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
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

function NavRow({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-all duration-150 cursor-pointer",
          isActive
            ? "bg-primary/10 text-foreground font-medium shadow-[inset_0_1px_0_rgb(255_255_255_/_0.06)]"
            : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
          collapsed && "justify-center",
        )
      }
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  );
}

