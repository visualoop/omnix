import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, payments, licenses } from '@/db'
import { verify } from '@/lib/paystack'
import {
  deriveCheckoutView,
  isValidPaystackReference,
  type VerifiedSnapshot,
} from '@/lib/checkout-status'
import { publicProductName } from '@/lib/buy-resolver'
import { safeNextPath } from '@/lib/safe-redirect'
import { getSiteSettings } from '@/lib/site-settings'
import { CheckoutOutcome } from '@/components/checkout/checkout-outcome'

export const metadata = { title: 'Payment confirmation', robots: { index: false } }
export const dynamic = 'force-dynamic'

/**
 * /buy/success — payment confirmation.
 *
 * The buyer's browser lands here from Paystack (`?reference=` / `?trxref=`)
 * or the in-app popup (`?ref=`). None of that is trusted: the page requires
 * a session, looks the payment up scoped to the signed-in owner, and only
 * ever derives success from the server-side row (+ a live Paystack verify
 * for still-pending charges). A `?success=true`-style query can never turn
 * this page green, and a reference owned by another account resolves to the
 * same neutral "unknown" state as a nonexistent one — so the page never
 * reveals whether someone else's reference exists.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; reference?: string; trxref?: string }>
}) {
  const params = await searchParams
  const rawRef = params.ref ?? params.reference ?? params.trxref ?? null
  const reference = isValidPaystackReference(rawRef) ? rawRef : null

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) {
    const next = safeNextPath(reference ? `/buy/success?ref=${encodeURIComponent(reference)}` : '/buy/success')
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }

  // Ownership-scoped lookup. A reference that isn't the caller's own
  // resolves to `null` here, i.e. the neutral "unknown" view.
  const paymentRow = reference
    ? (
        await db
          .select()
          .from(payments)
          .where(and(eq(payments.paystackReference, reference), eq(payments.userId, session.user.id)))
          .limit(1)
      )[0] ?? null
    : null

  // Defense-in-depth: re-verify still-pending charges with Paystack so a
  // buyer who beat the webhook here isn't stuck on a stale "pending".
  let verified: VerifiedSnapshot | null = null
  if (paymentRow && reference && paymentRow.status !== 'success') {
    try {
      const v = await verify(reference)
      verified = {
        status: v.status,
        amountSmallestUnit: v.amountSmallestUnit,
        currency: v.currency,
      }
    } catch {
      verified = null
    }
  }

  const view = deriveCheckoutView(
    paymentRow ? { status: paymentRow.status, amount: paymentRow.amount, currency: paymentRow.currency } : null,
    verified,
  )

  // Product name is only resolved (and shown) once we have a confirmed,
  // owned success — never for a spoofed or foreign reference.
  let productName: string | null = null
  if (view === 'success' && paymentRow?.licenseId) {
    const lic = (
      await db
        .select({ variant: licenses.variant })
        .from(licenses)
        .where(and(eq(licenses.id, paymentRow.licenseId), eq(licenses.userId, session.user.id)))
        .orderBy(desc(licenses.createdAt))
        .limit(1)
    )[0]
    if (lic) productName = publicProductName(lic.variant)
  }

  const settings = await getSiteSettings()
  const supportHref = settings.whatsappUrl ?? `mailto:${settings.supportEmail}`

  return (
    <div className="px-6 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <CheckoutOutcome
          view={view}
          reference={reference}
          productName={productName}
          supportHref={supportHref}
        />
      </div>
    </div>
  )
}
