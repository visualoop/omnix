import type { Endpoint } from 'payload'
import { errorResponse, jsonResponse, readJson } from './_auth'

const ALLOWED_FIELDS = new Set([
  'fullName',
  'businessName',
  'phone',
  'whatsapp',
  'kraPin',
  'county',
  'town',
  'physicalAddress',
  'businessType',
  'employeeCount',
  'newsletterOptIn',
])

/**
 * PATCH /api/customers/me
 * Customer-authenticated. Allows the customer to update their own profile.
 * Email is intentionally not editable here — requires support.
 */
export const customersMeEndpoint: Endpoint = {
  path: '/customers/me',
  method: 'patch',
  handler: async (req) => {
    if (req.user?.collection !== 'customers') {
      return errorResponse('Sign in required', 401)
    }

    const body = await readJson<Record<string, unknown>>(req)
    if (!body) return errorResponse('Bad request', 400)

    const data: Record<string, unknown> = {}
    for (const key of Object.keys(body)) {
      if (ALLOWED_FIELDS.has(key)) data[key] = body[key]
    }

    await req.payload.update({
      collection: 'customers',
      id: req.user.id,
      data: data as never,
      overrideAccess: false, // respect collection access rules
      user: req.user,
    })

    return jsonResponse({ ok: true })
  },
}
