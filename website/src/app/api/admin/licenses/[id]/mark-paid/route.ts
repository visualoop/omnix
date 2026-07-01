/**
 * POST /api/admin/licenses/[id]/mark-paid
 *
 * Admin records a manual payment against a licence — used when the
 * customer paid via M-Pesa Paybill/Till directly (outside Paystack) or
 * paid the admin in cash. Creates a Paystack-parallel `payments` row
 * with a synthetic reference so downstream reporting (VAT, eTIMS,
 * license.status) treats it identically to a Paystack payment.
 *
 * Body: {
 *   amount: number,
 *   currency?: string,
 *   purpose?: 'license_fee' | 'maintenance_renewal' | ...,
 *   reference?: string,   // M-Pesa code the admin captured from the till
 *   note?: string
 * }
 *
 * Side effects:
 *   - Inserts a `payments` row with paystackReference = `manual:<random>`
 *   - If purpose = 'license_fee' and the licence is on trial, promotes
 *     to status='active', tier='paid'
 *   - Extends maintenanceUntil by one year on maintenance/major-upgrade
 *   - Writes an audit_log entry
 */
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import crypto from 'node:crypto'
import { db, licenses, payments, auditLog } from '@/db'
import { auth } from '@/lib/auth'
import { createId } from '@/lib/ids'

export const runtime = 'nodejs'

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return { error: NextResponse.json({ error: 'Sign in' }, { status: 401 }), session: null }
  if (session.user.role !== 'platform_admin') {
    return { error: NextResponse.json({ error: 'Admin only' }, { status: 403 }), session: null }
  }
  return { error: null, session }
}

interface Body {
  amount?: number
  currency?: string
  purpose?: string
  reference?: string
  note?: string
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireAdmin()
  if (a.error) return a.error
  const session = a.session!

  const { id: licenseId } = await ctx.params
  const body = (await req.json().catch(() => null)) as Body | null
  const amount = Number(body?.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: 'amount (positive number) is required' }, { status: 400 })
  }

  const [lic] = await db.select().from(licenses).where(eq(licenses.id, licenseId)).limit(1)
  if (!lic) {
    return Response.json({ error: 'Licence not found' }, { status: 404 })
  }

  const purpose = body?.purpose ?? 'license_fee'
  const currency = body?.currency ?? lic.currency ?? 'KES'
  const paymentId = createId()
  const now = new Date()
  const reference = body?.reference?.trim() || `manual-mpesa:${crypto.randomBytes(4).toString('hex')}`

  await db.insert(payments).values({
    id: paymentId,
    userId: lic.userId,
    organizationId: lic.organizationId,
    licenseId: lic.id,
    paystackReference: `manual:${reference}:${paymentId.slice(0, 6)}`,
    purpose,
    amount,
    currency,
    status: 'success',
    paidAt: now,
    metadata: {
      source: 'admin_manual',
      adminActorId: session.user.id,
      reference,
      note: body?.note ?? null,
    },
  })

  // Promote trial → paid on licence_fee. Extend maintenance on renewals.
  const updates: Partial<typeof licenses.$inferInsert> = { updatedAt: now }
  if (purpose === 'license_fee' && lic.status === 'trial') {
    updates.status = 'active'
    updates.tier = 'paid'
    // Trial → paid: give a fresh 12-month maintenance window.
    updates.maintenanceUntil = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
  } else if (purpose === 'maintenance_renewal' || purpose === 'major_upgrade') {
    const base = lic.maintenanceUntil && lic.maintenanceUntil > now ? lic.maintenanceUntil : now
    updates.maintenanceUntil = new Date(base.getTime() + 365 * 24 * 60 * 60 * 1000)
  }
  if (Object.keys(updates).length > 1) {
    await db.update(licenses).set(updates).where(eq(licenses.id, lic.id))
  }

  await db.insert(auditLog).values({
    id: createId(),
    actorId: session.user.id,
    action: 'payment.manual_record',
    resource: `payment:${paymentId}`,
    metadata: {
      licenseId: lic.id,
      variant: lic.variant,
      amount,
      currency,
      purpose,
      reference,
      note: body?.note ?? null,
    },
  })

  return Response.json({
    ok: true,
    payment: { id: paymentId, amount, currency, purpose, reference, status: 'success' },
    license: { id: lic.id, status: updates.status ?? lic.status, tier: updates.tier ?? lic.tier },
  })
}
