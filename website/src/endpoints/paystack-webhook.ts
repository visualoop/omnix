import type { Endpoint } from 'payload'
import { createHmac, timingSafeEqual } from 'crypto'
import { errorResponse, jsonResponse } from './_auth'
import { applyPaymentSuccess } from '../lib/paystack'
import { getPaystackWebhookSecret } from '../lib/settings'

/**
 * POST /api/paystack/webhook
 * Receives Paystack webhook events. Verifies HMAC signature, then applies
 * the payment success / failure to the local Payment + License records.
 *
 * HMAC secret resolution order:
 *   1. Settings global → integrations.paystackWebhookSecret (if set)
 *   2. Settings global → integrations.paystackSecretKey (Paystack default)
 *   3. env PAYSTACK_SECRET_KEY
 */
export const paystackWebhookEndpoint: Endpoint = {
  path: '/paystack/webhook',
  method: 'post',
  handler: async (req) => {
    const secret = await getPaystackWebhookSecret(req.payload)
    if (!secret) {
      return errorResponse('Webhook handler not configured', 500)
    }

    // Read raw body for HMAC verification
    let raw = ''
    if (req.text) raw = await req.text()
    else if (req.json) {
      const json = await req.json()
      raw = JSON.stringify(json)
    }

    if (!raw) return errorResponse('Empty body', 400)

    const signature = req.headers?.get?.('x-paystack-signature') ?? ''
    const expected = createHmac('sha512', secret).update(raw).digest('hex')

    try {
      const a = Buffer.from(signature, 'hex')
      const b = Buffer.from(expected, 'hex')
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return errorResponse('Invalid signature', 401)
      }
    } catch {
      return errorResponse('Invalid signature', 401)
    }

    const event = JSON.parse(raw) as {
      event: string
      data: Record<string, unknown> & { reference?: string; status?: string }
    }

    if (event.event === 'charge.success' && event.data?.reference) {
      await applyPaymentSuccess(req.payload, event.data.reference, event.data)
    } else if (
      event.event === 'charge.failed' &&
      event.data?.reference
    ) {
      await req.payload.update({
        collection: 'payments',
        where: { paystackReference: { equals: event.data.reference } },
        data: {
          status: 'failed',
          failureReason: (event.data.gateway_response as string) ?? 'Charge failed',
          rawWebhookPayload: event.data as never,
        },
        overrideAccess: true,
      })
    }

    return jsonResponse({ ok: true })
  },
}
