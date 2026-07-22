/**
 * Checkout outcome derivation — pure, server-authoritative helpers.
 *
 * The /buy/success confirmation screen must NEVER trust a `?success=true`
 * / `?ref=` query on its own. It looks the payment up by reference scoped
 * to the signed-in owner, optionally re-verifies the charge with Paystack,
 * and then derives what the buyer is allowed to see from those facts.
 *
 * Extracted here so the decision logic is unit-testable without Next's
 * server-only session/db/Paystack machinery.
 */

export type CheckoutView = 'success' | 'pending' | 'failed' | 'unknown'

/** A payment row as recorded at initialise time (amount in major units). */
export interface PaymentSnapshot {
  status: string // pending | success | failed | reversed
  amount: number // major units (e.g. 30000 KES)
  currency: string
}

/** A Paystack `transaction/verify` result (amount in smallest unit). */
export interface VerifiedSnapshot {
  status: 'success' | 'failed' | 'pending'
  amountSmallestUnit: number
  currency: string
}

/**
 * Paystack references are opaque merchant strings. We only accept a
 * conservative charset/length so a crafted query can't smuggle control
 * characters into a DB lookup or a log line.
 */
const REFERENCE_RE = /^[A-Za-z0-9._=-]{6,100}$/

export function isValidPaystackReference(ref: unknown): ref is string {
  return typeof ref === 'string' && REFERENCE_RE.test(ref)
}

/**
 * True only when the verified charge matches the amount + currency we
 * recorded at initialise time. Compared in the smallest unit to avoid
 * float drift; currency compared case-insensitively.
 */
export function amountsMatch(
  expectedMajorUnits: number,
  expectedCurrency: string,
  verifiedSmallestUnit: number,
  verifiedCurrency: string,
): boolean {
  if (!Number.isFinite(expectedMajorUnits) || !Number.isFinite(verifiedSmallestUnit)) return false
  if (typeof expectedCurrency !== 'string' || typeof verifiedCurrency !== 'string') return false
  if (expectedCurrency.toUpperCase() !== verifiedCurrency.toUpperCase()) return false
  return Math.round(expectedMajorUnits * 100) === Math.round(verifiedSmallestUnit)
}

/**
 * Derive what the confirmation page may render.
 *
 *   - No owned payment row for this reference → `unknown`. This is also
 *     what a reference belonging to *another* user resolves to, so the
 *     page never reveals whether someone else's reference exists.
 *   - Settled row (`success`) → `success`, but if a live verify is
 *     supplied it must still agree (defense-in-depth against a stale or
 *     tampered row).
 *   - `failed` / `reversed` row → `failed`.
 *   - `pending` row → only upgraded to `success` when Paystack confirms
 *     with a matching amount; a confirmed failure shows `failed`; anything
 *     else stays `pending`.
 */
export function deriveCheckoutView(
  payment: PaymentSnapshot | null | undefined,
  verified: VerifiedSnapshot | null | undefined,
): CheckoutView {
  if (!payment) return 'unknown'

  if (payment.status === 'success') {
    if (verified) {
      if (verified.status !== 'success') return 'pending'
      if (!amountsMatch(payment.amount, payment.currency, verified.amountSmallestUnit, verified.currency)) {
        return 'failed'
      }
    }
    return 'success'
  }

  if (payment.status === 'failed' || payment.status === 'reversed') return 'failed'

  // pending
  if (verified) {
    if (
      verified.status === 'success' &&
      amountsMatch(payment.amount, payment.currency, verified.amountSmallestUnit, verified.currency)
    ) {
      return 'success'
    }
    if (verified.status === 'failed') return 'failed'
  }
  return 'pending'
}
