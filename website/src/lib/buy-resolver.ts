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

const VALID_MODULES = ['core', 'dawa', 'retail', 'hardware', 'hospitality'] as const
export type ValidModule = (typeof VALID_MODULES)[number]

/** Resolve which modules a freshly-issued trial licence should include. */
export function trialModulesFor(mod?: string | null): ValidModule[] {
  if (mod && (VALID_MODULES as readonly string[]).includes(mod)) {
    return ['core', mod as ValidModule]
  }
  return ['core', 'dawa', 'retail']
}

/** Decide where /buy should send the visitor. */
export type BuyDecision =
  | { kind: 'signup'; next: string }
  | { kind: 'checkout'; licenseId: string | number }
  | { kind: 'create-then-checkout'; modules: ValidModule[] }

export function decideBuyDestination(input: {
  isCustomer: boolean
  existingLicenseId?: string | number | null
  machine?: string | null
  module?: string | null
}): BuyDecision {
  if (!input.isCustomer) {
    return { kind: 'signup', next: buildSignupNext(input.machine, input.module) }
  }
  if (input.existingLicenseId != null) {
    return { kind: 'checkout', licenseId: input.existingLicenseId }
  }
  return { kind: 'create-then-checkout', modules: trialModulesFor(input.module) }
}
