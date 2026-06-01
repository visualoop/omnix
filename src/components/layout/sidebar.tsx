import { useEffect, useState } from "react";
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
  ChevronDown,
  ChevronRight,
  Search,
  FileCheck,
  Shield,
  Receipt,
  FileText,
  Banknote,
  Truck,
  Users,
  ClipboardCheck,
  RotateCcw,
  ArrowRightLeft,
  Clock,
  Plane,
  Wallet,
  Tag,
  CalendarClock,
  CalendarPlus,
  AlertTriangle,
  TrendingUp,
  Wrench,
  UtensilsCrossed,
  LayoutGrid,
  BookOpen,
  ChefHat,
  BedDouble,
  Sparkles,
  ShoppingBag,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { OmnixLogo } from "@/components/omnix-logo";
import { ModuleLogo } from "@/components/module-logos";
import { APP_NAME } from "@/lib/brand";
import { useAuthStore } from "@/stores/auth";
import { useActiveModule, MODULE_DEFINITIONS, type ModuleId } from "@/stores/active-module";
import { hasAnyPermission, type Permission } from "@/lib/permissions";
import { isFeatureAvailable, getFeatureModule } from "@/lib/module-features";
import { isModuleEntitled } from "@/stores/entitlements";
import { useEntitlements } from "@/stores/entitlements";

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  /** Show this item only if user has at least one of these permissions. Empty = always show. */
  permissions: Permission[];
}

interface ModuleNavGroup {
  id: ModuleId;
  icon: typeof LayoutDashboard;
  label: string;
  items: NavItem[];
}

/**
 * Core nav — every install sees these (gated only by permissions).
 * Module-specific items live in MODULE_GROUPS below and only appear
 * inside the collapsible group for the active module.
 */
const CORE_NAV: NavItem[] = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", permissions: [] },
  { to: "/pos", icon: ShoppingCart, label: "POS", permissions: ["pos.use"] },
  { to: "/sales", icon: Receipt, label: "Sales", permissions: ["sales.view"] },
  { to: "/returns", icon: RotateCcw, label: "Returns", permissions: ["sales.refund"] },
  { to: "/inventory", icon: Package, label: "Inventory", permissions: ["inventory.view"] },
  { to: "/stock-transfers", icon: ArrowRightLeft, label: "Transfers", permissions: ["inventory.view"] },
  { to: "/purchase-orders", icon: Truck, label: "Purchases", permissions: ["purchase_orders.view"] },
  { to: "/stock-take", icon: ClipboardCheck, label: "Stock Take", permissions: ["stock_take.use"] },
  { to: "/suppliers", icon: Truck, label: "Suppliers", permissions: ["suppliers.view"] },
  { to: "/customers", icon: Users, label: "Customers", permissions: ["customers.view"] },
  { to: "/invoicing", icon: FileText, label: "Invoicing", permissions: ["invoicing.view"] },
  { to: "/banking", icon: Banknote, label: "Banking", permissions: ["banking.view"] },
  { to: "/expenses", icon: Wallet, label: "Expenses", permissions: ["expenses.view"] },
  { to: "/pnl", icon: TrendingUp, label: "P&L", permissions: ["reports.pnl"] },
  { to: "/hr/employees", icon: Users, label: "Employees", permissions: ["hr.employees.view"] },
  { to: "/hr/attendance", icon: Clock, label: "Attendance", permissions: ["hr.attendance.view","hr.attendance.record"] },
  { to: "/hr/leave", icon: Plane, label: "Leave", permissions: ["hr.leave.request","hr.leave.approve"] },
  { to: "/hr/payroll", icon: Wallet, label: "Payroll", permissions: ["hr.payroll.view"] },
  { to: "/petty-cash", icon: Receipt, label: "Petty Cash", permissions: ["petty_cash.use"] },
  { to: "/cash-register", icon: Banknote, label: "Cash Register", permissions: ["cash_register.use"] },
  { to: "/promotions", icon: Tag, label: "Promotions", permissions: ["promotions.manage"] },
  { to: "/reports", icon: BarChart3, label: "Reports", permissions: ["reports.view", "reports.zreport"] },
  { to: "/reports/daily-operations", icon: BarChart3, label: "Daily Ops", permissions: ["reports.view"] },
  { to: "/vat-report", icon: FileCheck, label: "VAT Report", permissions: ["reports.view"] },
  { to: "/etims", icon: FileCheck, label: "eTIMS", permissions: ["etims.view"] },
];

/**
 * Module-specific groups. The sidebar shows ONLY the active module's group
 * (collapsed by default; auto-expands when on one of its sub-routes).
 * Pharmacy/Retail/Hardware/Hospitality each become a single line that opens
 * to reveal the module's screens — same pattern as Settings.
 */
const MODULE_GROUPS: Partial<Record<ModuleId, ModuleNavGroup>> = {
  dawa: {
    id: "dawa",
    icon: Pill,
    label: "Pharmacy",
    items: [
      { to: "/pharmacy", icon: Pill, label: "Dispensing", permissions: ["pharmacy.dispense"] },
      { to: "/claims", icon: Shield, label: "Insurance Claims", permissions: ["claims.view"] },
    ],
  },
  retail: {
    id: "retail",
    icon: ShoppingBag,
    label: "Retail",
    items: [
      { to: "/retail/dashboard", icon: TrendingUp, label: "Insights", permissions: ["reports.view"] },
      { to: "/retail/brands", icon: Tag, label: "Brands", permissions: ["retail.brands.manage"] },
      { to: "/retail/laybys", icon: CalendarClock, label: "Laybys", permissions: ["retail.laybys.use"] },
      { to: "/retail/special-orders", icon: CalendarPlus, label: "Special Orders", permissions: ["retail.special_orders.use"] },
      { to: "/retail/shrinkage", icon: AlertTriangle, label: "Shrinkage", permissions: ["retail.shrinkage.record"] },
    ],
  },
  hardware: {
    id: "hardware",
    icon: Wrench,
    label: "Hardware",
    items: [
      { to: "/hardware/dashboard", icon: LayoutDashboard, label: "Overview", permissions: ["hardware.reports.view"] },
      { to: "/hardware/quotations", icon: FileText, label: "Quotations", permissions: ["hardware.quotations.manage"] },
      { to: "/hardware/delivery-notes", icon: Truck, label: "Delivery Notes", permissions: ["hardware.delivery_notes.manage"] },
      { to: "/hardware/accounts", icon: Users, label: "Accounts", permissions: ["hardware.accounts.manage"] },
      { to: "/hardware/commissions", icon: Tag, label: "Commissions", permissions: ["hardware.commissions.view"] },
      { to: "/hardware/reports", icon: BarChart3, label: "Reports", permissions: ["hardware.reports.view"] },
    ],
  },
  hospitality: {
    id: "hospitality",
    icon: UtensilsCrossed,
    label: "Hospitality",
    items: [
      { to: "/hospitality/dashboard", icon: LayoutDashboard, label: "Overview", permissions: ["hospitality.reports.view"] },
      { to: "/hospitality/tables", icon: LayoutGrid, label: "Tables", permissions: ["hospitality.tables.manage"] },
      { to: "/hospitality/orders", icon: Receipt, label: "Orders", permissions: ["hospitality.orders.take"] },
      { to: "/hospitality/kitchen", icon: ChefHat, label: "Kitchen", permissions: ["hospitality.kitchen.bump"] },
      { to: "/hospitality/menu", icon: BookOpen, label: "Menu", permissions: ["hospitality.menu.manage"] },
      { to: "/hospitality/rooms", icon: BedDouble, label: "Rooms", permissions: ["hospitality.bookings.manage"] },
      { to: "/hospitality/bookings", icon: CalendarClock, label: "Bookings", permissions: ["hospitality.bookings.manage"] },
      { to: "/hospitality/housekeeping", icon: Sparkles, label: "Housekeeping", permissions: ["hospitality.housekeeping.manage"] },
      { to: "/hospitality/folios", icon: FileText, label: "Folios", permissions: ["hospitality.folios.manage"] },
      { to: "/hospitality/recipes", icon: ClipboardCheck, label: "Recipes", permissions: ["hospitality.recipes.manage"] },
      { to: "/hospitality/reports", icon: BarChart3, label: "Reports", permissions: ["hospitality.reports.view"] },
    ],
  },
};

/** Where the active-module group renders within CORE_NAV (after this index). */
const MODULE_GROUP_INSERT_AFTER = "/pos";

export function Sidebar({ onCommandOpen }: { onCommandOpen: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
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

  // Module group for the active vertical (none for core).
  const activeGroup =
    activeModuleId !== "core" ? MODULE_GROUPS[activeModuleId] : undefined;

  // Auto-expand the group when the user is on one of its sub-routes.
  const onModuleSubRoute =
    activeGroup?.items.some((i) => location.pathname.startsWith(i.to)) ?? false;
  const [groupOpen, setGroupOpen] = useState<boolean>(onModuleSubRoute);
  // Re-expand whenever the user navigates into a module sub-route.
  useEffect(() => {
    if (onModuleSubRoute) setGroupOpen(true);
  }, [onModuleSubRoute]);

  const itemVisible = (item: NavItem) => {
    const owner = getFeatureModule(item.to);
    if (owner && !isModuleEntitled(owner)) return false;
    return (
      (item.permissions.length === 0 || hasAnyPermission(user, item.permissions)) &&
      isFeatureAvailable(item.to, activeModuleId)
    );
  };

  const visibleCore = CORE_NAV.filter(itemVisible);
  const visibleGroupItems = activeGroup
    ? activeGroup.items.filter(
        (i) =>
          i.permissions.length === 0 || hasAnyPermission(user, i.permissions),
      )
    : [];

  const insertIdx =
    visibleCore.findIndex((i) => i.to === MODULE_GROUP_INSERT_AFTER) + 1;
  const before = visibleCore.slice(0, insertIdx || visibleCore.length);
  const after = visibleCore.slice(insertIdx || visibleCore.length);

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-sidebar h-full transition-all duration-200",
        collapsed ? "w-[52px]" : "w-[200px]",
      )}
    >
      {/* Logo + Active Module */}
      <div className="flex items-center h-12 px-3 border-b border-border gap-2">
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
          "mx-2 mt-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors cursor-pointer",
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

        {/* Active-module group (single expandable entry) */}
        {activeGroup && visibleGroupItems.length > 0 && (
          <ModuleGroup
            group={{ ...activeGroup, items: visibleGroupItems }}
            collapsed={collapsed}
            open={groupOpen}
            onToggle={() => setGroupOpen((v) => !v)}
            currentPath={location.pathname}
          />
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
        className="flex items-center justify-center h-10 border-t border-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
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
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer",
          isActive
            ? "bg-accent text-accent-foreground font-medium"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          collapsed && "justify-center",
        )
      }
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  );
}

function ModuleGroup({
  group,
  collapsed,
  open,
  onToggle,
  currentPath,
}: {
  group: ModuleNavGroup;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
  currentPath: string;
}) {
  const Icon = group.icon;
  const onSubRoute = group.items.some((i) => currentPath.startsWith(i.to));

  // Collapsed sidebar: show ONE icon row that links to the module's first item.
  // Expanding the sub-list when the whole sidebar is collapsed would look broken.
  if (collapsed) {
    return (
      <NavLink
        to={group.items[0].to}
        title={group.label}
        className={({ isActive }) =>
          cn(
            "flex items-center justify-center rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer",
            isActive || onSubRoute
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )
        }
      >
        <Icon className="h-4 w-4 shrink-0" />
      </NavLink>
    );
  }

  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer",
          onSubRoute
            ? "text-foreground font-medium"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
      </button>
      {open && (
        <div className="mt-0.5 ml-2 pl-2 border-l border-border space-y-0.5">
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors cursor-pointer",
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )
              }
            >
              <item.icon className="h-3.5 w-3.5 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
