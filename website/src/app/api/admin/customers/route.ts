/**
 * POST /api/admin/customers
 *
 * Admin creates a new customer account without going through the public
 * signup flow. Useful for shops that don't want to give out an email
 * (walk-ins, referrals, phone-only orgs).
 *
 * Body: {
 *   orgName: string (required),
 *   email?: string,
 *   phoneNumber?: string,
 *   country?: string,
 *   currency?: string,
 *   issueTrialVariant?: 'dawa' | 'retail' | 'hospitality' | 'hardware' | 'salon'
 * }
 *
 * Returns:
 *   {
 *     ok: true,
 *     user: { id, email, name },
 *     tempPassword: string,   // 10-char, admin passes to customer
 *     license?: { id, licenseKey, variant, trialEndsAt }
 *   }
 *
 * When no email is provided, we synthesize `admin+<random>@omnix-customer.local`
 * so Better Auth's NOT NULL UNIQUE email constraint is satisfied. The
 * customer replaces the placeholder from /dashboard/profile when they're
 * ready to use email-based login.
 */
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import crypto from 'node:crypto'
import { db, user, licenses, auditLog } from '@/db'
import { createId } from '@/lib/ids'
import { modulesForVariant } from '@/lib/license-modules'
import { auth } from '@/lib/auth'

export const runtime = 'nodejs'

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return { error: NextResponse.json({ ok: false, error: 'Sign in' }, { status: 401 }), session: null }
  if (session.user.role !== 'platform_admin') {
    return { error: NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 }), session: null }
  }
  return { error: null, session }
}

const ALLOWED_VARIANTS = ['dawa', 'retail', 'hospitality', 'hardware', 'salon'] as const
type Variant = (typeof ALLOWED_VARIANTS)[number]

interface CreateBody {
  orgName?: string
  email?: string
  phoneNumber?: string
  country?: string
  currency?: string
  issueTrialVariant?: string
}

function generatePassword(len = 10): string {
  // Alphanumeric, no ambiguous characters — easy for admin to dictate over phone.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz'
  let out = ''
  for (let i = 0; i < len; i += 1) {
    out += alphabet[crypto.randomInt(0, alphabet.length)]
  }
  return out
}

function makeLicenseKey(variant: Variant): string {
  const shortVariant = variant === 'hospitality' ? 'HOSP' : variant === 'hardware' ? 'HW' : variant.toUpperCase()
  const seg = () => crypto.randomBytes(2).toString('hex').toUpperCase()
  return `OMNIX-${shortVariant}-${seg()}-${seg()}-${seg()}`
}

export async function POST(req: NextRequest) {
  const a = await requireAdmin()
  if (a.error) return a.error
  const session = a.session!

  const body = (await req.json().catch(() => null)) as CreateBody | null
  const orgName = body?.orgName?.trim()
  if (!orgName) {
    return Response.json({ error: 'orgName is required' }, { status: 400 })
  }

  const providedEmail = body?.email?.toLowerCase().trim() || null
  const email = providedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(providedEmail)
    ? providedEmail
    : `admin+${crypto.randomBytes(4).toString('hex')}@omnix-customer.local`

  // Refuse to create if the email is already taken.
  const existing = (await db.select().from(user).where(eq(user.email, email)).limit(1))[0]
  if (existing) {
    return Response.json(
      { error: 'A customer already exists with that email. Search /admin/users instead.' },
      { status: 409 },
    )
  }

  const country = body?.country?.toUpperCase().trim() || 'KE'
  const currency = body?.currency?.toUpperCase().trim() || (country === 'KE' ? 'KES' : 'USD')
  const tempPassword = generatePassword(10)

  // Better Auth exposes admin.createUser which handles hashing.
  let createdUserId: string
  try {
    const result = await auth.api.createUser({
      body: {
        email,
        password: tempPassword,
        name: orgName,
        data: {
          businessName: orgName,
          phoneNumber: body?.phoneNumber ?? undefined,
          country,
          currency,
          metadata: {
            createdBy: 'admin',
            adminActorId: session.user.id,
            hasRealEmail: !!providedEmail,
          },
        },
      },
      headers: req.headers,
    })
    // Better Auth's createUser returns { user: { id, ... } } — see the docs.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createdUserId = (result as any)?.user?.id
    if (!createdUserId) throw new Error('user creation returned no id')
  } catch (e) {
    console.error('[admin/customers] createUser failed:', e)
    return Response.json({ error: `Could not create user: ${String(e)}` }, { status: 500 })
  }

  // Optional trial licence.
  let licenseRow: { id: string; licenseKey: string; variant: Variant; trialEndsAt: Date } | null = null
  const requestedVariant = body?.issueTrialVariant?.toLowerCase().trim() as Variant | undefined
  if (requestedVariant && ALLOWED_VARIANTS.includes(requestedVariant)) {
    const licenseId = createId()
    const now = new Date()
    const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const licenseKey = makeLicenseKey(requestedVariant)
    await db.insert(licenses).values({
      id: licenseId,
      userId: createdUserId,
      licenseKey,
      variant: requestedVariant,
      tier: 'trial',
      status: 'trial',
      modules: modulesForVariant(requestedVariant),
      maxBranches: 1,
      maxMachines: 3,
      trialStartedAt: now,
      trialEndsAt: trialEnd,
      currency,
      metadata: { source: 'admin-created' },
    })
    licenseRow = { id: licenseId, licenseKey, variant: requestedVariant, trialEndsAt: trialEnd }
  }

  await db.insert(auditLog).values({
    id: createId(),
    actorId: session.user.id,
    action: 'customer.admin_create',
    resource: `user:${createdUserId}`,
    metadata: {
      orgName,
      email,
      hasRealEmail: !!providedEmail,
      issuedTrialVariant: licenseRow?.variant ?? null,
      licenseId: licenseRow?.id ?? null,
    },
  })

  // Verify the query link is consistent — surface a warning if the audit
  // check fails but don't fail the whole request.
  try {
    const checkLic = await db
      .select({ id: licenses.id })
      .from(licenses)
      .where(and(eq(licenses.userId, createdUserId), licenseRow ? eq(licenses.id, licenseRow.id) : eq(licenses.userId, createdUserId)))
      .limit(1)
    if (licenseRow && !checkLic[0]) {
      console.warn('[admin/customers] licence insert did not commit — verify DB')
    }
  } catch {
    // Non-fatal
  }

  return Response.json({
    ok: true,
    user: { id: createdUserId, email, name: orgName },
    tempPassword,
    license: licenseRow,
  })
}
