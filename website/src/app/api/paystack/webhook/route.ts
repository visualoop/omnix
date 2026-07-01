import crypto from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { db, payments, licenses, auditLog, user, resellers, resellerCommissions, affiliates, affiliateCredits } from '@/db'
import { verify } from '@/lib/paystack'
import { createId } from '@/lib/ids'
import { getSetting } from '@/lib/platform-settings'
import { sendLicenseKeyEmail, sendPaymentReceiptEmail } from '@/lib/email'

/**
 * Paystack webhook handler. Verifies HMAC signature, then applies
 * the result idempotently (matched by paystack_reference).
 *
 * On charge.success this also:
 *   - For license_fee  → ships LicenseKeyEmail (key + download link)
 *   - For everything else → ships a PaymentReceiptEmail
 *
 * Email failures are logged but never fail the webhook — Paystack
 * would otherwise retry forever.
 *
 * Configure in Paystack dashboard:
 *   POST https://omnix.co.ke/api/paystack/webhook
 *
 * Paystack signs every webhook with HMAC-SHA512 keyed by the merchant's
 * `secret_key` (sk_live_... or sk_test_...). There is NO separate
 * "webhook secret" — the dashboard doesn't let you configure one.
 * Source: https://paystack.com/docs/payments/webhooks/
 */
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

  // Defense-in-depth: re-fetch from Paystack to confirm.
  const v = await verify(reference)
  if (v.status !== 'success') {
    return Response.json({ ok: false, paystackStatus: v.status })
  }

  // Update the payment row (idempotent — re-running this is safe).
  const updated = await db
    .update(payments)
    .set({ status: 'success', paidAt: new Date() })
    .where(eq(payments.paystackReference, reference))
    .returning()
  const p = updated[0]
  if (!p) {
    return Response.json({ error: 'payment not found' }, { status: 404 })
  }

  // Apply side-effects per purpose. Capture the post-update license + customer
  // for the email blast below.
  let postLicense: typeof licenses.$inferSelect | null = null
  if (p.licenseId) {
    const now = new Date()
    if (p.purpose === 'license_fee') {
      const result = await db
        .update(licenses)
        .set({
          status: 'active',
          tier: 'starter',
          paidAt: now,
          maintenanceUntil: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
          priceFeePaid: p.amount,
          currency: p.currency,
          updatedAt: now,
        })
        .where(eq(licenses.id, p.licenseId))
        .returning()
      postLicense = result[0] ?? null
    } else if (p.purpose === 'maintenance_renewal') {
      const lic = (await db.select().from(licenses).where(eq(licenses.id, p.licenseId)).limit(1))[0]
      const base = lic?.maintenanceUntil && lic.maintenanceUntil > now ? lic.maintenanceUntil : now
      const newEnd = new Date(base.getTime() + 365 * 24 * 60 * 60 * 1000)
      const result = await db.update(licenses).set({ maintenanceUntil: newEnd, updatedAt: now }).where(eq(licenses.id, p.licenseId)).returning()
      postLicense = result[0] ?? null
    } else if (p.purpose === 'cloud_backup') {
      const lic = (await db.select().from(licenses).where(eq(licenses.id, p.licenseId)).limit(1))[0]
      const base = lic?.cloudBackupExpiresAt && lic.cloudBackupExpiresAt > now ? lic.cloudBackupExpiresAt : now
      const newEnd = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000)
      const result = await db.update(licenses).set({ cloudBackupEnabled: true, cloudBackupExpiresAt: newEnd, updatedAt: now }).where(eq(licenses.id, p.licenseId)).returning()
      postLicense = result[0] ?? null
    } else if (p.purpose === 'major_upgrade') {
      const result = await db.update(licenses).set({ majorVersionCap: 2, updatedAt: now }).where(eq(licenses.id, p.licenseId)).returning()
      postLicense = result[0] ?? null
    } else if (p.purpose === 'extra_branch') {
      const lic = (await db.select().from(licenses).where(eq(licenses.id, p.licenseId)).limit(1))[0]
      if (lic) {
        const result = await db.update(licenses).set({ maxBranches: lic.maxBranches + 1, updatedAt: now }).where(eq(licenses.id, p.licenseId)).returning()
        postLicense = result[0] ?? null
      }
    } else if (p.purpose === 'extra_machine') {
      const lic = (await db.select().from(licenses).where(eq(licenses.id, p.licenseId)).limit(1))[0]
      if (lic) {
        const result = await db.update(licenses).set({ maxMachines: lic.maxMachines + 1, updatedAt: now }).where(eq(licenses.id, p.licenseId)).returning()
        postLicense = result[0] ?? null
      }
    }
  }

  await db.insert(auditLog).values({
    id: createId(),
    actorId: p.userId,
    action: 'payment.success',
    resource: `payment:${p.id}`,
    metadata: { reference, amount: p.amount, currency: p.currency, purpose: p.purpose },
  })

  // ── Reseller commission credit ─────
  // If this licence was issued by a reseller, credit the reseller's
  // ledger. We use the reseller's discountPercent as the commission
  // rate: reseller collected retail from their customer, paid us
  // wholesale = retail × (1 − discount%). The commissionAmount stored
  // here is the value of the discount they earned (their margin), for
  // volume-tracking + monthly payout reporting.
  //
  // Idempotent: reseller_commissions.paymentId is UNIQUE, so replaying
  // this webhook won't double-credit.
  if (postLicense?.resellerId && p.purpose === 'license_fee') {
    try {
      const [reseller] = await db.select().from(resellers).where(eq(resellers.id, postLicense.resellerId)).limit(1)
      if (reseller) {
        // Wholesale = amount collected. Retail = wholesale / (1 - discount).
        // Commission = retail - wholesale = wholesale × (discount / (1 - discount)).
        // But for simple tracking we store commissionAmount = discount × retail = amount × discount / (1 − discount).
        // If discount is 0, commission = 0 (referrer with no cut, just credit for volume).
        const d = reseller.discountPercent / 100
        const commissionAmount = d > 0 && d < 1
          ? Math.round(p.amount * (d / (1 - d)))
          : 0

        const existing = await db
          .select({ id: resellerCommissions.id })
          .from(resellerCommissions)
          .where(eq(resellerCommissions.paymentId, p.id))
          .limit(1)

        if (!existing[0]) {
          await db.insert(resellerCommissions).values({
            id: createId(),
            resellerId: reseller.id,
            paymentId: p.id,
            licenseId: postLicense.id,
            grossAmount: p.amount,
            commissionAmount,
            currency: p.currency,
            status: 'pending',
            metadata: {
              discountPercent: reseller.discountPercent,
              reference,
            },
          })

          await db
            .update(resellers)
            .set({
              totalLicensesIssued: sql`${resellers.totalLicensesIssued} + 1`,
              totalRevenueBrought: sql`${resellers.totalRevenueBrought} + ${p.amount}`,
              totalCommissionEarned: sql`${resellers.totalCommissionEarned} + ${commissionAmount}`,
              unpaidCommission: sql`${resellers.unpaidCommission} + ${commissionAmount}`,
              updatedAt: new Date(),
            })
            .where(eq(resellers.id, reseller.id))

          await db.insert(auditLog).values({
            id: createId(),
            actorId: reseller.userId,
            action: 'reseller.commission_credit',
            resource: `reseller:${reseller.id}`,
            metadata: {
              paymentId: p.id,
              licenseId: postLicense.id,
              gross: p.amount,
              commission: commissionAmount,
              currency: p.currency,
            },
          })
        }
      }
    } catch (e) {
      // Non-fatal — reseller crediting failure must not fail the webhook.
      // Log for follow-up.
      console.error('[webhook] reseller commission credit failed:', e)
    }
  }

  // ── Affiliate credit (referral attribution) ─────
  // If the pending payment's metadata carries a refCode, look up the
  // affiliate, apply anti-fraud + first-purchase-only rules, and credit
  // if all checks pass. Idempotent via affiliate_credits.paymentId UNIQUE.
  //
  // Only credits on `license_fee` — renewals, upgrades, and extras don't
  // pay the affiliate again (cap at first-purchase-only per referred user).
  try {
    const refCode = (p.metadata as { refCode?: string } | null)?.refCode
    if (refCode && p.purpose === 'license_fee' && p.userId) {
      const [aff] = await db.select().from(affiliates).where(eq(affiliates.refCode, refCode.toUpperCase())).limit(1)
      if (aff) {
        const paying = (await db.select().from(user).where(eq(user.id, p.userId)).limit(1))[0]
        const alreadyCredited = await db
          .select({ id: affiliateCredits.id })
          .from(affiliateCredits)
          .where(eq(affiliateCredits.paymentId, p.id))
          .limit(1)

        let rejectionReason: string | null = null
        if (aff.blocked) rejectionReason = 'affiliate_blocked'
        else if (aff.userId === p.userId) rejectionReason = 'self_referral_user'
        else if (paying && aff.contactEmail && paying.email && aff.contactEmail.toLowerCase() === paying.email.toLowerCase()) {
          rejectionReason = 'self_referral_email'
        } else if (paying && aff.contactPhone && paying.phoneNumber && aff.contactPhone.replace(/\D/g, '') === paying.phoneNumber.replace(/\D/g, '') && aff.contactPhone.replace(/\D/g, '').length >= 9) {
          rejectionReason = 'self_referral_phone'
        } else if ((aff.creditedUserIds ?? []).includes(p.userId)) {
          rejectionReason = 'repeat_referral'
        }

        if (!alreadyCredited[0]) {
          const commissionAmount = rejectionReason ? 0 : Math.round(p.amount * (aff.commissionPercent / 100))
          await db.insert(affiliateCredits).values({
            id: createId(),
            affiliateId: aff.id,
            paymentId: p.id,
            licenseId: p.licenseId ?? null,
            referredUserId: p.userId,
            grossAmount: p.amount,
            commissionAmount,
            currency: p.currency,
            status: rejectionReason
              ? (rejectionReason === 'repeat_referral' ? 'rejected_repeat' : 'rejected_self_referral')
              : 'pending',
            metadata: {
              refCode,
              rejectionReason,
              payingUserId: p.userId,
              payingEmail: paying?.email ?? null,
            },
          })

          if (!rejectionReason) {
            // Update rolling totals + credited-users list.
            const nextCreditedUserIds = [...(aff.creditedUserIds ?? []), p.userId].slice(-500)
            await db
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

          await db.insert(auditLog).values({
            id: createId(),
            actorId: aff.userId,
            action: rejectionReason ? 'affiliate.credit_rejected' : 'affiliate.credit',
            resource: `affiliate:${aff.id}`,
            metadata: {
              paymentId: p.id,
              referredUserId: p.userId,
              gross: p.amount,
              commission: commissionAmount,
              currency: p.currency,
              rejectionReason,
            },
          })
        }
      }
    }
  } catch (e) {
    console.error('[webhook] affiliate credit failed:', e)
  }

  // ── Email side-effect — send the license key + receipt ─────
  // Always run after the DB has been updated. Failures are logged
  // but don't fail the webhook.
  try {
    if (p.userId) {
      const customer = (await db.select().from(user).where(eq(user.id, p.userId)).limit(1))[0]
      if (customer) {
        const dateStr = new Date(p.paidAt ?? Date.now()).toISOString().slice(0, 10)
        const variant = postLicense?.variant ?? 'pro'
        const downloadUrl = `https://omnix.co.ke/downloads`

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
          }).catch((e) => console.error('[webhook] license-key email failed:', e))
        } else {
          await sendPaymentReceiptEmail({
            to: customer.email,
            customerName: customer.name ?? customer.email.split('@')[0],
            amount: p.amount,
            currency: p.currency,
            reference,
            purpose: p.purpose,
            date: dateStr,
          }).catch((e) => console.error('[webhook] receipt email failed:', e))
        }
      }
    }
  } catch (e) {
    console.error('[webhook] email dispatch error:', e)
  }

  return Response.json({ ok: true })
}
