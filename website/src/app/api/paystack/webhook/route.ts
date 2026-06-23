import crypto from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db, payments, licenses, auditLog, user } from '@/db'
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
 *   Sign with paystack.webhook_secret (admin-editable in /admin/settings).
 */
export async function POST(req: Request) {
  const sig = req.headers.get('x-paystack-signature') ?? ''
  const secret = await getSetting('paystack.webhook_secret')
  const raw = await req.text()
  if (!secret) {
    return Response.json({ error: 'paystack.webhook_secret not configured' }, { status: 500 })
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
