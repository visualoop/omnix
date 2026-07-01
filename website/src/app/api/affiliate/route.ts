/**
 * Affiliate signup + self-read.
 *
 *   POST /api/affiliate   — sign the current user up as an affiliate (idempotent — returns existing).
 *                            Body: { displayName?, contactPhone?, payoutMethod?, payoutDetails? }
 *   GET  /api/affiliate   — return the current user's affiliate row (or 404).
 *   PATCH /api/affiliate  — update payout details, display name, contact info.
 */
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import crypto from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db, affiliates, auditLog } from '@/db'
import { auth } from '@/lib/auth'
import { createId } from '@/lib/ids'

export const runtime = 'nodejs'

async function requireAuth() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return { error: NextResponse.json({ error: 'Sign in' }, { status: 401 }), session: null }
  return { error: null, session }
}

/** Generate a short, humane, unambiguous ref code (8 chars). */
function generateRefCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 8; i += 1) out += alphabet[crypto.randomInt(0, alphabet.length)]
  return out
}

async function newUniqueRefCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = generateRefCode()
    const existing = await db.select({ id: affiliates.id }).from(affiliates).where(eq(affiliates.refCode, candidate)).limit(1)
    if (existing.length === 0) return candidate
  }
  throw new Error('Could not generate unique ref code after 10 attempts')
}

export async function GET() {
  const a = await requireAuth()
  if (a.error) return a.error
  const session = a.session!

  const [aff] = await db.select().from(affiliates).where(eq(affiliates.userId, session.user.id)).limit(1)
  if (!aff) return NextResponse.json({ ok: false, error: 'Not an affiliate' }, { status: 404 })
  return NextResponse.json({ ok: true, affiliate: aff })
}

interface PostBody {
  displayName?: string
  contactPhone?: string
  contactEmail?: string
  payoutMethod?: string
  payoutDetails?: Record<string, string>
  commissionCurrency?: string
}

export async function POST(req: NextRequest) {
  const a = await requireAuth()
  if (a.error) return a.error
  const session = a.session!
  const body = (await req.json().catch(() => null)) as PostBody | null

  const [existing] = await db.select().from(affiliates).where(eq(affiliates.userId, session.user.id)).limit(1)
  if (existing) {
    return NextResponse.json({ ok: true, affiliate: existing, created: false })
  }

  const refCode = await newUniqueRefCode()
  const id = createId()
  await db.insert(affiliates).values({
    id,
    userId: session.user.id,
    refCode,
    displayName: body?.displayName?.trim() || session.user.name || null,
    contactEmail: body?.contactEmail?.trim() || session.user.email,
    contactPhone: body?.contactPhone?.trim() || null,
    payoutMethod: body?.payoutMethod?.trim() || null,
    payoutDetails: body?.payoutDetails ?? {},
    commissionCurrency: body?.commissionCurrency?.toUpperCase() || 'KES',
    approvedAt: new Date(),   // self-signup is auto-approved; admin can block via /admin
  })

  await db.insert(auditLog).values({
    id: createId(),
    actorId: session.user.id,
    action: 'affiliate.signup',
    resource: `affiliate:${id}`,
    metadata: { refCode, displayName: body?.displayName ?? null },
  })

  const [created] = await db.select().from(affiliates).where(eq(affiliates.id, id)).limit(1)
  return NextResponse.json({ ok: true, affiliate: created, created: true })
}

export async function PATCH(req: NextRequest) {
  const a = await requireAuth()
  if (a.error) return a.error
  const session = a.session!
  const body = (await req.json().catch(() => null)) as PostBody | null

  const [existing] = await db.select().from(affiliates).where(eq(affiliates.userId, session.user.id)).limit(1)
  if (!existing) return NextResponse.json({ error: 'Not an affiliate' }, { status: 404 })
  if (existing.blocked) return NextResponse.json({ error: 'Affiliate account blocked' }, { status: 403 })

  const updates: Partial<typeof affiliates.$inferInsert> = { updatedAt: new Date() }
  if (body?.displayName !== undefined) updates.displayName = body.displayName.trim() || null
  if (body?.contactEmail !== undefined) updates.contactEmail = body.contactEmail.trim() || null
  if (body?.contactPhone !== undefined) updates.contactPhone = body.contactPhone.trim() || null
  if (body?.payoutMethod !== undefined) updates.payoutMethod = body.payoutMethod.trim() || null
  if (body?.payoutDetails !== undefined) updates.payoutDetails = body.payoutDetails
  if (body?.commissionCurrency) updates.commissionCurrency = body.commissionCurrency.toUpperCase()

  await db.update(affiliates).set(updates).where(eq(affiliates.id, existing.id))

  await db.insert(auditLog).values({
    id: createId(),
    actorId: session.user.id,
    action: 'affiliate.update',
    resource: `affiliate:${existing.id}`,
    metadata: { updates: Object.keys(updates) },
  })

  return NextResponse.json({ ok: true })
}
