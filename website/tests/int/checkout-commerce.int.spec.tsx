import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  PUBLIC_PRODUCTS,
  isPublicVariant,
  resolvePublicVariant,
  publicProductName,
} from '@/lib/buy-resolver'
import {
  amountsMatch,
  deriveCheckoutView,
  isValidPaystackReference,
} from '@/lib/checkout-status'
import { pricingFor } from '@/config/pricing'
import { CheckoutOutcome } from '@/components/checkout/checkout-outcome'

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const initRoute = read('src/app/api/paystack/init/route.ts')
const webhookRoute = read('src/app/api/paystack/webhook/route.ts')
const successPage = read('src/app/(checkout)/buy/success/page.tsx')
const orderReviewPage = read('src/app/(checkout)/buy/[licenseId]/page.tsx')
const buyEntryPage = read('src/app/(checkout)/buy/page.tsx')
const checkoutForm = read('src/components/checkout/checkout-form.tsx')
const downloadsPage = read('src/app/(dashboard)/dashboard/downloads/page.tsx')
const outcomeComponent = read('src/components/checkout/checkout-outcome.tsx')
const emailLib = read('src/lib/email.ts')

const CATALOGUE_NAMES = ['Pharmacy', 'Retail', 'Hospitality', 'Hardware & Equipment', 'Salon & Spa'] as const
const CATALOGUE_VARIANTS = ['dawa', 'retail', 'hospitality', 'hardware', 'salon'] as const

afterEach(cleanup)

// ─────────────────────────────────────────────────────────────────────
describe('Task 22 · five-product public catalogue', () => {
  it('exposes exactly the five catalogue products and never Pro', () => {
    expect(PUBLIC_PRODUCTS).toHaveLength(5)
    expect(PUBLIC_PRODUCTS.map((p) => p.name)).toEqual([...CATALOGUE_NAMES])
    expect(PUBLIC_PRODUCTS.map((p) => p.variant)).toEqual([...CATALOGUE_VARIANTS])
    expect(PUBLIC_PRODUCTS.map((p) => p.variant)).not.toContain('pro')
  })

  it('isPublicVariant admits only the five variants', () => {
    for (const v of CATALOGUE_VARIANTS) expect(isPublicVariant(v)).toBe(true)
    for (const v of ['pro', 'core', 'business', 'admin', '', null, undefined]) {
      expect(isPublicVariant(v as string)).toBe(false)
    }
  })

  it('resolvePublicVariant maps aliases, keeps valid variants, and never yields Pro', () => {
    expect(resolvePublicVariant('dawa')).toBe('dawa')
    expect(resolvePublicVariant('salon')).toBe('salon')
    expect(resolvePublicVariant('pharmacy')).toBe('dawa')
    expect(resolvePublicVariant(null, 'pharmacy')).toBe('dawa')
    expect(resolvePublicVariant(null, 'hardware')).toBe('hardware')
    // Anything non-catalogue (incl. legacy pro) falls back to the flagship.
    expect(resolvePublicVariant('pro')).toBe('dawa')
    expect(resolvePublicVariant('pro', 'pro')).toBe('dawa')
    expect(resolvePublicVariant(undefined, undefined)).toBe('dawa')
    expect(resolvePublicVariant('nonsense', 'nope')).toBe('dawa')
  })

  it('names each catalogue variant and keeps a legacy label for Pro only', () => {
    expect(publicProductName('dawa')).toBe('Pharmacy')
    expect(publicProductName('hardware')).toBe('Hardware & Equipment')
    expect(publicProductName('salon')).toBe('Salon & Spa')
    expect(publicProductName('pro')).toBe('Omnix Pro')
  })

  it('the /buy entry page constrains requests through the public resolver and reroutes legacy Pro', () => {
    expect(buyEntryPage).toContain('resolvePublicVariant(variant, mod)')
    expect(buyEntryPage).toContain("variant === 'pro'")
    expect(buyEntryPage).toContain("redirect('/buy?variant=dawa')")
    // The old inline allowlist that admitted 'pro' as a purchasable variant is gone.
    expect(buyEntryPage).not.toContain("['pro','dawa','retail','hospitality','hardware','salon'].includes")
  })

  it('the order-review Pro paused notice offers the five catalogue products', () => {
    expect(orderReviewPage).toContain('PUBLIC_PRODUCTS.map')
    expect(orderReviewPage).toContain('Pro isn')
    expect(orderReviewPage).toContain('publicProductName(license.variant)')
  })
})

// ─────────────────────────────────────────────────────────────────────
describe('Task 22 · server-authoritative pricing', () => {
  it('the client sends only { licenseId, purpose } — never an amount or currency', () => {
    expect(checkoutForm).toContain('JSON.stringify({ licenseId, purpose })')
    expect(checkoutForm).not.toMatch(/body:\s*JSON\.stringify\([^)]*amount/)
    expect(checkoutForm).not.toMatch(/body:\s*JSON\.stringify\([^)]*currency/)
  })

  it('the init route ignores client amount/currency/email and computes them server-side', () => {
    expect(initRoute).toContain('interface InitInput')
    expect(initRoute).not.toContain('body.amount')
    expect(initRoute).not.toContain('body.currency')
    expect(initRoute).not.toContain('body.email')
    expect(initRoute).toContain('const p = pricingFor(currency)')
    expect(initRoute).toContain('const amount = computeAmount(body.purpose, lic.variant, p)')
    expect(initRoute).toContain('amountSmallestUnit: amount * 100')
    expect(initRoute).toContain('email: session.user.email')
    expect(initRoute).toContain("(lic.currency as SupportedCurrency) ?? 'KES'")
  })

  it('the starter price is the KES 30,000 one-time perpetual licence for every public product', () => {
    const p = pricingFor('KES')
    expect(p.starter.oneTimeFee).toBe(30_000)
    expect(p.starter.maintenanceYearly).toBe(12_000)
  })

  it('a first purchase (license_fee) is only allowed for a public catalogue variant', () => {
    expect(initRoute).toContain("body.purpose === 'license_fee' && !isPublicVariant(lic.variant)")
    expect(initRoute).toContain('variant not available for purchase')
  })
})

// ─────────────────────────────────────────────────────────────────────
describe('Task 22 · amount / currency mismatch rejection', () => {
  it('amountsMatch compares in the smallest unit and rejects currency or value drift', () => {
    expect(amountsMatch(30_000, 'KES', 3_000_000, 'KES')).toBe(true)
    expect(amountsMatch(30_000, 'kes', 3_000_000, 'KES')).toBe(true) // case-insensitive
    expect(amountsMatch(30_000, 'KES', 3_000_000, 'USD')).toBe(false) // currency mismatch
    expect(amountsMatch(30_000, 'KES', 100, 'KES')).toBe(false) // amount mismatch
    expect(amountsMatch(Number.NaN, 'KES', 3_000_000, 'KES')).toBe(false)
  })

  it('the webhook re-verifies the amount and refuses to settle a mismatch', () => {
    expect(webhookRoute).toContain('amountsMatch(existing.amount, existing.currency, v.amountSmallestUnit, v.currency)')
    expect(webhookRoute).toContain("action: 'payment.amount_mismatch'")
    expect(webhookRoute).toContain("error: 'amount mismatch'")
    // The mismatch branch returns before the pending → success transition.
    const mismatchIdx = webhookRoute.indexOf('payment.amount_mismatch')
    const settleIdx = webhookRoute.indexOf("ne(payments.status, 'success')")
    expect(mismatchIdx).toBeGreaterThan(-1)
    expect(settleIdx).toBeGreaterThan(mismatchIdx)
  })
})

// ─────────────────────────────────────────────────────────────────────
describe('Task 22 · session + ownership gates', () => {
  it('the init route requires a session and scopes the licence to the caller', () => {
    expect(initRoute).toContain('auth.api.getSession')
    expect(initRoute).toContain("error: 'unauthenticated'")
    expect(initRoute).toContain('eq(licenses.userId, session.user.id)')
  })

  it('the order-review page requires a session and 404s a licence the caller does not own', () => {
    expect(orderReviewPage).toContain('auth.api.getSession')
    expect(orderReviewPage).toContain('redirect(`/login?next=/buy/${licenseId}`)')
    expect(orderReviewPage).toContain('eq(licenses.userId, session.user.id)')
    expect(orderReviewPage).toContain('notFound()')
  })

  it('the confirmation page requires a session and scopes lookups to the owner', () => {
    expect(successPage).toContain('auth.api.getSession')
    expect(successPage).toContain('redirect(`/login?next=')
    expect(successPage).toContain('eq(payments.userId, session.user.id)')
    expect(successPage).toContain('eq(licenses.userId, session.user.id)')
    expect(successPage).toContain("export const dynamic = 'force-dynamic'")
  })

  it('the customer downloads page requires a session', () => {
    expect(downloadsPage).toContain("redirect('/login?next=/dashboard/downloads')")
  })
})

// ─────────────────────────────────────────────────────────────────────
describe('Task 22 · webhook signature + idempotency', () => {
  it('verifies the Paystack HMAC-SHA512 signature and rejects a bad one', () => {
    expect(webhookRoute).toContain("crypto.createHmac('sha512', secret)")
    expect(webhookRoute).toContain('if (sig !== expected)')
    expect(webhookRoute).toContain("error: 'bad signature'")
  })

  it('guards against replay so no licence / email side-effect runs twice', () => {
    expect(webhookRoute).toContain('const existing = existingRows[0]')
    expect(webhookRoute).toContain("existing.status === 'success'")
    expect(webhookRoute).toContain('duplicate: true')
    expect(webhookRoute).toContain("ne(payments.status, 'success')")
  })

  it('still re-verifies the charge with Paystack before settling', () => {
    expect(webhookRoute).toContain('const v = await verify(reference)')
    expect(webhookRoute).toContain("if (v.status !== 'success')")
  })
})

// ─────────────────────────────────────────────────────────────────────
describe('Task 22 · webhook atomic settlement + retry-safe fulfilment', () => {
  it('encloses the final success flip, the entitlement mutation, and the success audit in one transaction', () => {
    // A real interactive transaction — the neon-http `db` cannot open one.
    expect(webhookRoute).toContain('await withDbTransaction(async (tx)')
    expect(webhookRoute).toContain('async function applyLicenseMutation(tx: DbTx')

    const txIdx = webhookRoute.indexOf('await withDbTransaction(async (tx)')
    const claimIdx = webhookRoute.indexOf("set({ status: 'success', paidAt: new Date() })")
    const mutateIdx = webhookRoute.indexOf('applyLicenseMutation(tx, claimed)')
    const auditIdx = webhookRoute.indexOf("action: 'payment.success'")

    // status → success, the entitlement mutation, and the payment.success
    // audit all live INSIDE the transaction, in that order.
    expect(txIdx).toBeGreaterThan(-1)
    expect(claimIdx).toBeGreaterThan(txIdx)
    expect(mutateIdx).toBeGreaterThan(claimIdx)
    expect(auditIdx).toBeGreaterThan(mutateIdx)

    // The payment is flipped to success in exactly one place — the claim
    // inside the transaction — never before it.
    expect(webhookRoute.match(/status: 'success', paidAt/g) ?? []).toHaveLength(1)
  })

  it('claims the row with a race-safe FOR UPDATE lock plus a status predicate', () => {
    expect(webhookRoute).toContain(".for('update')")
    expect(webhookRoute).toContain("ne(payments.status, 'success')")
    const lockIdx = webhookRoute.indexOf(".for('update')")
    const claimIdx = webhookRoute.indexOf("ne(payments.status, 'success')")
    expect(lockIdx).toBeGreaterThan(-1)
    expect(claimIdx).toBeGreaterThan(lockIdx) // lock taken before the conditional claim
  })

  it('rolls back and takes a controlled audit path when a required licence row is missing', () => {
    expect(webhookRoute).toContain('LicenseMissingError')
    expect(webhookRoute).toContain("action: 'payment.license_missing'")
    // That path never marks success — it returns a non-2xx.
    expect(webhookRoute).toContain("error: 'settlement incomplete'")
  })

  it('has no early success short-circuit before the notification step', () => {
    // The old bug returned success immediately for an already-settled row,
    // skipping the confirmation email even if the prior process crashed
    // before sending it. That early return is gone.
    expect(webhookRoute).not.toContain("if (existing.status === 'success') {")
    expect(webhookRoute).toContain('const alreadySettledOnEntry = existing.status')

    // Every ok:true success response is emitted only at/after the email step.
    const emailStart = webhookRoute.indexOf('Purchase confirmation email')
    const finalReturn = webhookRoute.indexOf('duplicate ? Response.json({ ok: true, duplicate: true })')
    expect(emailStart).toBeGreaterThan(-1)
    expect(finalReturn).toBeGreaterThan(emailStart)
  })

  it('sends the confirmation with a deterministic, non-secret, payment-derived idempotency key', () => {
    expect(webhookRoute).toContain('omnix:license-key:${p.id}')
    expect(webhookRoute).toContain('omnix:receipt:${p.id}')
    // Never keyed on the licence key or any secret.
    expect(webhookRoute).not.toContain('idempotencyKey: postLicense.licenseKey')
    // The senders accept and forward the key to the provider.
    expect(emailLib).toContain('idempotencyKey?: string')
    expect(emailLib).toContain('input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined')
  })

  it('lets a duplicate delivery reach the same provider-idempotent email retry', () => {
    const dupIdx = webhookRoute.indexOf('if (alreadySettledOnEntry)')
    const licKeyIdx = webhookRoute.indexOf('omnix:license-key:${p.id}')
    expect(dupIdx).toBeGreaterThan(-1)
    // The shared email dispatch runs after the duplicate branch sets its
    // state — the duplicate path is NOT short-circuited before it.
    expect(licKeyIdx).toBeGreaterThan(dupIdx)
  })

  it('returns a retryable non-2xx on a transient send failure, after the DB commit', () => {
    expect(webhookRoute).toContain('notification retry')
    expect(webhookRoute).toContain('status: 503')
    // The retry return is emitted from the email catch — i.e. after settlement.
    const settleIdx = webhookRoute.indexOf('await withDbTransaction(async (tx)')
    const retryIdx = webhookRoute.indexOf('notification retry')
    expect(retryIdx).toBeGreaterThan(settleIdx)
  })

  it('couples reseller + affiliate ledger writes with their aggregates and keeps them non-fatal', () => {
    // Ledger insert + aggregate update + audit run in their own transactions.
    expect(webhookRoute).toContain('resellerCommissions.paymentId')
    expect(webhookRoute).toContain('affiliateCredits.paymentId')
    // Unique-payment guards preserved; both wrapped so a failure is caught.
    expect(webhookRoute).toContain('[webhook] reseller commission credit failed:')
    expect(webhookRoute).toContain('[webhook] affiliate credit failed:')
  })
})

// ─────────────────────────────────────────────────────────────────────
describe('Task 22 · spoofed-success prevention', () => {
  it('deriveCheckoutView never shows success without a settled, matching, owned payment', () => {
    // No owned row (nonexistent OR another user's reference) → unknown.
    expect(deriveCheckoutView(null, null)).toBe('unknown')
    // Pending row, no verify → pending (not success).
    expect(deriveCheckoutView({ status: 'pending', amount: 30_000, currency: 'KES' }, null)).toBe('pending')
    // Pending row, Paystack confirms with a MATCHING amount → success.
    expect(
      deriveCheckoutView(
        { status: 'pending', amount: 30_000, currency: 'KES' },
        { status: 'success', amountSmallestUnit: 3_000_000, currency: 'KES' },
      ),
    ).toBe('success')
    // Pending row, Paystack "success" but MISMATCHED amount → stays pending (never success).
    expect(
      deriveCheckoutView(
        { status: 'pending', amount: 30_000, currency: 'KES' },
        { status: 'success', amountSmallestUnit: 100, currency: 'KES' },
      ),
    ).toBe('pending')
    // Settled row → success; failed/reversed → failed.
    expect(deriveCheckoutView({ status: 'success', amount: 30_000, currency: 'KES' }, null)).toBe('success')
    expect(deriveCheckoutView({ status: 'failed', amount: 30_000, currency: 'KES' }, null)).toBe('failed')
    expect(deriveCheckoutView({ status: 'reversed', amount: 30_000, currency: 'KES' }, null)).toBe('failed')
    // Settled row that no longer agrees with Paystack → failed, not success.
    expect(
      deriveCheckoutView(
        { status: 'success', amount: 30_000, currency: 'KES' },
        { status: 'success', amountSmallestUnit: 100, currency: 'KES' },
      ),
    ).toBe('failed')
  })

  it('validates the Paystack reference shape before it is ever used', () => {
    expect(isValidPaystackReference('OMX-1700000000000-AB12CD')).toBe(true)
    expect(isValidPaystackReference('abc123')).toBe(true)
    expect(isValidPaystackReference('')).toBe(false)
    expect(isValidPaystackReference('has space')).toBe(false)
    expect(isValidPaystackReference('bad/slash')).toBe(false)
    expect(isValidPaystackReference('x'.repeat(101))).toBe(false)
    expect(isValidPaystackReference(null)).toBe(false)
    expect(isValidPaystackReference(42)).toBe(false)
  })

  it('the confirmation page derives state from the owned row, never from the query', () => {
    expect(successPage).toContain('deriveCheckoutView(')
    expect(successPage).toContain('isValidPaystackReference(rawRef)')
    // It must not treat a raw ?success= / ?status= query as truth.
    expect(successPage).not.toContain('params.success')
    expect(successPage).not.toContain("=== 'true'")
    expect(successPage).not.toContain('searchParams: Promise<{ success')
  })

  it('renders the success surface with verified handoff steps only when view=success', () => {
    const { container } = render(
      <CheckoutOutcome
        view="success"
        reference="OMX-123-ABC"
        productName="Pharmacy"
        supportHref="https://wa.me/254700000000"
      />,
    )
    expect(container.querySelector('[data-checkout-view="success"]')).not.toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: /Payment confirmed/i })).toBeTruthy()
    expect(container.querySelector('a[href="/dashboard/downloads"]')).not.toBeNull()
    expect(container.querySelector('a[href="/dashboard/licenses"]')).not.toBeNull()
    expect(container.querySelector('a[href="https://wa.me/254700000000"]')).not.toBeNull()
  })

  it('never renders a spoofable success for pending / failed / unknown views', () => {
    for (const view of ['pending', 'failed', 'unknown'] as const) {
      const { container, unmount } = render(<CheckoutOutcome view={view} reference="OMX-123-ABC" />)
      expect(container.querySelector('[data-checkout-view="success"]')).toBeNull()
      expect(container.querySelector('a[href="/dashboard/downloads"]')).toBeNull()
      expect(container.textContent).not.toMatch(/Payment confirmed/i)
      unmount()
    }
  })

  it('the unknown view does not reveal whether a reference exists (no ref echo, no product)', () => {
    const { container } = render(<CheckoutOutcome view="unknown" reference="OMX-SOMEONE-ELSE" productName="Pharmacy" />)
    expect(container.textContent).not.toContain('OMX-SOMEONE-ELSE')
    expect(container.textContent).not.toContain('Pharmacy')
    expect(container.textContent).toMatch(/couldn.t confirm this payment/i)
  })

  it('announces each state to assistive tech with the right politeness', () => {
    const failed = render(<CheckoutOutcome view="failed" />)
    expect(failed.container.querySelector('[role="alert"]')).not.toBeNull()
    failed.unmount()
    const pending = render(<CheckoutOutcome view="pending" />)
    expect(pending.container.querySelector('[role="status"]')).not.toBeNull()
    pending.unmount()
  })
})

// ─────────────────────────────────────────────────────────────────────
describe('Task 22 · protected installer + no key/URL leakage', () => {
  it('the confirmation page never embeds licence keys or raw installer/release URLs', () => {
    expect(successPage).not.toContain('licenseKey')
    expect(successPage).not.toContain('github.com')
    expect(successPage).not.toContain('releases/download')
  })

  it('the success handoff links to gated dashboard routes, not raw installer URLs', () => {
    expect(outcomeComponent).toContain('href="/dashboard/downloads"')
    expect(outcomeComponent).not.toContain('github.com')
    expect(outcomeComponent).not.toContain('releases/download')
  })

  it('the payment popup only ever forwards to the internal, server-verified success route', () => {
    expect(checkoutForm).toContain('window.location.href = `/buy/success?ref=${encodeURIComponent(transaction.reference)}`')
    expect(checkoutForm).not.toMatch(/window\.location\.href\s*=\s*`?https?:/)
  })
})

// ─────────────────────────────────────────────────────────────────────
describe('Task 22 · honest, optional-compliance copy', () => {
  it('the order review states the perpetual licence and separates optional compliance updates', () => {
    expect(orderReviewPage).toContain('One-time · Perpetual licence · No subscription')
    expect(orderReviewPage).toContain('optional')
    expect(orderReviewPage).toContain('billed separately')
    expect(orderReviewPage).toContain('does not deactivate your perpetual licence')
  })

  it('the payment handoff states the Paystack redirect and online requirement honestly', () => {
    expect(checkoutForm).toContain('Paystack opens a secure window')
    expect(checkoutForm).toContain('An internet connection is needed for this step')
    expect(checkoutForm).toContain('the app itself runs offline once installed')
  })

  it('the confirmation separates payment from installer availability and states optional compliance', () => {
    const { container } = render(<CheckoutOutcome view="success" reference="OMX-1" productName="Retail" />)
    const text = container.textContent ?? ''
    expect(text).toMatch(/perpetual/i)
    expect(text).toMatch(/optional compliance updates are billed separately and are not required/i)
    expect(text).toMatch(/installer downloads unlock/i)
  })
})
