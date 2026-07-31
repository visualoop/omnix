import type { ModuleId } from "@/stores/active-module";
import { androidLocalPathname } from "@/platform/android-contract";
import type { OperationalContext } from "@/platform/operational-context";

export interface RouteCapability {
  readonly desktop: boolean;
  readonly android: "full" | "read" | "hidden";
  readonly web: "read" | "hidden";
  readonly requiresHub: boolean;
  readonly permissions: readonly string[];
  readonly modules?: readonly string[];
}

export type MobileNavigationSection =
  | "home"
  | "sell"
  | "stock"
  | "people"
  | "finance"
  | "reports"
  | "module"
  | "account";

export interface MobileRouteDefinition {
  readonly id: string;
  readonly label: string;
  readonly path: string;
  readonly section: MobileNavigationSection;
  readonly capability: RouteCapability;
  readonly permissionMode?: "any" | "all";
}

export interface ResolveAndroidNavigationInput {
  readonly context: OperationalContext;
  readonly activeModules: readonly ModuleId[];
  readonly hubAvailable: boolean;
}

export interface ResolvedMobileRoute extends MobileRouteDefinition {
  readonly access: "full" | "read";
}

function capability(
  permissions: readonly string[] = [],
  modules?: readonly ModuleId[],
  requiresHub = true,
): RouteCapability {
  return {
    desktop: true,
    android: "full",
    web: "hidden",
    requiresHub,
    permissions,
    modules,
  };
}

export const ANDROID_MOBILE_ROUTES: readonly MobileRouteDefinition[] = [
  { id: "home", label: "Home", path: "/mobile", section: "home", capability: capability([], undefined, false) },
  { id: "pos", label: "Sell", path: "/pos/sale", section: "sell", capability: capability(["pos.use"]) },
  { id: "sales", label: "Sales", path: "/sales", section: "sell", capability: capability(["sales.view"]) },
  { id: "returns", label: "Returns", path: "/returns", section: "sell", capability: capability(["sales.refund"]) },
  { id: "inventory", label: "Inventory", path: "/inventory", section: "stock", capability: capability(["inventory.view"]) },
  { id: "stock-take", label: "Stock take", path: "/stock-take", section: "stock", capability: capability(["stock_take.use"]) },
  { id: "stock-transfers", label: "Stock transfers", path: "/stock-transfers", section: "stock", capability: capability(["inventory.view"]) },
  { id: "customers", label: "Customers", path: "/customers", section: "people", capability: capability(["customers.view"]) },
  { id: "suppliers", label: "Suppliers", path: "/suppliers", section: "people", capability: capability(["suppliers.view"]) },
  { id: "purchasing", label: "Purchasing", path: "/purchase-orders", section: "stock", capability: capability(["purchase_orders.view", "purchase_orders.create", "purchase_orders.receive"]) },
  { id: "people", label: "People", path: "/people", section: "people", capability: capability(["hr.employees.view", "hr.attendance.view", "hr.leave.request", "hr.payroll.view"]) },
  { id: "invoicing", label: "Invoicing", path: "/invoicing", section: "finance", capability: capability(["invoicing.view", "invoicing.create"]) },
  { id: "banking", label: "Banking", path: "/banking", section: "finance", capability: capability(["banking.view", "petty_cash.use", "expenses.view"]) },
  { id: "cash-register", label: "Cash register", path: "/cash-register", section: "finance", capability: capability(["cash_register.use"]) },
  { id: "approvals", label: "Approvals", path: "/approvals", section: "finance", capability: capability([]) },
  { id: "analytics", label: "Reports", path: "/analytics", section: "reports", capability: capability(["reports.view", "reports.pnl", "reports.zreport", "etims.view"]) },
  { id: "pharmacy", label: "Pharmacy", path: "/pharmacy", section: "module", capability: capability(["pharmacy.access", "pharmacy.dispense", "pharmacy.refill", "claims.view"], ["dawa"]) },
  { id: "retail", label: "Retail", path: "/retail", section: "module", capability: capability(["retail.access", "retail.laybys.use", "retail.special_orders.use"], ["retail"]) },
  { id: "hardware", label: "Hardware", path: "/hardware", section: "module", capability: capability(["hardware.access", "hardware.quotations.manage", "hardware.delivery_notes.manage"], ["hardware"]) },
  { id: "hospitality", label: "Hospitality", path: "/hospitality", section: "module", capability: capability(["hospitality.access", "hospitality.orders.take", "hospitality.bookings.manage"], ["hospitality"]) },
  { id: "salon", label: "Salon & Spa", path: "/salon", section: "module", capability: capability(["salon.access", "salon.appointments.manage"], ["salon"]) },
  { id: "notifications", label: "Alerts", path: "/notifications", section: "account", capability: capability([], undefined, false) },
  { id: "profile", label: "Profile", path: "/mobile/profile", section: "account", capability: capability([], undefined, false) },
] as const;

export const ANDROID_PRIMARY_ROUTE_IDS = [
  "home",
  "pos",
  "inventory",
  "notifications",
  "profile",
] as const;

function hasRequiredPermission(
  route: MobileRouteDefinition,
  granted: ReadonlySet<string>,
): boolean {
  const required = route.capability.permissions;
  if (required.length === 0) return true;
  return route.permissionMode === "all"
    ? required.every((permission) => granted.has(permission))
    : required.some((permission) => granted.has(permission));
}

function hasRequiredModule(
  route: MobileRouteDefinition,
  activeModules: ReadonlySet<string>,
): boolean {
  const modules = route.capability.modules;
  return !modules || modules.some((module) => activeModules.has(module));
}

function isBusinessSettingsPath(path: string): boolean {
  const pathname = androidLocalPathname(path, "Android route path").toLowerCase();
  return pathname === "/settings" || pathname.startsWith("/settings/");
}

export function resolveAndroidNavigation(
  routes: readonly MobileRouteDefinition[],
  input: ResolveAndroidNavigationInput,
): ResolvedMobileRoute[] {
  const permissions = new Set(input.context.permissions);
  const modules = new Set<string>(input.activeModules);
  const routeIds = new Set<string>();

  return routes.flatMap((route): ResolvedMobileRoute[] => {
    if (routeIds.has(route.id)) {
      throw new Error(`Duplicate Android route id: ${route.id}`);
    }
    routeIds.add(route.id);
    if (isBusinessSettingsPath(route.path)) return [];
    if (route.capability.android === "hidden") return [];
    if (route.capability.requiresHub && !input.hubAvailable) return [];
    if (!hasRequiredPermission(route, permissions)) return [];
    if (!hasRequiredModule(route, modules)) return [];

    const access =
      input.context.scope.kind === "all-branches"
        ? "read"
        : route.capability.android;

    return [{ ...route, access }];
  });
}

export function primaryAndroidNavigation(
  routes: readonly ResolvedMobileRoute[],
): ResolvedMobileRoute[] {
  const primary = new Set<string>(ANDROID_PRIMARY_ROUTE_IDS);
  return routes.filter((route) => primary.has(route.id));
}
