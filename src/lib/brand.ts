/**
 * Brand Configuration — Single source of truth for product naming.
 *
 * The product name is now variant-aware (Pro = "Omnix", trade variants =
 * "Omnix Dawa" / "Omnix Retail" / "Omnix Hospitality" / "Omnix Hardware").
 * The variant is fixed at build time via VITE_OMNIX_VARIANT and read from
 * `@/lib/variant`.
 *
 * Note: To update OS-level metadata (window title, installer text,
 * exe filename, executable identifier), also update:
 *  - src-tauri/tauri.conf.json (Pro)
 *  - src-tauri/tauri.{dawa,retail,hospitality,hardware}.conf.json
 *  - src-tauri/Cargo.toml
 *  - .github/workflows/*.yml
 *  - docs/*.md, README.md
 */

import {
  VARIANT,
  VARIANT_NAME,
  VARIANT_TAGLINE,
  VARIANT_ACCENT,
  IS_PRO,
  LOCKED_MODULE,
  MODULES_ALLOWED,
} from "./variant";

export const BRAND = {
  /** Variant-aware product name. Pro = "Omnix"; trade variants = "Omnix Dawa", etc. */
  name: VARIANT_NAME,
  shortName: VARIANT_NAME,
  tagline: VARIANT_TAGLINE,

  /** Always "Omnix" — the parent brand, used for 'Powered by' captions
   *  where the trade-variant name would be redundant with the module label. */
  parentBrand: "Omnix",

  /** Build-time variant identifier. */
  variant: VARIANT,
  isPro: IS_PRO,
  accent: VARIANT_ACCENT,
  lockedModule: LOCKED_MODULE,
  modulesAllowed: MODULES_ALLOWED,

  /**
   * First module (active vertical). For trade variants this is the locked
   * module; for Pro it stays "dawa" as the default until the user picks one.
   */
  module: {
    name: "Dawa",
    fullName: "Dawa Pharmacy",
    description: "Pharmacy management module for Omnix",
  },

  /** Company / publisher information. */
  company: {
    name: "Omnix Ltd.",
    domain: "omnix.co.ke",
    website: "https://omnix.co.ke",
    supportEmail: "support@omnix.co.ke",
  },

  /** Receipt header — always the parent brand ('Powered by Omnix') so it
   *  doesn't repeat the trade-variant name that's already on the header. */
  receipt: {
    poweredBy: "Powered by Omnix",
  },

  /** Updater / installer naming. */
  installer: {
    appNameInPath: IS_PRO ? "omnix" : `omnix-${VARIANT}`,
  },
} as const;

// Convenience re-exports for the most-used values
export const APP_NAME = BRAND.name;
/** Always 'Powered by Omnix' — see BRAND.parentBrand rationale. */
export const POWERED_BY = `Powered by ${BRAND.parentBrand}`;
export const APP_TAGLINE = BRAND.tagline;
export const COMPANY_DOMAIN = BRAND.company.domain;
export const SUPPORT_EMAIL = BRAND.company.supportEmail;
export const MODULE_NAME = BRAND.module.name;
