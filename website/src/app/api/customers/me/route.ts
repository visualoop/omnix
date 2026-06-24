/**
 * PATCH /api/customers/me — save the signed-in user's profile.
 *
 * Updates the user table's column-backed customer fields (phone,
 * business name, country, currency). Ancillary fields (KRA PIN,
 * county, town, address, business type, team size, WhatsApp) were
 * supposed to live on a `metadata` jsonb column added in migration
 * 0002 — that column hasn't been applied to production yet, so we
 * silently drop those fields here until the migration runs. Once
 * production has the column, restore the metadata write block.
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
  // Fields below are accepted but ignored until the metadata column lands.
  whatsapp?: string
  kraPin?: string
  county?: string
  town?: string
  physicalAddress?: string
  businessType?: string
  employeeCount?: string
  newsletterOptIn?: boolean
}

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

  // Build the column update. Drop unknown fields silently — they're
  // either reserved for the metadata column we haven't deployed yet,
  // or they're noise we don't want to write to the user row.
  const update: Partial<typeof user.$inferInsert> = {}
  if (body.fullName !== undefined) update.name = body.fullName
  if (body.businessName !== undefined) update.businessName = body.businessName
  if (body.phone !== undefined) update.phoneNumber = body.phone
  if (body.country !== undefined) update.country = body.country
  if (body.currency !== undefined) update.currency = body.currency

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, applied: 0 })
  }

  try {
    await db
      .update(user)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(user.id, session.user.id))
  } catch (err) {
    return NextResponse.json(
      { errors: [{ message: err instanceof Error ? err.message : String(err) }] },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
