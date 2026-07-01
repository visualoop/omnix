/**
 * Admin promotes / manages resellers for a user.
 *
 *   POST   /api/admin/users/[id]/reseller          — promote (body: { companyName, discountPercent? })
 *   PATCH  /api/admin/users/[id]/reseller          — update (body: { discountPercent?, status?, companyName?, contactPhone? })
 *   DELETE /api/admin/users/[id]/reseller          — demote (soft: sets status='suspended', keeps history)
 *
 * All actions write an audit_log row.
 */
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db, user, resellers, auditLog } from '@/db'
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

const clampDiscount = (n: unknown): number => {
  const v = Number(n)
  if (!Number.isFinite(v)) return 15
  return Math.min(Math.max(Math.round(v), 0), 60) // 0-60% ceiling — anything higher warrants a manual conversation
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireAdmin()
  if (a.error) return a.error
  const session = a.session!

  const { id: userId } = await ctx.params
  const body = (await req.json().catch(() => null)) as
    | { companyName?: string; contactPhone?: string; contactEmail?: string; discountPercent?: number; commissionCurrency?: string }
    | null

  const target = (await db.select().from(user).where(eq(user.id, userId)).limit(1))[0]
  if (!target) return Response.json({ error: 'User not found' }, { status: 404 })

  const existing = (await db.select().from(resellers).where(eq(resellers.userId, userId)).limit(1))[0]
  if (existing) {
    // Idempotent — reactivate if suspended, refresh discount.
    const updates: Partial<typeof resellers.$inferInsert> = { updatedAt: new Date() }
    if (existing.status === 'suspended') updates.status = 'active'
    if (body?.discountPercent !== undefined) updates.discountPercent = clampDiscount(body.discountPercent)
    if (body?.companyName) updates.companyName = body.companyName.trim()
    if (body?.contactPhone !== undefined) updates.contactPhone = body.contactPhone.trim() || null
    if (body?.contactEmail !== undefined) updates.contactEmail = body.contactEmail.trim() || null
    if (body?.commissionCurrency) updates.commissionCurrency = body.commissionCurrency.toUpperCase()
    await db.update(resellers).set(updates).where(eq(resellers.id, existing.id))

    await db.insert(auditLog).values({
      id: createId(),
      actorId: session.user.id,
      action: 'reseller.reactivate',
      resource: `reseller:${existing.id}`,
      metadata: { userId, updates },
    })

    return Response.json({ ok: true, resellerId: existing.id, created: false })
  }

  const resellerId = createId()
  await db.insert(resellers).values({
    id: resellerId,
    userId,
    companyName: body?.companyName?.trim() || target.businessName || target.name,
    contactPhone: body?.contactPhone?.trim() || target.phoneNumber || null,
    contactEmail: body?.contactEmail?.trim() || target.email,
    discountPercent: clampDiscount(body?.discountPercent ?? 15),
    commissionCurrency: (body?.commissionCurrency?.toUpperCase() || target.currency || 'KES'),
    status: 'active',
    approvedBy: session.user.id,
    approvedAt: new Date(),
    metadata: { adminActorId: session.user.id },
  })

  await db.insert(auditLog).values({
    id: createId(),
    actorId: session.user.id,
    action: 'reseller.promote',
    resource: `reseller:${resellerId}`,
    metadata: {
      userId,
      companyName: body?.companyName ?? target.businessName ?? target.name,
      discountPercent: clampDiscount(body?.discountPercent ?? 15),
    },
  })

  return Response.json({ ok: true, resellerId, created: true })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireAdmin()
  if (a.error) return a.error
  const session = a.session!

  const { id: userId } = await ctx.params
  const body = (await req.json().catch(() => null)) as
    | { discountPercent?: number; status?: string; companyName?: string; contactPhone?: string; contactEmail?: string; commissionCurrency?: string }
    | null

  const existing = (await db.select().from(resellers).where(eq(resellers.userId, userId)).limit(1))[0]
  if (!existing) return Response.json({ error: 'User is not a reseller' }, { status: 404 })

  const updates: Partial<typeof resellers.$inferInsert> = { updatedAt: new Date() }
  if (body?.discountPercent !== undefined) updates.discountPercent = clampDiscount(body.discountPercent)
  if (body?.status && ['active', 'suspended'].includes(body.status)) updates.status = body.status
  if (body?.companyName) updates.companyName = body.companyName.trim()
  if (body?.contactPhone !== undefined) updates.contactPhone = body.contactPhone.trim() || null
  if (body?.contactEmail !== undefined) updates.contactEmail = body.contactEmail.trim() || null
  if (body?.commissionCurrency) updates.commissionCurrency = body.commissionCurrency.toUpperCase()

  await db.update(resellers).set(updates).where(eq(resellers.id, existing.id))

  await db.insert(auditLog).values({
    id: createId(),
    actorId: session.user.id,
    action: 'reseller.update',
    resource: `reseller:${existing.id}`,
    metadata: { userId, updates },
  })

  return Response.json({ ok: true, resellerId: existing.id })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireAdmin()
  if (a.error) return a.error
  const session = a.session!

  const { id: userId } = await ctx.params
  const existing = (await db.select().from(resellers).where(eq(resellers.userId, userId)).limit(1))[0]
  if (!existing) return Response.json({ error: 'User is not a reseller' }, { status: 404 })

  await db.update(resellers).set({ status: 'suspended', updatedAt: new Date() }).where(eq(resellers.id, existing.id))

  await db.insert(auditLog).values({
    id: createId(),
    actorId: session.user.id,
    action: 'reseller.suspend',
    resource: `reseller:${existing.id}`,
    metadata: { userId },
  })

  return Response.json({ ok: true, resellerId: existing.id, status: 'suspended' })
}
