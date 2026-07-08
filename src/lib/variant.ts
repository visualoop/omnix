/**
 * Variant — which Omnix product this binary is.
 *
 * Set at build time via `VITE_OMNIX_VARIANT` (one of: pro|dawa|retail|hospitality|hardware).
 * Default is `pro` so dev mode + legacy v0.3.x installs reproduce today's behaviour.
 *
 * Read this constant whenever you need to:
 *   - hide UI surface for trades the binary doesn't ship
 *   - bias the AI persona / starters per trade
 *   - render variant-specific brand strings, icons, accents
 *   - validate a license against the binary's variant
 *
 * The whole runtime contract lives here; everything else just consumes
 * the exported helpers.
 */

export const VARIANTS = ["pro", "dawa", "retail", "hospitality", "hardware"] as const;
export type Variant = (typeof VARIANTS)[number];

// Resolved at build time by vite.config.ts via `define`. The redundant
// fallbacks guarantee the literal string survives any minifier rewrite.
declare const __OMNIX_VARIANT__: string | undefined;
const RAW_VARIANT: string =
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  (typeof __OMNIX_VARIANT__ !== "undefined" && __OMNIX_VARIANT__) ||
  import.meta.env.VITE_OMNIX_VARIANT ||
  "pro";
const RAW = RAW_VARIANT.toLowerCase();
export const VARIANT: Variant = (VARIANTS as readonly string[]).includes(RAW)
  ? (RAW as Variant)
  : "pro";

/** True when this binary ships every trade module (legacy + multi-trade buyer). */
export const IS_PRO: boolean = VARIANT === "pro";

/**
 * Modules this variant is allowed to surface. Core is always allowed.
 *
 * Pro: all four trade modules + core
 * Trade variants: only the matching module + core
 */
export function modulesAllowedForVariant(v: Variant): readonly string[] {
  switch (v) {
    case "pro":
      return ["core", "dawa", "retail", "hospitality", "hardware"];
    case "dawa":
      return ["core", "dawa"];
    case "retail":
      return ["core", "retail"];
    case "hospitality":
      return ["core", "hospitality"];
    case "hardware":
      return ["core", "hardware"];
  }
}

export const MODULES_ALLOWED: readonly string[] = modulesAllowedForVariant(VARIANT);

/** Trade module locked to this variant, or null for Pro. */
export function lockedModuleForVariant(v: Variant): string | null {
  return v === "pro" ? null : v;
}

export const LOCKED_MODULE: string | null = lockedModuleForVariant(VARIANT);

/** Customer-facing product name. */
export function variantName(v: Variant): string {
  switch (v) {
    case "pro":
      return "Omnix";
    case "dawa":
      return "Omnix Dawa";
    case "retail":
      return "Omnix Retail";
    case "hospitality":
      return "Omnix Hospitality";
    case "hardware":
      return "Omnix Hardware & Equipment";
  }
}

export const VARIANT_NAME: string = variantName(VARIANT);

/** One-liner pitch shown on welcome screen + receipt footer. */
export function variantTagline(v: Variant): string {
  switch (v) {
    case "pro":
      return "ERP for Kenyan SMEs — every trade, one app";
    case "dawa":
      return "Pharmacy management for Kenyan chemists";
    case "retail":
      return "Retail POS + inventory for Kenyan shops";
    case "hospitality":
      return "Restaurant, bar & lodge POS for Kenya";
    case "hardware":
      return "Hardware & equipment: sales, quotes, credit, service & hire";
  }
}

export const VARIANT_TAGLINE: string = variantTagline(VARIANT);

/** Hex accent colour applied to logo, primary buttons, customer display. */
export function variantAccent(v: Variant): string {
  switch (v) {
    case "pro":
      return "#1e40af"; // navy
    case "dawa":
      return "#0d9488"; // teal
    case "retail":
      return "#d97706"; // amber
    case "hospitality":
      return "#10b981"; // emerald
    case "hardware":
      return "#ea580c"; // orange
  }
}

export const VARIANT_ACCENT: string = variantAccent(VARIANT);

/** License key prefix that signals this variant. Used for visual ID + server validation. */
export function variantLicensePrefix(v: Variant): string {
  switch (v) {
    case "pro":
      return "OMNIX-PRO";
    case "dawa":
      return "OMNIX-DAWA";
    case "retail":
      return "OMNIX-RETAIL";
    case "hospitality":
      return "OMNIX-HOSP";
    case "hardware":
      return "OMNIX-HW";
  }
}

export const LICENSE_PREFIX: string = variantLicensePrefix(VARIANT);

/** All known prefixes, ordered specific → generic for parsing. */
export const ALL_LICENSE_PREFIXES = [
  "OMNIX-DAWA",
  "OMNIX-RETAIL",
  "OMNIX-HOSP",
  "OMNIX-HW",
  "OMNIX-PRO",
] as const;

/** Parse the variant out of a license key by its prefix. Returns null if unprefixed (legacy). */
export function variantFromLicenseKey(key: string): Variant | null {
  const upper = key.trim().toUpperCase();
  if (upper.startsWith("OMNIX-DAWA")) return "dawa";
  if (upper.startsWith("OMNIX-RETAIL")) return "retail";
  if (upper.startsWith("OMNIX-HOSP")) return "hospitality";
  if (upper.startsWith("OMNIX-HW")) return "hardware";
  if (upper.startsWith("OMNIX-PRO")) return "pro";
  return null;
}

/**
 * Does a license belong to this binary?
 *   - Pro binary: accepts any variant (Pro is the multi-trade tier)
 *   - Trade binary: accepts only its matching variant
 *   - Unprefixed legacy keys: treated as Pro (so v0.3.x customers keep working)
 */
export function isLicenseCompatible(licenseKey: string, licenseVariant?: Variant | null): boolean {
  if (IS_PRO) return true;
  const v = licenseVariant ?? variantFromLicenseKey(licenseKey) ?? "pro";
  return v === VARIANT;
}
