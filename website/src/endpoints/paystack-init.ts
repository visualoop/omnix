import type { Endpoint } from 'payload'
import { errorResponse, jsonResponse, readJson } from './_auth'
import { computeAmount, newReference, type Purpose, type PricingShape } from '../lib/paystack'
import { resolveSettings } from '../lib/settings'

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
    const amountKES = computeAmount(pricing, pricingTier, body.purpose)
    if (!Number.isFinite(amountKES) || amountKES <= 0) return errorResponse('Computed amount invalid', 400)
    const amountKobo = amountKES * 100
    const reference = newReference('OMNIX')

    await req.payload.create({
      collection: 'payments',
      data: {
        customer: req.user.id as never,
        license: license.id as never,
        purpose: body.purpose,
        amount: amountKES,
        currency: 'KES',
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
      reference, amount: amountKobo, currency: 'KES',
      email: customer.email, publicKey, purpose: body.purpose, licenseId: license.id,
    })
  },
}
