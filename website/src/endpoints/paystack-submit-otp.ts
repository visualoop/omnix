import type { Endpoint } from 'payload'
import { errorResponse, jsonResponse, readJson } from './_auth'
import { submitOtp } from '../lib/paystack'

/**
 * POST /api/paystack/charge/submit-otp
 *
 * Called when the initial /charge response was status='send_otp'. The
 * customer typed the OTP into OUR own UI; we forward to Paystack's
 * /charge/submit_otp endpoint via the wrapper.
 */
export const paystackSubmitOtpEndpoint: Endpoint = {
  path: '/paystack/charge/submit-otp',
  method: 'post',
  handler: async (req) => {
    if (req.user?.collection !== 'customers') {
      return errorResponse('Sign in to continue', 401)
    }
    const body = await readJson<{ reference?: string; otp?: string }>(req)
    if (!body?.reference || !body.otp) {
      return errorResponse('Missing reference or otp', 400)
    }
    if (!/^\d{4,8}$/.test(body.otp)) {
      return errorResponse('OTP must be 4–8 digits', 400)
    }
    try {
      const result = await submitOtp({ reference: body.reference, otp: body.otp })
      return jsonResponse(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OTP submission failed'
      return errorResponse(message, 502)
    }
  },
}
