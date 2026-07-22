import crypto from 'node:crypto'
import { and, eq, ne, sql } from 'drizzle-orm'
import {
  db,
  withDbTransaction,
  type DbTx,
  payments,
  licenses,
  auditLog,
  user,
  resellers,
  resellerCommissions,
  affiliates,
  affiliateCredits,
} from '@/db'
import { verify } from '@/lib/paystack'
import { createId } from '@/lib/ids'
import { getSetting } from '@/lib/platform-settings'
import { sendLicenseKeyEmail, sendPaymentReceiptEmail } from '@/lib/email'
import { amountsMatch } from '@/lib/checkout-status'

/**
 * Paystack webhook handler. Verifies HMAC signature, then settles the
 * matched payment (by paystack_reference) exactly once.
 *
 * The settlement — payment status → success, the purpose-specific licence
 * mutation, and the payment.success audit — is applied inside ONE
 * interactive database transaction (`withDbTransaction`, which opens a real
 * BEGIN/COMMIT over the Neon WebSocket driver because the shared HTTP `db`
 * cannot open transactions). The payment row is re-read and claimed under
 * `SELECT … FOR UPDATE` with a `status <> 'success'` predicate, so:
 *
 *   - Only one concurrent delivery ever applies the non-idempotent
 *     entitlement effects (maintenance/backup extension, seat/branch
 *     increment, first licence issue).
 *   - A crash anywhere in the critical section rolls the whole thing back,
 *     leaving the payment `pending` so a later retry can still fulfil it —
 *     the previous bug flipped status to success *before* the licence
 *     mutation, so a crash produced a settled-but-unfulfilled payment that
 *     every retry then skipped as a "duplicate".
 *   - The final `success` state is committed only once the core entitlement
 *     mutation has completed. A missing licence row rolls back and takes a
 *     controlled audit/error path instead of marking success.
 *
 * On charge.success this also ships the purchase confirmation email:
 *   - For license_fee  → LicenseKeyEmail (key + download link)
 *   - For everything else → PaymentReceiptEmail
 *
 * The email runs AFTER the DB commit on both the fresh and the duplicate
 * path (a process that crashed after commit but before mailing must still be
 * able to send it). Every send carries a deterministic, non-secret,
 * payment-derived `Idempotency-Key`, so a retried or concurrent delivery is
 * de-duplicated by Resend rather than mailing the customer twice. A transient
 * send failure returns a retryable non-2xx so Paystack redelivers; a missing
 * email configuration stays non-fatal (the dashboard hands the key over).
 *
 * Configure in Paystack dashboard:
 *   POST https://omnix.co.ke/api/paystack/webhook
 *
 * Paystack signs every webhook with HMAC-SHA512 keyed by the merchant's
 * `secret_key` (sk_live_... or sk_test_...). There is NO separate
 * "webhook secret" — the dashboard doesn't let you configure one.
 * Source: https://paystack.com/docs/payments/webhooks/
 */

type PaymentRow = typeof payments.$inferSelect
type LicenseRow = typeof licenses.$inferSelect

const YEAR_MS = 365 * 24 * 60 * 60 * 1000
const MONTH_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Thrown inside the settlement transaction when a payment references a
 * licence row that no longer exists. Rolls the transaction back so the
 * payment is never marked success without its entitlement.
 */
class LicenseMissingError extends Error {
  constructor(readonly licenseId: string) {
    super('required licence row missing')
    this.name = 'LicenseMissingError'
  }
}

/**
 * Apply the purpose-specific entitlement mutation for a just-claimed payment,
 * inside the settlement transaction. The licence row is locked FOR UPDATE so
 * two settlements touching the same licence serialise (no lost increment).
 * A missing licence throws {@link LicenseMissingError} to roll everything back.
 *
 * Entitlement semantics are preserved exactly (perpetual licence + first year
 * of optional compliance updates on first purchase; +1 year renewal; +30 day
 * cloud backup; major-version cap bump; +1 branch / +1 machine).
 */
async function applyLicenseMutation(tx: DbTx, p: PaymentRow): Promise<LicenseRow | null> {
  if (!p.licenseId) return null
  const now = new Date()
  const [lic] = await tx.select().from(licenses).where(eq(licenses.id, p.licenseId)).for('update').limit(1)
  if (!lic) throw new LicenseMissingError(p.licenseId)

  if (p.purpose === 'license_fee') {
    const result = await tx
      .update(licenses)
      .set({
        status: 'active',
        tier: 'starter',
        paidAt: now,
        maintenanceUntil: new Date(now.getTime() + YEAR_MS),
        priceFeePaid: p.amount,
        currency: p.currency,
        updatedAt: now,
      })
      .where(eq(licenses.id, p.licenseId))
      .returning()
    return result[0] ?? null
  }
  if (p.purpose === 'maintenance_renewal') {
    const base = lic.maintenanceUntil && lic.maintenanceUntil > now ? lic.maintenanceUntil : now
    const result = await tx
      .update(licenses)
      .set({ maintenanceUntil: new Date(base.getTime() + YEAR_MS), updatedAt: now })
      .where(eq(licenses.id, p.licenseId))
      .returning()
    return result[0] ?? null
  }
  if (p.purpose === 'cloud_backup') {
    const base = lic.cloudBackupExpiresAt && lic.cloudBackupExpiresAt > now ? lic.cloudBackupExpiresAt : now
    const result = await tx
      .update(licenses)
      .set({ cloudBackupEnabled: true, cloudBackupExpiresAt: new Date(base.getTime() + MONTH_MS), updatedAt: now })
      .where(eq(licenses.id, p.licenseId))
      .returning()
    return result[0] ?? null
  }
  if (p.purpose === 'major_upgrade') {
    const result = await tx.update(licenses).set({ majorVersionCap: 2, updatedAt: now }).where(eq(licenses.id, p.licenseId)).returning()
    return result[0] ?? null
  }
  if (p.purpose === 'extra_branch') {
    const result = await tx.update(licenses).set({ maxBranches: lic.maxBranches + 1, updatedAt: now }).where(eq(licenses.id, p.licenseId)).returning()
    return result[0] ?? null
  }
  if (p.purpose === 'extra_machine') {
    const result = await tx.update(licenses).set({ maxMachines: lic.maxMachines + 1, updatedAt: now }).where(eq(licenses.id, p.licenseId)).returning()
    return result[0] ?? null
  }
  // Unknown purpose with a licence attached — no entitlement change.
  return lic
}

export async function POST(req: Request) {
  const sig = req.headers.get('x-paystack-signature') ?? ''
  const secret = await getSetting('paystack.secret_key')
  const raw = await req.text()
  if (!secret) {
    return Response.json({ error: 'paystack.secret_key not configured' }, { status: 500 })
  }
  const expected = crypto.createHmac('sha512', secret).update(raw).digest('hex')
  if (sig !== expected) {
    return Response.json({ error: 'bad signature' }, { status: 401 })
  }

  const event = JSON.parse(raw) as {
    event: string
    data: { reference: string; status: string; amount: number; currency: string }
  }

  if (event.event !== 'charge.success') {
    return Response.json({ ok: true, ignored: event.event })
  }

  const reference = event.data.reference

  // ── Idempotency anchor ──────────────────────────────────────────
  // Reference is UNIQUE. Look the payment up first so we know it exists and
  // whether a previous delivery already settled it. We DO NOT early-return on
  // an already-settled row anymore: a process that crashed after committing
  // the settlement but before sending the confirmation email must still be
  // able to (idempotently) re-send it below.
  const existingRows = await db
    .select()
    .from(payments)
    .where(eq(payments.paystackReference, reference))
    .limit(1)
  const existing = existingRows[0]
  if (!existing) {
    return Response.json({ error: 'payment not found' }, { status: 404 })
  }
  const alreadySettledOnEntry = existing.status === 'success'

  // Defense-in-depth: re-fetch from Paystack to confirm (both fresh and
  // duplicate deliveries — a charge reversed after the fact must not confirm).
  const v = await verify(reference)
  if (v.status !== 'success') {
    return Response.json({ ok: false, paystackStatus: v.status })
  }

  // ── Server-authoritative amount/currency guard ──────────────────
  // The verified charge must match what we recorded at initialise time.
  // A mismatch means a tampered popup or a reused reference — never
  // settle it, never issue a licence.
  if (!amountsMatch(existing.amount, existing.currency, v.amountSmallestUnit, v.currency)) {
    await db.insert(auditLog).values({
      id: createId(),
      actorId: existing.userId,
      action: 'payment.amount_mismatch',
      resource: `payment:${existing.id}`,
      metadata: {
        reference,
        expectedAmount: existing.amount,
        expectedCurrency: existing.currency,
        paidAmountSmallestUnit: v.amountSmallestUnit,
        paidCurrency: v.currency,
      },
    })
    return Response.json({ ok: false, error: 'amount mismatch' }, { status: 409 })
  }

  // ── Atomic settlement (fresh delivery only) ─────────────────────
  // Everything that makes the payment "successful" happens inside one
  // transaction, so a crash can never split the settlement from its
  // entitlement. Duplicate deliveries skip this entirely (no entitlement
  // effect is ever re-applied) and only re-read what the email needs.
  let p: PaymentRow
  let postLicense: LicenseRow | null = null
  let duplicate = false

  if (alreadySettledOnEntry) {
    duplicate = true
    p = existing
    postLicense = existing.licenseId
      ? (await db.select().from(licenses).where(eq(licenses.id, existing.licenseId)).limit(1))[0] ?? null
      : null
  } else {
    let outcome: { claimed: boolean; payment: PaymentRow | null; license: LicenseRow | null }
    try {
      outcome = await withDbTransaction(async (tx) => {
        // Re-read + claim the row under a row lock so exactly one delivery wins.
        const locked = await tx
          .select()
          .from(payments)
          .where(eq(payments.paystackReference, reference))
          .for('update')
          .limit(1)
        const row = locked[0]
        if (!row) {
          return { claimed: false, payment: null as PaymentRow | null, license: null as LicenseRow | null }
        }
        if (row.status === 'success') {
          // A concurrent delivery settled it after our pre-read. Do NOT touch
          // entitlements; just hand back what the email step needs.
          const license = row.licenseId
            ? (await tx.select().from(licenses).where(eq(licenses.id, row.licenseId)).limit(1))[0] ?? null
            : null
          return { claimed: false, payment: row, license }
        }
        // Claim: pending → success. The `status <> 'success'` predicate plus
        // the FOR UPDATE lock guarantee the entitlement mutation below runs
        // exactly once across concurrent deliveries.
        const claimedRows = await tx
          .update(payments)
          .set({ status: 'success', paidAt: new Date() })
          .where(and(eq(payments.id, row.id), ne(payments.status, 'success')))
          .returning()
        const claimed = claimedRows[0]
        if (!claimed) {
          const license = row.licenseId
            ? (await tx.select().from(licenses).where(eq(licenses.id, row.licenseId)).limit(1))[0] ?? null
            : null
          return { claimed: false, payment: row, license }
        }
        // Core entitlement mutation — throws (→ rollback) if the licence is
        // gone, so success is only ever committed once this has completed.
        const license = await applyLicenseMutation(tx, claimed)
        // payment.success audit lives inside the same transaction: it cannot
        // survive a rollback, nor be lost when the settlement commits.
        await tx.insert(auditLog).values({
          id: createId(),
          actorId: claimed.userId,
          action: 'payment.success',
          resource: `payment:${claimed.id}`,
          metadata: { reference, amount: claimed.amount, currency: claimed.currency, purpose: claimed.purpose },
        })
        return { claimed: true, payment: claimed, license }
      })
    } catch (e) {
      if (e instanceof LicenseMissingError) {
        // Controlled path: never mark success, audit the anomaly without
        // leaking internal detail, and return a retryable error.
        await db.insert(auditLog).values({
          id: createId(),
          actorId: existing.userId,
          action: 'payment.license_missing',
          resource: `payment:${existing.id}`,
          metadata: { reference, purpose: existing.purpose },
        })
        return Response.json({ ok: false, error: 'settlement incomplete' }, { status: 500 })
      }
      // Unexpected failure — the transaction rolled back, the payment is still
      // pending, so let Paystack retry.
      console.error('[webhook] settlement transaction failed')
      return Response.json({ ok: false, error: 'settlement failed' }, { status: 500 })
    }

    if (!outcome.payment) {
      // The row vanished between the pre-read and the lock — nothing to do.
      return Response.json({ ok: true, duplicate: true })
    }
    p = outcome.payment
    postLicense = outcome.license
    duplicate = !outcome.claimed
  }

  // ── Reseller commission credit ─────
  // Credit the issuing reseller's ledger. The ledger insert AND the rolling
  // aggregate update are transactionally coupled so a crash can't leave the
  // aggregate out of sync with the ledger. Idempotent via
  // reseller_commissions.paymentId UNIQUE — a replay (or a concurrent
  // delivery) that loses the insert race simply rolls back this inner
  // transaction. Non-fatal: a reseller-crediting failure must never fail the
  // webhook or block core fulfilment.
  if (postLicense?.resellerId && p.purpose === 'license_fee') {
    const resellerId = postLicense.resellerId
    const licenseIdForCredit = postLicense.id
    try {
      await withDbTransaction(async (tx) => {
        const [reseller] = await tx.select().from(resellers).where(eq(resellers.id, resellerId)).for('update').limit(1)
        if (!reseller) return
        const already = await tx
          .select({ id: resellerCommissions.id })
          .from(resellerCommissions)
          .where(eq(resellerCommissions.paymentId, p.id))
          .limit(1)
        if (already[0]) return
        // Commission = amount × discount / (1 − discount); 0 for a no-cut referrer.
        const d = reseller.discountPercent / 100
        const commissionAmount = d > 0 && d < 1 ? Math.round(p.amount * (d / (1 - d))) : 0
        await tx.insert(resellerCommissions).values({
          id: createId(),
          resellerId: reseller.id,
          paymentId: p.id,
          licenseId: licenseIdForCredit,
          grossAmount: p.amount,
          commissionAmount,
          currency: p.currency,
          status: 'pending',
          metadata: { discountPercent: reseller.discountPercent, reference },
        })
        await tx
          .update(resellers)
          .set({
            totalLicensesIssued: sql`${resellers.totalLicensesIssued} + 1`,
            totalRevenueBrought: sql`${resellers.totalRevenueBrought} + ${p.amount}`,
            totalCommissionEarned: sql`${resellers.totalCommissionEarned} + ${commissionAmount}`,
            unpaidCommission: sql`${resellers.unpaidCommission} + ${commissionAmount}`,
            updatedAt: new Date(),
          })
          .where(eq(resellers.id, reseller.id))
        await tx.insert(auditLog).values({
          id: createId(),
          actorId: reseller.userId,
          action: 'reseller.commission_credit',
          resource: `reseller:${reseller.id}`,
          metadata: {
            paymentId: p.id,
            licenseId: licenseIdForCredit,
            gross: p.amount,
            commission: commissionAmount,
            currency: p.currency,
          },
        })
      })
    } catch (e) {
      // Non-fatal — reseller crediting failure must not fail the webhook.
      console.error('[webhook] reseller commission credit failed:', e)
    }
  }

  // ── Affiliate credit (referral attribution) ─────
  // Same idempotency + transactional-coupling guarantee as the reseller path
  // (affiliate_credits.paymentId UNIQUE). Only credits on `license_fee`, first
  // purchase only, with the existing self-referral / repeat / blocked checks.
  try {
    const refCode = (p.metadata as { refCode?: string } | null)?.refCode
    if (refCode && p.purpose === 'license_fee' && p.userId) {
      const payingUserId = p.userId
      const paymentLicenseId = p.licenseId ?? null
      await withDbTransaction(async (tx) => {
        const [aff] = await tx.select().from(affiliates).where(eq(affiliates.refCode, refCode.toUpperCase())).for('update').limit(1)
        if (!aff) return
        const already = await tx
          .select({ id: affiliateCredits.id })
          .from(affiliateCredits)
          .where(eq(affiliateCredits.paymentId, p.id))
          .limit(1)
        if (already[0]) return

        const paying = (await tx.select().from(user).where(eq(user.id, payingUserId)).limit(1))[0]
        let rejectionReason: string | null = null
        if (aff.blocked) rejectionReason = 'affiliate_blocked'
        else if (aff.userId === payingUserId) rejectionReason = 'self_referral_user'
        else if (paying && aff.contactEmail && paying.email && aff.contactEmail.toLowerCase() === paying.email.toLowerCase()) {
          rejectionReason = 'self_referral_email'
        } else if (paying && aff.contactPhone && paying.phoneNumber && aff.contactPhone.replace(/\D/g, '') === paying.phoneNumber.replace(/\D/g, '') && aff.contactPhone.replace(/\D/g, '').length >= 9) {
          rejectionReason = 'self_referral_phone'
        } else if ((aff.creditedUserIds ?? []).includes(payingUserId)) {
          rejectionReason = 'repeat_referral'
        }

        const commissionAmount = rejectionReason ? 0 : Math.round(p.amount * (aff.commissionPercent / 100))
        await tx.insert(affiliateCredits).values({
          id: createId(),
          affiliateId: aff.id,
          paymentId: p.id,
          licenseId: paymentLicenseId,
          referredUserId: payingUserId,
          grossAmount: p.amount,
          commissionAmount,
          currency: p.currency,
          status: rejectionReason
            ? (rejectionReason === 'repeat_referral' ? 'rejected_repeat' : 'rejected_self_referral')
            : 'pending',
          metadata: {
            refCode,
            rejectionReason,
            payingUserId,
            payingEmail: paying?.email ?? null,
          },
        })

        if (!rejectionReason) {
          const nextCreditedUserIds = [...(aff.creditedUserIds ?? []), payingUserId].slice(-500)
          await tx
            .update(affiliates)
            .set({
              totalReferralsCredited: sql`${affiliates.totalReferralsCredited} + 1`,
              totalCommissionEarned: sql`${affiliates.totalCommissionEarned} + ${commissionAmount}`,
              unpaidBalance: sql`${affiliates.unpaidBalance} + ${commissionAmount}`,
              creditedUserIds: nextCreditedUserIds,
              updatedAt: new Date(),
            })
            .where(eq(affiliates.id, aff.id))
        }

        await tx.insert(auditLog).values({
          id: createId(),
          actorId: aff.userId,
          action: rejectionReason ? 'affiliate.credit_rejected' : 'affiliate.credit',
          resource: `affiliate:${aff.id}`,
          metadata: {
            paymentId: p.id,
            referredUserId: payingUserId,
            gross: p.amount,
            commission: commissionAmount,
            currency: p.currency,
            rejectionReason,
          },
        })
      })
    }
  } catch (e) {
    console.error('[webhook] affiliate credit failed:', e)
  }

  // ── Purchase confirmation email — retry-safe, provider-idempotent ─────
  // Runs after the DB commit on BOTH the fresh and the duplicate path, so a
  // process that crashed after commit but before mailing can still deliver on
  // retry. Every send carries a deterministic, non-secret, payment-derived
  // Idempotency-Key: concurrent/replayed deliveries de-duplicate at Resend
  // instead of double-mailing the customer.
  //
  // A missing email configuration is non-fatal (the sender returns without
  // throwing; the dashboard hands the key over). A REAL send failure throws —
  // we then return a retryable non-2xx so Paystack redelivers, and the
  // idempotency key prevents a duplicate on that retry. Logs never carry the
  // key material or the idempotency key.
  if (p.userId) {
    const customer = (await db.select().from(user).where(eq(user.id, p.userId)).limit(1))[0]
    if (customer) {
      const dateStr = new Date(p.paidAt ?? Date.now()).toISOString().slice(0, 10)
      const variant = postLicense?.variant ?? 'pro'
      const downloadUrl = `https://omnix.co.ke/downloads`
      try {
        if (p.purpose === 'license_fee' && postLicense?.licenseKey) {
          await sendLicenseKeyEmail({
            to: customer.email,
            customerName: customer.name ?? customer.email.split('@')[0],
            licenseKey: postLicense.licenseKey,
            variant,
            amountPaid: p.amount,
            currency: p.currency,
            reference,
            date: dateStr,
            downloadUrl,
            maintenanceUntil: postLicense.maintenanceUntil
              ? new Date(postLicense.maintenanceUntil).toISOString().slice(0, 10)
              : 'pending',
            idempotencyKey: `omnix:license-key:${p.id}`,
          })
        } else {
          await sendPaymentReceiptEmail({
            to: customer.email,
            customerName: customer.name ?? customer.email.split('@')[0],
            amount: p.amount,
            currency: p.currency,
            reference,
            purpose: p.purpose,
            date: dateStr,
            idempotencyKey: `omnix:receipt:${p.id}`,
          })
        }
      } catch {
        // DB is already committed. Ask Paystack to redeliver so the
        // notification isn't lost; the idempotency key makes the retry safe.
        console.error('[webhook] purchase email send failed — requesting retry')
        return Response.json({ ok: false, error: 'notification retry' }, { status: 503 })
      }
    }
  }

  return duplicate ? Response.json({ ok: true, duplicate: true }) : Response.json({ ok: true })
}
