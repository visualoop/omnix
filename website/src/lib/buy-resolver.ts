/**
 * Pure helpers for the /buy entry route — extracted so they're unit-testable
 * without Next's server-only redirect()/cookies()/getPayload().
 */

const MACHINE_RE = /^[A-Z0-9-]{8,128}$/i

/** A machine fingerprint is safe to store as a cookie only if it matches. */
export function isValidMachineId(machine: string | undefined | null): boolean {
  if (!machine) return false
  return MACHINE_RE.test(machine)
}

/** Build the `next` path that an anonymous visitor returns to after signup. */
export function buildSignupNext(machine?: string | null, mod?: string | null): string {
  const params = new URLSearchParams()
  if (machine) params.set('machine', machine)
  if (mod) params.set('module', mod)
  const qs = params.toString()
  return qs ? `/buy?${qs}` : '/buy'
}

const VALID_MODULES = ['core', 'dawa', 'retail', 'hardware', 'hospitality', 'salon'] as const
export type ValidModule = (typeof VALID_MODULES)[number]

const VALID_VARIANTS = ['pro', 'dawa', 'retail', 'hospitality', 'hardware', 'salon'] as const
export type ValidVariant = (typeof VALID_VARIANTS)[number]

/* ────────────────────────────────────────────────────────────────────
 * Public catalogue — the ONLY products a buyer can select and pay for.
 *
 * The commercial contract is exactly five products. `pro` is a legacy
 * internal variant (kept for enum/API compatibility with existing
 * licence rows and the desktop validator) but is NOT publicly sold, so
 * it is deliberately absent from this list. Every public entry point —
 * the /buy resolver, the checkout UI, and the server-side Paystack init
 * guard — must constrain to `PublicVariant`.
 * ──────────────────────────────────────────────────────────────────── */

export interface PublicProduct {
  /** Marketing id + landing route segment. */
  id: 'pharmacy' | 'retail' | 'hospitality' | 'hardware' | 'salon'
  /** Licence + desktop variant enum this product issues. */
  variant: 'dawa' | 'retail' | 'hospitality' | 'hardware' | 'salon'
  /** Catalogue display name shown on the order review + confirmation. */
  name: string
  /** One-line audience descriptor for the order docket. */
  tagline: string
}

export const PUBLIC_PRODUCTS: readonly PublicProduct[] = [
  { id: 'pharmacy', variant: 'dawa', name: 'Pharmacy', tagline: 'Chemists, clinics and dispensaries' },
  { id: 'retail', variant: 'retail', name: 'Retail', tagline: 'Mini-marts, fashion and general retail' },
  { id: 'hospitality', variant: 'hospitality', name: 'Hospitality', tagline: 'Restaurants, bars, hotels and lodges' },
  { id: 'hardware', variant: 'hardware', name: 'Hardware & Equipment', tagline: 'Hardware stores, yards and equipment dealers' },
  { id: 'salon', variant: 'salon', name: 'Salon & Spa', tagline: 'Salons, barbershops, nail bars and spas' },
] as const

export type PublicVariant = PublicProduct['variant']

const PUBLIC_VARIANTS: readonly PublicVariant[] = PUBLIC_PRODUCTS.map((p) => p.variant)

/** True only for one of the five publicly-sold product variants. */
export function isPublicVariant(value: string | null | undefined): value is PublicVariant {
  return typeof value === 'string' && (PUBLIC_VARIANTS as readonly string[]).includes(value)
}

/**
 * Resolve the public product a `?variant=` / `?module=` request maps to.
 *
 * Never returns `pro` (or any non-catalogue value). A `pharmacy` alias
 * maps to the `dawa` variant. Anything unrecognised falls back to the
 * flagship `dawa` product rather than issuing a paused/legacy variant.
 */
export function resolvePublicVariant(variant?: string | null, mod?: string | null): PublicVariant {
  if (isPublicVariant(variant)) return variant
  const v = (variant ?? '').toLowerCase()
  if (v === 'pharmacy') return 'dawa'
  const m = (mod ?? '').toLowerCase()
  if (m === 'pharmacy') return 'dawa'
  if (isPublicVariant(m)) return m
  return 'dawa'
}

/** Catalogue display name for a variant. Legacy `pro` keeps a name for
 *  the paused-notice screen only; it is never a purchasable product. */
export function publicProductName(variant: string): string {
  const product = PUBLIC_PRODUCTS.find((p) => p.variant === variant)
  if (product) return product.name
  if (variant === 'pro') return 'Omnix Pro'
  return `Omnix ${variant.charAt(0).toUpperCase()}${variant.slice(1)}`
}

/**
 * Resolve which modules a freshly-issued trial licence should include.
 *
 * Rules:
 *   - explicit single trade module (dawa/retail/hospitality/hardware) → core + that one
 *   - undefined / 'core' / 'pro' → all four trades unlocked (Pro trial behaviour)
 */
export function trialModulesFor(mod?: string | null): ValidModule[] {
  if (mod && mod !== 'pro' && mod !== 'core' && (VALID_MODULES as readonly string[]).includes(mod)) {
    return ['core', mod as ValidModule]
  }
  return ['core', 'dawa', 'retail', 'hardware', 'hospitality', 'salon']
}

/**
 * Resolve which variant a freshly-issued licence should be bound to.
 *
 * Rules:
 *   - explicit ?variant= wins (when valid)
 *   - else map ?module= to its trade variant (dawa/retail/hospitality/hardware)
 *   - else default to 'pro' (multi-trade)
 */
export function variantFor(variant?: string | null, mod?: string | null): ValidVariant {
  if (variant && (VALID_VARIANTS as readonly string[]).includes(variant)) {
    return variant as ValidVariant
  }
  if (mod === 'dawa' || mod === 'retail' || mod === 'hospitality' || mod === 'hardware') {
    return mod
  }
  return 'pro'
}

/** Decide where /buy should send the visitor. */
export type BuyDecision =
  | { kind: 'signup'; next: string }
  | { kind: 'checkout'; licenseId: string | number }
  | { kind: 'create-then-checkout'; modules: ValidModule[]; variant: ValidVariant }

export function decideBuyDestination(input: {
  isCustomer: boolean
  existingLicenseId?: string | number | null
  machine?: string | null
  module?: string | null
  variant?: string | null
}): BuyDecision {
  if (!input.isCustomer) {
    return { kind: 'signup', next: buildSignupNext(input.machine, input.module) }
  }
  if (input.existingLicenseId != null) {
    return { kind: 'checkout', licenseId: input.existingLicenseId }
  }
  return {
    kind: 'create-then-checkout',
    modules: trialModulesFor(input.module),
    variant: variantFor(input.variant, input.module),
  }
}
