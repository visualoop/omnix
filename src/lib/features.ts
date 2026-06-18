/**
 * Country-specific feature gates.
 *
 * Some Omnix features only make sense in specific countries:
 *   - eTIMS: Kenya only (KRA's tax invoice signing)
 *   - SHA / NHIF claims: Kenya only
 *   - M-Pesa STK: Kenya, Tanzania, Uganda, DRC
 *   - KRA PIN field: Kenya only
 *   - F&B Levy: Kenya only
 *   - PPB controlled register: Kenya only
 *
 * Centralized so the desktop app can hide routes, sidebar links,
 * settings pages, and form fields for visitors outside the
 * country those features apply to.
 */
import { useCountry } from "@/stores/country";
import { getCountry, type ComplianceFeature } from "@/lib/countries";

/** Synchronous read — uses Zustand state directly. */
export function isFeatureEnabled(feature: ComplianceFeature): boolean {
  const code = useCountry.getState().code;
  if (!code) return false;
  const profile = getCountry(code);
  return profile?.complianceFeatures.includes(feature) ?? false;
}

/** React-friendly selector (re-renders when country changes). */
export function useFeatureEnabled(feature: ComplianceFeature): boolean {
  const code = useCountry((s) => s.code);
  if (!code) return false;
  const profile = getCountry(code);
  return profile?.complianceFeatures.includes(feature) ?? false;
}

/**
 * Convenience predicate — true when the active country is Kenya.
 * Many features are effectively KE-only and this is a clearer
 * intent expression than checking individual ComplianceFeatures.
 */
export function isKenya(): boolean {
  return useCountry.getState().code === "KE";
}

export function useIsKenya(): boolean {
  return useCountry((s) => s.code) === "KE";
}
