import type { Endpoint } from 'payload'
import { errorResponse, jsonResponse, readJson } from './_auth'
import { computeAmount, newReference, type Purpose, type PricingShape, type CheckoutCurrency } from '../lib/paystack'
import { resolveSettings } from '../lib/settings'

const PAYSTACK_CURRENCIES: CheckoutCurrency[] = ['KES', 'USD', 'NGN', 'GHS', 'ZAR']

function pickCurrency(req: { headers: Headers }): CheckoutCurrency {
  // 1) Explicit ?currency= query param (testing / manual override)
  // 2) omnix_currency cookie set by middleware on first visit
  // 3) Default KES
  const url = new URL((req as unknown as { url?: string }).url ?? 'http://localhost', 'http://localhost')
  const q = (url.searchParams.get('currency') ?? '').toUpperCase()
  if (PAYSTACK_CURRENCIES.includes(q as CheckoutCurrency)) return q as CheckoutCurrency

  const cookieHeader = req.headers.get('cookie') ?? ''
  const m = cookieHeader.match(/(?:^|;\s*)omnix_currency=([^;]+)/)
  const cookie = m?.[1]?.toUpperCase() as CheckoutCurrency | undefined
  if (cookie && PAYSTACK_CURRENCIES.includes(cookie)) return cookie
  return 'KES'
}

/**
 * POST /api/paystack/init
 *
 * Validates customer + license + purpose, computes amount, creates a
 * pending Payments row, returns { reference, amount, email, publicKey }
 * for the browser to pass into PaystackPop.newTransaction().
 *
 * The actual charge happens entirely client-side via Paystack Inline V2.
 * Webhook + status endpoint mark success when Paystack confirms.
 */
export const paystackInitEndpoint: Endpoint = {
  path: '/paystack/init',
  method: 'post',
  handler: async (req) => {
    if (req.user?.collection !== 'customers') {
      return errorResponse('Sign in required', 401)
    }
    const body = await readJson<{ licenseId?: string | number; purpose?: Purpose }>(req)
    if (!body?.licenseId || !body.purpose) {
      return errorResponse('Missing licenseId or purpose', 400)
    }

    const VALID: Purpose[] = ['license_fee', 'maintenance_renewal', 'major_upgrade', 'cloud_backup', 'extra_branch', 'extra_machine']
    if (!VALID.includes(body.purpose)) return errorResponse('Unsupported purpose', 400)

    const license = (await req.payload.findByID({ collection: 'licenses', id: body.licenseId }).catch(() => null)) as
      | null
      | { id: string | number; tier?: string; customer?: string | number | { id: string | number } }
    if (!license) return errorResponse('Licence not found', 404)

    const ownerId = typeof license.customer === 'object' && license.customer !== null
      ? (license.customer as { id: string | number }).id
      : license.customer
    if (String(ownerId) !== String(req.user.id)) return errorResponse('Not your licence', 403)

    const customer = (await req.payload.findByID({
      collection: 'customers', id: req.user.id, overrideAccess: true,
    })) as unknown as { email?: string }
    if (!customer?.email) return errorResponse('Customer has no email on file', 400)

    const pricing = (await req.payload.findGlobal({ slug: 'pricing' })) as unknown as PricingShape
    // Pricing tier is determined by VARIANT, not the licence's tier field:
    //   - pro variant   → business pricing (150,000 KES one-time)
    //   - all others    → starter pricing (50,000 KES one-time)
    const variant = (license as { variant?: string }).variant ?? 'pro'
    const pricingTier = variant === 'pro' ? 'business' : 'starter'
    const currency = pickCurrency(req as unknown as { headers: Headers })
    const amount = computeAmount(pricing, pricingTier, body.purpose, currency)
    if (!Number.isFinite(amount) || amount <= 0) return errorResponse('Computed amount invalid', 400)
    // Paystack expects amount in the smallest currency unit (kobo/cents/pesewa).
    // KES, NGN, GHS, ZAR all use 100 subunits. USD also uses cents (100).
    const amountSubunits = Math.round(amount * 100)
    const reference = newReference('OMNIX')

    await req.payload.create({
      collection: 'payments',
      data: {
        customer: req.user.id as never,
        license: license.id as never,
        purpose: body.purpose,
        amount,
        currency,
        status: 'pending',
        paystackReference: reference,
      } as never,
      overrideAccess: true,
    })

    const settings = await resolveSettings(req.payload)
    const publicKey =
      settings.paystackPublicKey ??
      process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ??
      process.env.PAYSTACK_PUBLIC_KEY
    if (!publicKey) return errorResponse('Paystack public key not configured', 500)

    return jsonResponse({
      reference,
      amount: amountSubunits,
      currency,
      email: customer.email,
      publicKey,
      purpose: body.purpose,
      licenseId: license.id,
    })
  },
}
