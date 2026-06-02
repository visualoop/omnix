import type { Endpoint } from 'payload'
import { errorResponse, jsonResponse, readJson } from './_auth'
import {
  chargeCard,
  chargeMobileMoney,
  computeAmount,
  newReference,
  type ChargeResponse,
  type Purpose,
  type PricingShape,
} from '../lib/paystack'

/**
 * POST /api/paystack/charge
 *
 * Customer-authenticated. Issues a Paystack /charge call directly — NEVER
 * /transaction/initialize (that returns a hosted-page redirect URL we don't
 * use). All UI for OTP / 3DS / pending lives in the front-end (custom).
 *
 * Body:
 *   { licenseId, purpose, channel: 'mpesa' | 'card', phone?, encryptedCard? }
 *
 * Response: ChargeResponse — { reference, status, displayText?, redirectUrl? }
 *   status drives the front-end's next step:
 *     - success    → done
 *     - pay_offline → poll /api/paystack/status/:ref
 *     - send_otp   → show our OTP input → POST /api/paystack/charge/submit-otp
 *     - open_url   → render redirectUrl in our own iframe modal + poll
 *     - failed     → display error
 */
interface ChargeBody {
  licenseId?: string
  purpose?: Purpose
  channel?: 'mpesa' | 'card'
  phone?: string
  encryptedCard?: string
}

export const paystackChargeEndpoint: Endpoint = {
  path: '/paystack/charge',
  method: 'post',
  handler: async (req) => {
    if (req.user?.collection !== 'customers') {
      return errorResponse('Sign in to start a payment', 401)
    }

    const body = await readJson<ChargeBody>(req)
    if (!body || !body.licenseId || !body.purpose || !body.channel) {
      return errorResponse('Missing licenseId, purpose, or channel', 400)
    }
    if (body.channel !== 'mpesa' && body.channel !== 'card') {
      return errorResponse('Unsupported channel', 400)
    }
    if (body.channel === 'mpesa' && !body.phone) {
      return errorResponse('M-Pesa phone is required', 400)
    }
    if (body.channel === 'card' && !body.encryptedCard) {
      return errorResponse('Encrypted card data is required', 400)
    }

    // Verify customer owns the licence
    let license
    try {
      license = (await req.payload.findByID({
        collection: 'licenses',
        id: body.licenseId,
      })) as unknown as {
        id: string | number
        tier: string
        customer: string | { id: string | number }
      }
    } catch {
      return errorResponse('Licence not found', 404)
    }
    const ownerId =
      typeof license.customer === 'string' ? license.customer : license.customer?.id
    if (String(ownerId) !== String(req.user.id)) {
      return errorResponse('You do not own this licence', 403)
    }

    // Compute amount from current Pricing global
    const pricing = (await req.payload.findGlobal({
      slug: 'pricing',
    })) as unknown as PricingShape
    const amount = computeAmount(pricing, license.tier, body.purpose)
    if (amount <= 0) {
      return errorResponse('Could not compute amount for this purpose', 400)
    }
    const currency = pricing.currency ?? 'KES'

    // Pre-create the Payment record so the webhook + status poller can find it
    const reference = newReference('OMNIX')
    const customer = req.user as unknown as { id: string | number; email: string }

    await req.payload.create({
      collection: 'payments',
      data: {
        paystackReference: reference,
        customer: customer.id as never,
        license: license.id as never,
        amount,
        currency,
        channel: body.channel as never,
        purpose: body.purpose,
        status: 'pending',
      },
      overrideAccess: true,
    })

    // Issue the charge
    let charge: ChargeResponse
    try {
      if (body.channel === 'mpesa') {
        charge = await chargeMobileMoney({
          email: customer.email,
          amountKobo: amount * 100,
          phone: body.phone!,
          reference,
          metadata: { licenseId: license.id, customerId: customer.id, purpose: body.purpose },
        })
      } else {
        charge = await chargeCard({
          email: customer.email,
          amountKobo: amount * 100,
          encryptedCard: body.encryptedCard!,
          reference,
          metadata: { licenseId: license.id, customerId: customer.id, purpose: body.purpose },
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Paystack rejected the request'
      await req.payload.update({
        collection: 'payments',
        where: { paystackReference: { equals: reference } },
        data: { status: 'failed', failureReason: message },
        overrideAccess: true,
      })
      return errorResponse(message, 502)
    }

    return jsonResponse(charge)
  },
}
