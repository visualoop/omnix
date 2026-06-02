import type { Endpoint } from 'payload'
import { errorResponse, jsonResponse } from './_auth'
import { applyPaymentSuccess, verify as paystackVerify } from '../lib/paystack'

/**
 * GET /api/paystack/status/:reference
 * Polled by the checkout page during M-Pesa or bank-transfer waits.
 * Verifies with Paystack on every call (cheap), and applies the payment
 * if it just succeeded.
 */
export const paystackStatusEndpoint: Endpoint = {
  path: '/paystack/status/:reference',
  method: 'get',
  handler: async (req) => {
    const reference = (req.routeParams?.reference as string | undefined) ?? ''
    if (!reference) return errorResponse('Missing reference', 400)

    // Local check first — webhook may have already updated us
    const payRes = await req.payload.find({
      collection: 'payments',
      where: { paystackReference: { equals: reference } },
      limit: 1,
    })
    const local = payRes.docs[0] as unknown as { status?: string } | undefined
    if (local?.status === 'success' || local?.status === 'failed') {
      return jsonResponse({ status: local.status })
    }

    // Otherwise verify with Paystack
    let verifyResult: Awaited<ReturnType<typeof paystackVerify>>
    try {
      verifyResult = await paystackVerify(reference)
    } catch {
      return jsonResponse({ status: 'pending' })
    }

    if (verifyResult.status === 'success') {
      await applyPaymentSuccess(req.payload, reference, verifyResult.raw)
      return jsonResponse({ status: 'success' })
    }
    if (verifyResult.status === 'failed') {
      await req.payload.update({
        collection: 'payments',
        where: { paystackReference: { equals: reference } },
        data: { status: 'failed', failureReason: 'Paystack reported failure' },
        overrideAccess: true,
      })
      return jsonResponse({ status: 'failed' })
    }

    return jsonResponse({ status: 'pending' })
  },
}
