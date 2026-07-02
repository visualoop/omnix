/**
 * Entitlements store — the synchronous source of truth for which modules the
 * active license/trial unlocks. Hydrated once at boot from getLicenseStatus()
 * (pushed in by LicenseGuard so we don't double-call the license service).
 *
 * Core is never gated. When VITE_SKIP_LICENSE=1 (dev), everything is unlocked.
 *
 * v0.35.2 fix: on a variant-specific installer (Retail / Dawa / Hardware /
 * Hospitality), the binary itself is proof of purchase for that trade. The
 * user paid for the retail installer → retail must always be entitled on
 * this binary, even if the entitlements store hasn't hydrated yet (fresh
 * activation, licence-guard mid-flight, offline first-boot).
 */
import { create } from "zustand";
import { LOCKED_MODULE } from "@/lib/variant";

const SKIP_LICENSE = import.meta.env.VITE_SKIP_LICENSE === "1";

/** All sellable verticals. Used to grant "all" in dev skip-license mode. */
export const ALL_MODULES = ["dawa", "retail", "hardware", "hospitality"] as const;

interface EntitlementsStore {
  modules: string[];
  loaded: boolean;
  setModules: (modules: string[]) => void;
}

export const useEntitlements = create<EntitlementsStore>((set) => ({
  modules: SKIP_LICENSE ? [...ALL_MODULES] : [],
  loaded: SKIP_LICENSE,
  setModules: (modules) => set({ modules, loaded: true }),
}));

/** Synchronous gate: is a module unlocked by the current license/trial? Core is always true. */
export function isModuleEntitled(moduleId: string): boolean {
  if (moduleId === "core") return true;
  if (SKIP_LICENSE) return true;
  // The binary itself is proof of purchase for its own trade module.
  // A user running Omnix Retail bought Retail — retail routes must never
  // be gated on this binary, even if the entitlements store is still
  // hydrating or a stale singleton row said otherwise.
  if (LOCKED_MODULE && moduleId === LOCKED_MODULE) return true;
  return useEntitlements.getState().modules.includes(moduleId);
}

/** Licensed verticals (excludes core). */
export function entitledModules(): string[] {
  if (SKIP_LICENSE) return [...ALL_MODULES];
  const stored = useEntitlements.getState().modules;
  // Ensure the binary's own trade module is always represented for
  // variant installers, so sidebar / nav / hub tabs stay consistent
  // with what the user is running.
  if (LOCKED_MODULE && !stored.includes(LOCKED_MODULE)) {
    return [LOCKED_MODULE, ...stored];
  }
  return stored;
}
