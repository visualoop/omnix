/**
 * PATCH /api/customers/me — save the signed-in user's profile.
 *
 * Updates the user table's first-class customer fields (phone, business
 * name) and stashes ancillary fields (KRA PIN, county, town, address,
 * business type, team size, WhatsApp, newsletter) on a small JSON
 * metadata column we read back in /dashboard/profile.
 */
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, user } from '@/db'
import { auth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Payload = {
  fullName?: string
  businessName?: string
  phone?: string
  whatsapp?: string
  kraPin?: string
  county?: string
  town?: string
  physicalAddress?: string
  businessType?: string
  employeeCount?: string
  newsletterOptIn?: boolean
}

const COLUMN_FIELDS = ['fullName', 'businessName', 'phone'] as const
const META_FIELDS = ['whatsapp', 'kraPin', 'county', 'town', 'physicalAddress', 'businessType', 'employeeCount', 'newsletterOptIn'] as const

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) {
    return NextResponse.json({ errors: [{ message: 'Not signed in' }] }, { status: 401 })
  }

  let body: Payload
  try {
    body = (await req.json()) as Payload
  } catch {
    return NextResponse.json({ errors: [{ message: 'Invalid JSON body' }] }, { status: 400 })
  }

  // Pull existing row so we can merge into metadata.
  const rows = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)
  const existing = rows[0]
  if (!existing) {
    return NextResponse.json({ errors: [{ message: 'User not found' }] }, { status: 404 })
  }

  const existingMeta =
    (existing as unknown as { metadata?: Record<string, unknown> }).metadata ?? {}
  const newMeta: Record<string, unknown> = { ...existingMeta }
  for (const k of META_FIELDS) {
    if (body[k] !== undefined) newMeta[k] = body[k]
  }

  // Build column update set
  const update: Record<string, string | undefined> = {}
  if (body.fullName !== undefined) update.name = body.fullName
  if (body.businessName !== undefined) update.businessName = body.businessName
  if (body.phone !== undefined) update.phoneNumber = body.phone

  try {
    await db
      .update(user)
      // Drizzle requires the table column names; use a typed cast for metadata.
      .set({
        ...(update as Partial<typeof user.$inferSelect>),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: newMeta as any,
        updatedAt: new Date(),
      })
      .where(eq(user.id, session.user.id))
  } catch (err) {
    return NextResponse.json(
      { errors: [{ message: err instanceof Error ? err.message : String(err) }] },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
