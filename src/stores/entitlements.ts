/**
 * Entitlements store — the synchronous source of truth for which modules the
 * active license/trial unlocks. Hydrated once at boot from getLicenseStatus()
 * (pushed in by LicenseGuard so we don't double-call the license service).
 *
 * Core is never gated. When VITE_SKIP_LICENSE=1 (dev), everything is unlocked.
 */
import { create } from "zustand";

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
  return useEntitlements.getState().modules.includes(moduleId);
}

/** Licensed verticals (excludes core). */
export function entitledModules(): string[] {
  if (SKIP_LICENSE) return [...ALL_MODULES];
  return useEntitlements.getState().modules;
}
