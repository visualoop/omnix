/**
 * Brand Configuration — Single source of truth for product naming.
 *
 * To rebrand the application, edit the values here. All UI, receipts,
 * notifications, etc. import from this file.
 *
 * Note: To update OS-level metadata (window title, installer text,
 * exe filename, executable identifier), also update:
 *  - src-tauri/tauri.conf.json
 *  - src-tauri/Cargo.toml
 *  - .github/workflows/*.yml
 *  - docs/*.md, README.md
 */

export const BRAND = {
  // Platform name (the OS-level product)
  name: "SokoOS",
  shortName: "Soko",
  tagline: "ERP for Kenyan SMEs",

  // First module (active vertical). When you add new modules, you may want
  // to make the active module name dynamic per tenant/setup.
  module: {
    name: "Dawa",
    fullName: "Dawa Pharmacy",
    description: "Pharmacy management module for SokoOS",
  },

  // Company / publisher information
  company: {
    name: "SokoOS Ltd.",
    domain: "sokoos.co.ke",
    website: "https://sokoos.co.ke",
    supportEmail: "support@sokoos.co.ke",
  },

  // Receipt header (override per tenant via setup wizard later if desired)
  receipt: {
    poweredBy: "Powered by SokoOS",
  },

  // Updater / installer naming
  installer: {
    appNameInPath: "sokoos", // Used in install path: %APPDATA%\sokoos
  },
} as const;

// Convenience re-exports for the most-used values
export const APP_NAME = BRAND.name;
export const APP_TAGLINE = BRAND.tagline;
export const COMPANY_DOMAIN = BRAND.company.domain;
export const SUPPORT_EMAIL = BRAND.company.supportEmail;
export const MODULE_NAME = BRAND.module.name;
