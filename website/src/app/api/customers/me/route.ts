/**
 * PATCH /api/customers/me — save the signed-in user's profile.
 *
 * Updates the user table's column-backed customer fields (phone,
 * business name, country, currency) and stashes ancillary fields
 * (KRA PIN, county, town, address, business type, team size, WhatsApp,
 * newsletter pref) on a `metadata` jsonb column.
 *
 * Metadata writes are a deep-merge — fields the caller didn't pass
 * stay as they were, so the onboarding wizard + the profile form can
 * each write a partial subset without clobbering each other.
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
  country?: string
  currency?: string
  // Stored on metadata jsonb
  whatsapp?: string
  kraPin?: string
  county?: string
  town?: string
  physicalAddress?: string
  businessType?: string
  employeeCount?: string
  newsletterOptIn?: boolean
}

const COLUMN_FIELDS = ['fullName', 'businessName', 'phone', 'country', 'currency'] as const
const META_FIELDS = [
  'whatsapp',
  'kraPin',
  'county',
  'town',
  'physicalAddress',
  'businessType',
  'employeeCount',
  'newsletterOptIn',
] as const

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

  // Pull existing row so we can deep-merge metadata.
  const rows = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)
  const existing = rows[0]
  if (!existing) {
    return NextResponse.json({ errors: [{ message: 'User not found' }] }, { status: 404 })
  }

  const existingMeta =
    (existing as unknown as { metadata?: Record<string, unknown> }).metadata ?? {}
  const newMeta: Record<string, unknown> = { ...existingMeta }
  let metaChanged = false
  for (const k of META_FIELDS) {
    if (body[k] !== undefined) {
      newMeta[k] = body[k]
      metaChanged = true
    }
  }

  // Build the column update.
  const update: Partial<typeof user.$inferInsert> = {}
  if (body.fullName !== undefined) update.name = body.fullName
  if (body.businessName !== undefined) update.businessName = body.businessName
  if (body.phone !== undefined) update.phoneNumber = body.phone
  if (body.country !== undefined) update.country = body.country
  if (body.currency !== undefined) update.currency = body.currency

  if (Object.keys(update).length === 0 && !metaChanged) {
    return NextResponse.json({ ok: true, applied: 0 })
  }

  try {
    await db
      .update(user)
      .set({
        ...update,
        ...(metaChanged ? { metadata: newMeta as never } : {}),
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

// Constants exported for tests + future cron jobs that touch profile data.
export { COLUMN_FIELDS, META_FIELDS }
