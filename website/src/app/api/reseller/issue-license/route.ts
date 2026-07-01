/**
 * POST /api/reseller/issue-license
 *
 * Reseller-initiated licence creation. Authenticated as the reseller
 * (must have an active `resellers` row). Creates:
 *   1. Customer user row (or reuses if email matches an existing account)
 *   2. Licence row in status='trial' with resellerId set + a fresh licence key
 *   3. Paystack transaction at wholesale price (retail × (1 − discount%))
 *   4. Pending payments row tied to the licence
 *
 * Returns the Paystack authorizationUrl — the reseller pays now with
 * their card/M-Pesa. On charge.success the webhook flips the licence
 * to active, credits the reseller's commission, and sends the customer
 * their licence-key email as normal.
 *
 * Body: {
 *   customerName: string        // organisation name
 *   customerEmail?: string      // if omitted, we synthesize a placeholder
 *   customerPhone?: string
 *   country?: string            // default 'KE'
 *   currency?: string           // default from reseller.commissionCurrency
 *   variant: 'dawa' | 'retail' | 'hospitality' | 'hardware'
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import crypto from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db, user, licenses, payments, resellers, auditLog } from '@/db'
import { auth } from '@/lib/auth'
import { newReference, initTransaction } from '@/lib/paystack'
import { pricingFor, type SupportedCurrency } from '@/config/pricing'
import { createId } from '@/lib/ids'
import { modulesForVariant } from '@/lib/license-modules'

export const runtime = 'nodejs'

const ALLOWED_VARIANTS = ['dawa', 'retail', 'hospitality', 'hardware'] as const
type Variant = (typeof ALLOWED_VARIANTS)[number]

interface Body {
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  country?: string
  currency?: string
  variant?: string
}

function makeLicenseKey(variant: Variant): string {
  const short = variant === 'hospitality' ? 'HOSP' : variant === 'hardware' ? 'HW' : variant.toUpperCase()
  const seg = () => crypto.randomBytes(2).toString('hex').toUpperCase()
  return `OMNIX-${short}-${seg()}-${seg()}-${seg()}`
}

function generatePassword(len = 10): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz'
  let out = ''
  for (let i = 0; i < len; i += 1) out += alphabet[crypto.randomInt(0, alphabet.length)]
  return out
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return NextResponse.json({ error: 'Sign in' }, { status: 401 })

  const [reseller] = await db.select().from(resellers).where(eq(resellers.userId, session.user.id)).limit(1)
  if (!reseller) return NextResponse.json({ error: 'Not a reseller' }, { status: 403 })
  if (reseller.status !== 'active') return NextResponse.json({ error: 'Reseller account suspended — contact support' }, { status: 403 })

  const body = (await req.json().catch(() => null)) as Body | null
  const customerName = body?.customerName?.trim()
  if (!customerName) return NextResponse.json({ error: 'customerName is required' }, { status: 400 })

  const variant = body?.variant?.toLowerCase().trim() as Variant | undefined
  if (!variant || !ALLOWED_VARIANTS.includes(variant)) {
    return NextResponse.json({ error: `variant must be one of ${ALLOWED_VARIANTS.join(', ')}` }, { status: 400 })
  }

  const country = body?.country?.toUpperCase().trim() || 'KE'
  const currency = (body?.currency?.toUpperCase().trim() || reseller.commissionCurrency || 'KES') as SupportedCurrency
  const p = pricingFor(currency)
  const retail = p.starter.oneTimeFee
  const wholesale = Math.round(retail * (1 - reseller.discountPercent / 100))
  if (wholesale <= 0) return NextResponse.json({ error: 'Wholesale price is zero or negative — check reseller discount config' }, { status: 400 })

  // Reuse existing customer if the email matches; otherwise create one.
  const providedEmail = body?.customerEmail?.toLowerCase().trim() || null
  const email = providedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(providedEmail)
    ? providedEmail
    : `reseller+${crypto.randomBytes(4).toString('hex')}@omnix-customer.local`

  let customerId: string
  const existing = (await db.select().from(user).where(eq(user.email, email)).limit(1))[0]
  if (existing) {
    customerId = existing.id
  } else {
    const tempPassword = generatePassword(10)
    try {
      const result = await auth.api.createUser({
        body: {
          email,
          password: tempPassword,
          name: customerName,
          data: {
            businessName: customerName,
            phoneNumber: body?.customerPhone ?? undefined,
            country,
            currency,
            metadata: {
              createdBy: 'reseller',
              resellerId: reseller.id,
              hasRealEmail: !!providedEmail,
            },
          },
        },
        headers: req.headers,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customerId = (result as any)?.user?.id
      if (!customerId) throw new Error('createUser returned no id')
    } catch (e) {
      return NextResponse.json({ error: `Could not create customer: ${String(e)}` }, { status: 500 })
    }
  }

  // Create the licence in `trial` status. The webhook will promote to
  // `active` on charge.success. Storing resellerId here means the
  // commission credit path in the webhook picks this up automatically.
  const licenseId = createId()
  const now = new Date()
  await db.insert(licenses).values({
    id: licenseId,
    userId: customerId,
    licenseKey: makeLicenseKey(variant),
    variant,
    tier: 'trial',
    status: 'trial',
    modules: modulesForVariant(variant),
    maxBranches: 1,
    maxMachines: 3,
    resellerId: reseller.id,
    origin: 'admin_issued',
    trialStartedAt: now,
    trialEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    currency,
    metadata: { source: 'reseller-issued', resellerCompany: reseller.companyName },
  })

  // Initialise Paystack at wholesale. Reseller pays; the reseller's
  // email is used since we're charging them, not the customer.
  const reference = newReference('OMX-RS')
  let init
  try {
    init = await initTransaction({
      email: reseller.contactEmail || session.user.email,
      amountSmallestUnit: wholesale * 100,
      currency,
      reference,
      metadata: {
        license_id: licenseId,
        customer_id: customerId,
        reseller_id: reseller.id,
        wholesale_amount: wholesale,
        retail_amount: retail,
        discount_percent: reseller.discountPercent,
        purpose: 'license_fee',
      },
    })
  } catch (e) {
    // Roll back the licence row so we don't leave dangling reseller
    // licences with no payment attached.
    await db.delete(licenses).where(eq(licenses.id, licenseId))
    return NextResponse.json({ error: `Paystack init failed: ${String(e)}` }, { status: 502 })
  }

  await db.insert(payments).values({
    id: createId(),
    userId: reseller.userId,      // reseller pays the wholesale amount
    licenseId,
    paystackReference: reference,
    purpose: 'license_fee',
    amount: wholesale,
    currency,
    status: 'pending',
    metadata: {
      source: 'reseller_wholesale',
      resellerId: reseller.id,
      customerId,
      retail,
      discountPercent: reseller.discountPercent,
    },
  })

  await db.insert(auditLog).values({
    id: createId(),
    actorId: reseller.userId,
    action: 'reseller.issue_license',
    resource: `license:${licenseId}`,
    metadata: {
      resellerId: reseller.id,
      customerId,
      customerName,
      variant,
      wholesale,
      retail,
      discountPercent: reseller.discountPercent,
      currency,
      paystackReference: reference,
    },
  })

  return NextResponse.json({
    ok: true,
    licenseId,
    customerId,
    wholesale,
    retail,
    savings: retail - wholesale,
    currency,
    paystack: {
      reference,
      authorizationUrl: init.authorizationUrl,
      accessCode: init.accessCode,
    },
  })
}
