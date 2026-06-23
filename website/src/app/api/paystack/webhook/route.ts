import crypto from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db, payments, licenses, auditLog } from '@/db'
import { verify } from '@/lib/paystack'
import { createId } from '@/lib/ids'
import { getSetting } from '@/lib/platform-settings'

/**
 * Paystack webhook handler. Verifies HMAC signature, then applies
 * the result idempotently (matched by paystack_reference).
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

  // Apply side-effects per purpose.
  if (p.licenseId) {
    const now = new Date()
    if (p.purpose === 'license_fee') {
      await db
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
    } else if (p.purpose === 'maintenance_renewal') {
      // Extend by 1 year from current end-or-now.
      const lic = (await db.select().from(licenses).where(eq(licenses.id, p.licenseId)).limit(1))[0]
      const base = lic?.maintenanceUntil && lic.maintenanceUntil > now ? lic.maintenanceUntil : now
      const newEnd = new Date(base.getTime() + 365 * 24 * 60 * 60 * 1000)
      await db.update(licenses).set({ maintenanceUntil: newEnd, updatedAt: now }).where(eq(licenses.id, p.licenseId))
    } else if (p.purpose === 'cloud_backup') {
      const lic = (await db.select().from(licenses).where(eq(licenses.id, p.licenseId)).limit(1))[0]
      const base = lic?.cloudBackupExpiresAt && lic.cloudBackupExpiresAt > now ? lic.cloudBackupExpiresAt : now
      const newEnd = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000)
      await db.update(licenses).set({ cloudBackupEnabled: true, cloudBackupExpiresAt: newEnd, updatedAt: now }).where(eq(licenses.id, p.licenseId))
    } else if (p.purpose === 'major_upgrade') {
      await db.update(licenses).set({ majorVersionCap: 2, updatedAt: now }).where(eq(licenses.id, p.licenseId))
    } else if (p.purpose === 'extra_branch') {
      const lic = (await db.select().from(licenses).where(eq(licenses.id, p.licenseId)).limit(1))[0]
      if (lic) {
        await db.update(licenses).set({ maxBranches: lic.maxBranches + 1, updatedAt: now }).where(eq(licenses.id, p.licenseId))
      }
    } else if (p.purpose === 'extra_machine') {
      const lic = (await db.select().from(licenses).where(eq(licenses.id, p.licenseId)).limit(1))[0]
      if (lic) {
        await db.update(licenses).set({ maxMachines: lic.maxMachines + 1, updatedAt: now }).where(eq(licenses.id, p.licenseId))
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

  return Response.json({ ok: true })
}
