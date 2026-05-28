/**
 * Brand identity — single source of truth.
 *
 * To rebrand, edit BRAND_NAME and BRAND_DOMAIN here. Every UI string,
 * every metadata block, every page title imports from this file.
 *
 * Verify after rename:  grep -ri "Duka" src/ | grep -v lib/brand.ts
 * (should return zero matches)
 */

export const BRAND_NAME = 'Omnix' as const
export const BRAND_TAGLINE = 'ERP for Kenyan SMEs' as const
export const BRAND_DOMAIN = 'omnix.co.ke' as const

// License key prefix — also tied to brand. Format: OMNIX-XXXX-XXXX-XXXX.
export const LICENSE_KEY_PREFIX = 'OMNIX' as const

// Bundle identifier for the Tauri desktop app — must stay stable across
// rebrands (changing it breaks updater chain). Set once, never edit.
export const APP_IDENTIFIER = 'ke.co.sokoos.duka' as const

// Friendly label fragments
export const BRAND = {
  name: BRAND_NAME,
  tagline: BRAND_TAGLINE,
  domain: BRAND_DOMAIN,
  url: `https://${BRAND_DOMAIN}`,
  copyright: `© ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.`,
} as const
