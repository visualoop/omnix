import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
// Phosphor icons — duotone-friendly and consistent with the editorial
// design language we're rolling out across the desktop app. The
// LayoutDashboard alias keeps existing icon-typed props happy.
import {
  House as LayoutDashboard,
  ShoppingCart,
  SquaresFour,
  Pill,
  ChartBar as BarChart3,
  GearSix as Settings,
  CaretDoubleLeft as ChevronsLeft,
  CaretDoubleRight as ChevronsRight,
  MagnifyingGlass as Search,
  Receipt,
  Users,
  Wrench,
  ForkKnife as UtensilsCrossed,
  ShoppingBag,
  Bank as Landmark,
  Money as Banknote,
  UserGear as UserCog,
  Sparkle,
} from "@phosphor-icons/react";
import { NavLink } from "react-router-dom";
import { OmnixLogo } from "@/components/omnix-logo";
import { ModuleSwitcher } from "@/components/layout/module-switcher";
import { ModuleLogo } from "@/components/module-logos";
import { APP_NAME, POWERED_BY } from "@/lib/brand";
import { useAuthStore } from "@/stores/auth";
import { useActiveModule, MODULE_DEFINITIONS, type ModuleId } from "@/stores/active-module";
import { hasAnyPermission, MODULE_ACCESS_PERMISSIONS, type Permission } from "@/lib/permissions";
import { isFeatureAvailable, getFeatureModule } from "@/lib/module-features";
import { isModuleEntitled } from "@/stores/entitlements";
import { useEntitlements } from "@/stores/entitlements";
import { useCountry } from "@/stores/country";
import { pharmacyTerm } from "@/lib/locale";

interface NavItem {
  moduleId?: ModuleId;
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
  { to: "/ai", icon: Sparkle, label: "Omnix AI", permissions: [] },
  { to: "/pos", icon: ShoppingCart, label: "POS", permissions: ["pos.use"] },
  { to: "/sales", icon: Receipt, label: "Sales", permissions: ["sales.view"] },
  { to: "/inventory", icon: SquaresFour, label: "Inventory", permissions: ["inventory.view"] },
  { to: "/customers", icon: Users, label: "Customers", permissions: ["customers.view"] },
  { to: "/people", icon: UserCog, label: "People", permissions: ["hr.employees.view","hr.attendance.view","hr.leave.request","hr.payroll.view"] },
  { to: "/banking", icon: Landmark, label: "Banking", permissions: ["banking.view","petty_cash.use","expenses.view"] },
  { to: "/cash-register", icon: Banknote, label: "Cash Register", permissions: ["cash_register.use"] },
  { to: "/analytics", icon: BarChart3, label: "Analytics", permissions: ["reports.view","reports.pnl","etims.view"] },
];

/** Settings entry — shown only to roles with at least one settings permission
 * (owner/manager). Cashiers/viewers have none, so it's hidden entirely. */
const SETTINGS_NAV: NavItem = {
  to: "/settings",
  icon: Settings,
  label: "Settings",
  permissions: ["settings.business", "settings.network", "settings.backup", "settings.modules"],
};

/**
 * Module verticals — each lands on its hub page directly.
 * The hub page shows all child screens as tabs.
 */
const MODULE_NAV_ENTRIES: Partial<Record<ModuleId, NavItem>> = {
  dawa: { moduleId: "dawa", to: "/pharmacy", icon: Pill, label: "Pharmacy", permissions: [...MODULE_ACCESS_PERMISSIONS.dawa] },
  retail: { moduleId: "retail", to: "/retail", icon: ShoppingBag, label: "Retail", permissions: [...MODULE_ACCESS_PERMISSIONS.retail] },
  hardware: { moduleId: "hardware", to: "/hardware", icon: Wrench, label: "Hardware", permissions: [...MODULE_ACCESS_PERMISSIONS.hardware] },
  hospitality: { moduleId: "hospitality", to: "/hospitality", icon: UtensilsCrossed, label: "Hospitality", permissions: [...MODULE_ACCESS_PERMISSIONS.hospitality] },
  salon: { moduleId: "salon", to: "/salon", icon: Sparkle, label: "Salon & Spa", permissions: [...MODULE_ACCESS_PERMISSIONS.salon] },
};

interface SidebarProps {
  onCommandOpen: () => void;
  mobile?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ onCommandOpen, mobile = false, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const user = useAuthStore((state) => state.user);
  const activeModuleId = useActiveModule((state) => state.active);
  const loadModule = useActiveModule((state) => state.load);
  const activeModule = MODULE_DEFINITIONS[activeModuleId];
  useEntitlements((state) => state.modules);

  useEffect(() => {
    if (!useActiveModule.getState().loaded) {
      void loadModule().catch(() => undefined);
    }
  }, [loadModule]);

  const moduleEntry = activeModuleId !== "core" ? MODULE_NAV_ENTRIES[activeModuleId] : undefined;
  const countryCode = useCountry((state) => state.code);
  const activeModuleEntry =
    moduleEntry && activeModuleId === "dawa"
      ? { ...moduleEntry, label: pharmacyTerm(countryCode) }
      : moduleEntry;
  const effectiveCollapsed = mobile ? false : collapsed;

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
  const insertIndex = visibleCore.findIndex((item) => item.to === "/pos") + 1;
  const before = visibleCore.slice(0, insertIndex || visibleCore.length);
  const after = visibleCore.slice(insertIndex || visibleCore.length);

  return (
    <aside
      className={cn(
        "flex h-full flex-col glass-sidebar motion-reduce:transition-none",
        mobile
          ? "w-full pb-[env(safe-area-inset-bottom)]"
          : "transition-[width] duration-200",
        !mobile && (effectiveCollapsed ? "w-[52px]" : "w-[200px]"),
      )}
    >
      <div className="flex min-h-12 items-center gap-2 border-b border-border/60 px-3 pt-[env(safe-area-inset-top)]">
        {activeModule && activeModule.id !== "core" ? (
          <ModuleLogo moduleId={activeModule.id} size={22} rounded />
        ) : (
          <OmnixLogo size={22} />
        )}
        {!effectiveCollapsed ? (
          <div className="min-w-0 flex-1">
            <div
              style={{ fontFamily: "var(--font-display, serif)" }}
              className="flex items-center gap-1 text-[16px] font-medium leading-tight tracking-[-0.01em]"
            >
              {activeModule && activeModule.id !== "core" ? activeModule.shortName : APP_NAME}
            </div>
            {activeModule && activeModule.id !== "core" ? (
              <div className="mt-1 font-mono text-[9px] uppercase leading-tight tracking-[0.18em] text-muted-foreground">
                {POWERED_BY}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {!effectiveCollapsed ? <ModuleSwitcher /> : null}

      <button
        type="button"
        onClick={onCommandOpen}
        data-tour="cmd-k"
        aria-label="Search (⌘K)"
        className={cn(
          "group mx-2 mt-2 flex items-center gap-2 rounded-md border border-border/60 bg-foreground/[0.02] py-0 text-[12px] text-muted-foreground transition-colors hover:border-border hover:bg-foreground/[0.04] hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 motion-reduce:transition-none",
          mobile ? "h-11 px-3" : "h-8",
          effectiveCollapsed ? "justify-center px-0" : "px-2",
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {!effectiveCollapsed ? (
          <>
            <span className="flex-1 text-left">Search</span>
            {!mobile ? (
              <kbd className="inline-flex h-[18px] items-center rounded-[4px] border border-border/60 bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground group-hover:text-foreground">
                ⌘K
              </kbd>
            ) : null}
          </>
        ) : null}
      </button>

      <nav className="mt-2 flex min-h-0 flex-1 flex-col px-2" aria-label="Primary navigation">
        <div className="-mx-1 space-y-0.5 overflow-auto px-1 pb-2">
          {before.map((item) => (
            <NavRow key={item.to} item={item} collapsed={effectiveCollapsed} mobile={mobile} onNavigate={onNavigate} />
          ))}
          {activeModuleEntry && showModuleEntry ? (
            <NavRow item={activeModuleEntry} collapsed={effectiveCollapsed} mobile={mobile} onNavigate={onNavigate} />
          ) : null}
          {after.map((item) => (
            <NavRow key={item.to} item={item} collapsed={effectiveCollapsed} mobile={mobile} onNavigate={onNavigate} />
          ))}
        </div>

        {itemVisible(SETTINGS_NAV) ? (
          <div className="mt-auto border-t border-border/40 pt-2">
            <NavRow item={SETTINGS_NAV} collapsed={effectiveCollapsed} mobile={mobile} onNavigate={onNavigate} />
          </div>
        ) : null}
      </nav>

      {!mobile ? (
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-10 items-center justify-center border-t border-border/60 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      ) : null}
    </aside>
  );
}

interface NavRowProps {
  item: NavItem;
  collapsed: boolean;
  mobile: boolean;
  onNavigate?: () => void;
}

function NavRow({ item, collapsed, mobile, onNavigate }: NavRowProps) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      title={collapsed ? item.label : undefined}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-2 rounded-md px-2 text-[13px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 motion-reduce:transition-none",
          mobile ? "min-h-11" : "py-1.5",
          isActive
            ? "bg-foreground/[0.06] font-medium text-foreground"
            : "text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground",
          collapsed && "justify-center",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && !collapsed ? <span aria-hidden className="absolute bottom-1.5 left-0 top-1.5 w-[2px] rounded-r-full bg-primary" /> : null}
          {item.moduleId ? (
            <ModuleLogo moduleId={item.moduleId} size={18} rounded className="shrink-0" />
          ) : (
            <item.icon className="h-4 w-4 shrink-0" />
          )}
          {!collapsed ? <span>{item.label}</span> : null}
        </>
      )}
    </NavLink>
  );
}

