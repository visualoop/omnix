/**
 * Module feature registry — single source of truth for which features belong
 * to which vertical module. Used by sidebar, command palette, route guards,
 * and module-aware UI to gate features.
 *
 * Adding a new feature:
 *   1. Pick the right module bucket below (core | dawa | retail | ...)
 *   2. Add the route path
 *   3. Sidebar / palette / route guards pick it up automatically
 *
 * Architecture:
 *   - "core" features ALWAYS show regardless of active module
 *   - Module-specific features ONLY show when their module is active
 *   - A route NOT registered here is treated as "core" (always available)
 */

import type { ModuleId } from "@/stores/active-module";

/**
 * Map of route path → owning module.
 * If a route is not in this map, it's a core feature available in all modules.
 */
const FEATURE_OWNERS: Record<string, Exclude<ModuleId, "core">> = {
  // ─── Dawa (Pharmacy) ─────────────────────────────────────
  "/pharmacy": "dawa",
  "/pharmacy/expiry": "dawa",
  "/pharmacy/doctors": "dawa",
  "/pharmacy/refills": "dawa",
  "/pharmacy/controlled-register": "dawa",
  "/pharmacy/cold-chain": "dawa",
  "/pharmacy/amr": "dawa",
  "/claims": "dawa",
  "/patients": "dawa",
  "/settings/insurance": "dawa",

  // ─── Omnix Retail ────────────────────────────────────────
  "/retail/brands": "retail",
  "/retail/laybys": "retail",
  "/retail/special-orders": "retail",
  "/retail/shrinkage": "retail",
  "/retail/dashboard": "retail",

  // ─── Hardware & Building Materials ──────────────────────
  "/hardware/dashboard": "hardware",
  "/hardware/quotations": "hardware",
  "/hardware/delivery-notes": "hardware",
  "/hardware/accounts": "hardware",
  "/hardware/commissions": "hardware",
  "/hardware/reports": "hardware",
  "/settings/hardware/pricing": "hardware",
  "/settings/hardware/units": "hardware",
  "/settings/hardware/credit": "hardware",
  "/settings/hardware/commissions": "hardware",

  // ─── Hospitality (restaurant + hotel) ───────────────────
  "/hospitality/dashboard": "hospitality",
  "/hospitality/tables": "hospitality",
  "/hospitality/orders": "hospitality",
  "/hospitality/kitchen": "hospitality",
  "/hospitality/menu": "hospitality",
  "/hospitality/recipes": "hospitality",
  "/hospitality/bookings": "hospitality",
  "/hospitality/rooms": "hospitality",
  "/hospitality/checkin": "hospitality",
  "/hospitality/housekeeping": "hospitality",
  "/hospitality/folios": "hospitality",
  "/hospitality/wastage": "hospitality",
  "/hospitality/reports": "hospitality",
  "/settings/hospitality/tables": "hospitality",
  "/settings/hospitality/menu": "hospitality",
  "/settings/hospitality/service-charge": "hospitality",

  // Salon & Spa
  "/salon": "salon",
  "/salon/appointments": "salon",
  "/salon/services": "salon",
  "/salon/staff": "salon",
  "/salon/clients": "salon",
  "/salon/packages": "salon",
  "/salon/reports": "salon",
};

/**
 * Returns the owning module for a route path, or undefined for core features.
 * Matches by exact path or path prefix (e.g., "/pharmacy/foo" matches "/pharmacy").
 */
export function getFeatureModule(path: string): Exclude<ModuleId, "core"> | undefined {
  // Exact match first
  if (FEATURE_OWNERS[path]) return FEATURE_OWNERS[path];

  // Prefix match (e.g., "/pharmacy/foo/bar" → "/pharmacy")
  for (const [registered, module] of Object.entries(FEATURE_OWNERS)) {
    if (path.startsWith(registered + "/") || path === registered) {
      return module;
    }
  }

  return undefined;
}

/**
 * Returns true if a feature should be visible given the currently active module.
 * Core features (no owner) are always visible.
 */
export function isFeatureAvailable(path: string, activeModule: ModuleId): boolean {
  const owner = getFeatureModule(path);
  if (!owner) return true; // core feature
  return owner === activeModule;
}

/**
 * Filter an array of items (sidebar nav, palette pages, etc.) by their `to` field.
 */
export function filterByActiveModule<T extends { to: string }>(
  items: T[],
  activeModule: ModuleId,
): T[] {
  return items.filter((item) => isFeatureAvailable(item.to, activeModule));
}

/** Returns all paths registered for a specific module (for testing / docs). */
export function getModuleFeatures(module: Exclude<ModuleId, "core">): string[] {
  return Object.entries(FEATURE_OWNERS)
    .filter(([, owner]) => owner === module)
    .map(([path]) => path);
}
