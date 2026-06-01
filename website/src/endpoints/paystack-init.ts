import type { Endpoint, PayloadRequest } from 'payload'
import { errorResponse, jsonResponse, readJson } from './_auth'
import { renderEmail, sendEmail } from '../lib/emails'

/**
 * POST /api/paystack/init
 *
 * Customer-authenticated. Computes the amount from the License + purpose,
 * creates a pending Payment record, then calls Paystack /transaction/initialize.
 * Returns the access_code + reference + authorization_url.
 *
 * Body: { licenseId, purpose, channel?, phone? }
 */

interface PaystackInitBody {
  licenseId?: string
  purpose?:
    | 'license_fee'
    | 'maintenance_renewal'
    | 'major_upgrade'
    | 'cloud_backup'
    | 'extra_branch'
    | 'extra_machine'
  channel?: 'card' | 'mpesa' | 'bank'
  phone?: string
}

interface PricingShape {
  starter?: { oneTimeFee?: number; maintenanceYearly?: number }
  business?: { oneTimeFee?: number; maintenanceYearly?: number }
  cloudBackupMonthly?: number
  extraBranchOneTime?: number
  extraMachineOneTime?: number
  majorUpgradeDiscount?: number
  currency?: string
}

function computeAmount(
  pricing: PricingShape,
  tier: string,
  purpose: string,
): number {
  const t = tier === 'business' ? pricing.business : pricing.starter
  switch (purpose) {
    case 'license_fee':
      return t?.oneTimeFee ?? 100000
    case 'maintenance_renewal':
      return t?.maintenanceYearly ?? 12000
    case 'major_upgrade': {
      const fee = t?.oneTimeFee ?? 100000
      const discount = pricing.majorUpgradeDiscount ?? 50
      return Math.round(fee * (1 - discount / 100))
    }
    case 'cloud_backup':
      return pricing.cloudBackupMonthly ?? 500
    case 'extra_branch':
      return pricing.extraBranchOneTime ?? 15000
    case 'extra_machine':
      return pricing.extraMachineOneTime ?? 5000
    default:
      return 0
  }
}

async function callPaystack(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) {
    return { ok: false, error: 'PAYSTACK_SECRET_KEY missing' }
  }
  try {
    const res = await fetch(`https://api.paystack.co${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const json = (await res.json()) as { status?: boolean; message?: string; data?: Record<string, unknown> }
    if (!res.ok || !json.status) {
      return { ok: false, error: json.message ?? 'Paystack returned an error' }
    }
    return { ok: true, data: json.data ?? {} }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

export const paystackInitEndpoint: Endpoint = {
  path: '/paystack/init',
  method: 'post',
  handler: async (req) => {
    if (req.user?.collection !== 'customers') {
      return errorResponse('Sign in to start a payment', 401)
    }

    const body = await readJson<PaystackInitBody>(req)
    if (!body || !body.licenseId || !body.purpose) {
      return errorResponse('Missing licenseId or purpose', 400)
    }

    // Verify the customer owns the license
    let license
    try {
      license = (await req.payload.findByID({
        collection: 'licenses',
        id: body.licenseId,
      })) as unknown as {
        id: string | number
        tier: string
        customer: string | { id: string | number }
        currency?: string
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
    const pricing = (await req.payload.findGlobal({ slug: 'pricing' })) as unknown as PricingShape
    const amount = computeAmount(pricing, license.tier, body.purpose)
    if (amount <= 0) {
      return errorResponse('Could not compute amount for this purpose', 400)
    }
    const currency = pricing.currency ?? 'KES'

    // Create the Payment record in pending state — webhook will update it
    const reference = `OMNIX-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    const customer = req.user as unknown as { id: string | number; email: string }

    await req.payload.create({
      collection: 'payments',
      data: {
        paystackReference: reference,
        customer: customer.id as never,
        license: license.id as never,
        amount,
        currency,
        channel: body.channel === 'bank' ? 'bank_transfer' : (body.channel as never),
        purpose: body.purpose,
        status: 'pending',
      },
      overrideAccess: true,
    })

    // Init the Paystack transaction
    const paystackBody: Record<string, unknown> = {
      email: customer.email,
      amount: amount * 100, // Paystack expects kobo / minor units
      currency,
      reference,
      callback_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/buy/success?ref=${reference}`,
      metadata: {
        licenseId: license.id,
        customerId: customer.id,
        purpose: body.purpose,
      },
    }

    if (body.channel === 'mpesa' && body.phone) {
      paystackBody.channels = ['mobile_money']
      paystackBody.mobile_money = { phone: body.phone, provider: 'mpesa' }
    } else if (body.channel === 'bank') {
      paystackBody.channels = ['bank']
    }

    const result = await callPaystack('/transaction/initialize', paystackBody)
    if (!result.ok) {
      // Mark payment as failed
      await req.payload.update({
        collection: 'payments',
        where: { paystackReference: { equals: reference } },
        data: { status: 'failed', failureReason: result.error },
        overrideAccess: true,
      })
      return errorResponse(result.error ?? 'Paystack rejected the request', 502)
    }

    return jsonResponse({
      ok: true,
      reference,
      accessCode: result.data?.access_code,
      authorizationUrl: result.data?.authorization_url,
    })
  },
}

/* ── Re-used by status + webhook handlers ── */
export async function paystackVerify(reference: string) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) return { ok: false as const, error: 'PAYSTACK_SECRET_KEY missing' }
  try {
    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    )
    const json = (await res.json()) as { status?: boolean; data?: Record<string, unknown> }
    if (!res.ok || !json.status) return { ok: false as const, error: 'Verify failed' }
    return { ok: true as const, data: json.data ?? {} }
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : 'Network error' }
  }
}

export async function applyPaymentSuccess(
  payload: PayloadRequest['payload'],
  reference: string,
  paystackData: Record<string, unknown>,
): Promise<void> {
  // Find the local Payment doc
  const payRes = await payload.find({
    collection: 'payments',
    where: { paystackReference: { equals: reference } },
    limit: 1,
    depth: 1,
  })
  const payment = payRes.docs[0] as unknown as
    | undefined
    | {
        id: string | number
        status: string
        purpose: string
        amount: number
        license?: string | { id: string | number; tier: string; majorVersionCap?: number }
        customer: string | { id: string | number }
        rawWebhookPayload?: Record<string, unknown>
      }
  if (!payment) return

  // Idempotent — if already success, do nothing
  if (payment.status === 'success') return

  const channel = (paystackData.channel as string) ?? 'card'
  const fees = ((paystackData.fees as number) ?? 0) / 100
  const cardLast4 = ((paystackData.authorization as { last4?: string } | undefined)?.last4) ?? undefined
  const cardBrand = ((paystackData.authorization as { brand?: string } | undefined)?.brand) ?? undefined
  const mpesaReceipt = ((paystackData.authorization as { authorization_code?: string } | undefined)?.authorization_code) ?? undefined

  await payload.update({
    collection: 'payments',
    id: payment.id,
    data: {
      status: 'success',
      paidAt: new Date().toISOString(),
      paystackTransactionId: (paystackData.id as number)?.toString?.(),
      channel: channel === 'mobile_money' ? 'mpesa' : (channel as never),
      paystackFees: fees,
      netAmount: payment.amount - fees,
      cardLast4,
      cardBrand,
      mpesaReceiptNumber: mpesaReceipt,
      rawWebhookPayload: paystackData as never,
    },
    overrideAccess: true,
  })

  // Apply business effect to the License based on purpose
  const licenseId =
    typeof payment.license === 'string' ? payment.license : payment.license?.id
  if (!licenseId) return

  const license = (await payload.findByID({
    collection: 'licenses',
    id: licenseId,
  })) as unknown as {
    id: string | number
    tier: string
    majorVersionCap?: number
    maintenanceUntil?: string
    cloudBackupExpiresAt?: string
    maxBranches?: number
    maxMachines?: number
  }

  const oneYearMs = 365 * 24 * 60 * 60 * 1000
  const oneMonthMs = 30 * 24 * 60 * 60 * 1000

  switch (payment.purpose) {
    case 'license_fee': {
      const now = new Date()
      await payload.update({
        collection: 'licenses',
        id: licenseId,
        data: {
          status: 'active',
          paidAt: now.toISOString(),
          maintenanceUntil: new Date(now.getTime() + oneYearMs).toISOString(),
          priceFeePaid: payment.amount,
        },
        overrideAccess: true,
      })
      break
    }
    case 'maintenance_renewal': {
      const base = license.maintenanceUntil
        ? new Date(license.maintenanceUntil)
        : new Date()
      const newUntil = new Date(base.getTime() + oneYearMs)
      await payload.update({
        collection: 'licenses',
        id: licenseId,
        data: { maintenanceUntil: newUntil.toISOString() },
        overrideAccess: true,
      })
      break
    }
    case 'major_upgrade': {
      await payload.update({
        collection: 'licenses',
        id: licenseId,
        data: { majorVersionCap: (license.majorVersionCap ?? 1) + 1 },
        overrideAccess: true,
      })
      break
    }
    case 'cloud_backup': {
      const base = license.cloudBackupExpiresAt
        ? new Date(license.cloudBackupExpiresAt)
        : new Date()
      const newUntil = new Date(base.getTime() + oneMonthMs)
      await payload.update({
        collection: 'licenses',
        id: licenseId,
        data: {
          cloudBackupEnabled: true,
          cloudBackupExpiresAt: newUntil.toISOString(),
        },
        overrideAccess: true,
      })
      break
    }
    case 'extra_branch': {
      await payload.update({
        collection: 'licenses',
        id: licenseId,
        data: { maxBranches: (license.maxBranches ?? 1) + 1 },
        overrideAccess: true,
      })
      break
    }
    case 'extra_machine': {
      await payload.update({
        collection: 'licenses',
        id: licenseId,
        data: { maxMachines: (license.maxMachines ?? 3) + 1 },
        overrideAccess: true,
      })
      break
    }
  }

  /* ── Send confirmation emails ─────────────────────────── */
  try {
    const customerId =
      typeof payment.customer === 'string' ? payment.customer : payment.customer.id
    const customer = (await payload.findByID({
      collection: 'customers',
      id: customerId,
    })) as unknown as { email?: string; fullName?: string }

    if (customer?.email) {
      // Receipt
      await sendEmail({
        payload,
        to: customer.email,
        subject: `Receipt ${reference} — Omnix payment`,
        html: await renderEmail('PaymentReceipt', {
          name: customer.fullName ?? 'there',
          reference,
          amount: payment.amount,
          currency: 'KES',
          purpose: payment.purpose,
        }),
      })

      // For first license payment, also send the license-issued email
      if (payment.purpose === 'license_fee') {
        const updatedLic = (await payload.findByID({
          collection: 'licenses',
          id: licenseId,
        })) as unknown as {
          licenseKey?: string
          tier?: string
          maintenanceUntil?: string
        }
        if (updatedLic.licenseKey) {
          await sendEmail({
            payload,
            to: customer.email,
            subject: `Your Omnix licence — ${updatedLic.licenseKey}`,
            html: await renderEmail('LicenseIssued', {
              name: customer.fullName ?? 'there',
              licenseKey: updatedLic.licenseKey,
              tier: updatedLic.tier ?? 'Standard',
              maintenanceUntil:
                updatedLic.maintenanceUntil ?? new Date().toISOString(),
            }),
          })
        }
      }
    }
  } catch (err) {
    payload.logger.error({ err, reference }, 'failed to send payment emails')
  }
}
