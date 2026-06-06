/**
 * Paystack API client wrapper — single source of truth.
 *
 * All Paystack calls go through this module. Routes never call
 * `fetch('https://api.paystack.co/...')` directly — they call
 * paystack.chargeMobileMoney() / chargeCard() / submitOtp() / verify().
 *
 * NO PAYSTACK-HOSTED CHECKOUT. NO REDIRECT-FOR-CARDS. We use the
 * /charge endpoint everywhere; the front-end renders OUR OWN UI for
 * the customer journey (custom card form, OTP entry, 3DS iframe).
 *
 * Card encryption: cards are encrypted client-side using
 * @paystack/inline-js's encrypt() helper with PAYSTACK_PUBLIC_KEY,
 * so plaintext card data never touches our server (PCI scope).
 */
import type { PayloadRequest } from 'payload'

const PAYSTACK_BASE = 'https://api.paystack.co'

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set in environment')
  return key
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${secretKey()}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

export type ChargeStatus =
  | 'success'
  | 'send_otp'
  | 'send_pin'
  | 'send_birthday'
  | 'send_address'
  | 'send_phone'
  | 'open_url'
  | 'pay_offline' // M-Pesa: customer hasn't confirmed yet
  | 'pending'
  | 'failed'

export interface ChargeResponse {
  reference: string
  status: ChargeStatus
  /** Customer-facing message (e.g. "Enter the 4-digit OTP sent to ..."). */
  displayText?: string
  /** Present when status === 'open_url' — the 3DS challenge URL. */
  redirectUrl?: string
}

function parseChargeResponse(json: {
  data?: Record<string, unknown>
}): ChargeResponse {
  const data = json?.data ?? {}
  const status = (data.status as ChargeStatus) ?? 'pending'
  return {
    reference: data.reference as string,
    status,
    displayText: (data.display_text as string) ?? (data.message as string),
    redirectUrl: data.url as string | undefined,
  }
}

/* ── M-Pesa STK push ─────────────────────────────────────────────── */
export async function chargeMobileMoney(input: {
  email: string
  amountKobo: number
  phone: string // any reasonable Kenyan format; we normalise to +254...
  reference: string
  metadata?: Record<string, unknown>
}): Promise<ChargeResponse> {
  const phone = normaliseKePhone(input.phone)
  const res = await fetch(`${PAYSTACK_BASE}/charge`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      currency: 'KES',
      reference: input.reference,
      mobile_money: { phone, provider: 'mpesa' },
      metadata: { ...input.metadata, channel: 'mobile_money' },
    }),
  })
  const json = (await res.json()) as { status?: boolean; message?: string; data?: Record<string, unknown> }
  if (!res.ok || !json.status) {
    throw new Error(`Paystack /charge mpesa rejected: ${json?.message ?? res.status}`)
  }
  return parseChargeResponse(json)
}

/* ── Card charge (with already-encrypted card) ───────────────────── */
export async function chargeCard(input: {
  email: string
  amountKobo: number
  encryptedCard: string
  reference: string
  metadata?: Record<string, unknown>
}): Promise<ChargeResponse> {
  const res = await fetch(`${PAYSTACK_BASE}/charge`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      currency: 'KES',
      reference: input.reference,
      card: input.encryptedCard,
      metadata: { ...input.metadata, channel: 'card' },
    }),
  })
  const json = (await res.json()) as { status?: boolean; message?: string; data?: Record<string, unknown> }
  if (!res.ok || !json.status) {
    throw new Error(`Paystack /charge card rejected: ${json?.message ?? res.status}`)
  }
  return parseChargeResponse(json)
}

/* ── Submit OTP for a charge that returned send_otp ─────────────── */
export async function submitOtp(input: { reference: string; otp: string }): Promise<ChargeResponse> {
  const res = await fetch(`${PAYSTACK_BASE}/charge/submit_otp`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ reference: input.reference, otp: input.otp }),
  })
  const json = (await res.json()) as { status?: boolean; message?: string; data?: Record<string, unknown> }
  if (!res.ok || !json.status) {
    throw new Error(`Paystack /charge/submit_otp failed: ${json?.message ?? res.status}`)
  }
  return parseChargeResponse(json)
}

/* ── Verify a transaction (defense-in-depth on webhook + status polling) ── */
export async function verify(reference: string): Promise<{
  status: 'success' | 'failed' | 'pending'
  amountKES: number
  raw: Record<string, unknown>
}> {
  const res = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    { method: 'GET', headers: authHeaders() },
  )
  const json = (await res.json()) as { status?: boolean; data?: Record<string, unknown> }
  if (!res.ok || !json.status) {
    throw new Error(`Paystack /transaction/verify failed: ${res.status}`)
  }
  const data = json.data ?? {}
  const pStatus = data.status as string
  return {
    status:
      pStatus === 'success'
        ? 'success'
        : pStatus === 'failed' || pStatus === 'abandoned' || pStatus === 'reversed'
          ? 'failed'
          : 'pending',
    amountKES: Math.round(((data.amount as number) ?? 0) / 100),
    raw: data,
  }
}

/* ── Phone normalisation (Kenya) ─────────────────────────────────── */
function normaliseKePhone(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.startsWith('254')) return `+${digits}`
  if (digits.startsWith('0') && digits.length === 10) return `+254${digits.slice(1)}`
  if (digits.length === 9) return `+254${digits}`
  return digits.startsWith('+') ? input.trim() : `+${digits}`
}

/* ── Reference generation ───────────────────────────────────────── */
export function newReference(prefix = 'OMNIX'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

/* ── Apply payment success to the License (idempotent) ──────────── */
export async function applyPaymentSuccess(
  payload: PayloadRequest['payload'],
  reference: string,
  paystackData: Record<string, unknown>,
): Promise<void> {
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
      }
  if (!payment) return
  if (payment.status === 'success') return // idempotent

  const channel = (paystackData.channel as string) ?? 'card'
  const fees = ((paystackData.fees as number) ?? 0) / 100
  const auth = (paystackData.authorization as { last4?: string; brand?: string; authorization_code?: string } | undefined) ?? {}

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
      cardLast4: auth.last4,
      cardBrand: auth.brand,
      mpesaReceiptNumber: auth.authorization_code,
      rawWebhookPayload: paystackData as never,
    },
    overrideAccess: true,
  })

  const licenseId =
    typeof payment.license === 'string' ? payment.license : payment.license?.id
  if (!licenseId) return

  const license = (await payload.findByID({
    collection: 'licenses',
    id: licenseId,
  })) as unknown as {
    majorVersionCap?: number
    maintenanceUntil?: string
    cloudBackupExpiresAt?: string
  }

  const ONE_YEAR = 365 * 24 * 60 * 60 * 1000
  const ONE_MONTH = 30 * 24 * 60 * 60 * 1000

  switch (payment.purpose) {
    case 'license_fee': {
      const now = new Date()
      const maintenanceUntil = new Date(now.getTime() + ONE_YEAR)
      await payload.update({
        collection: 'licenses',
        id: licenseId,
        data: {
          status: 'active',
          paidAt: now.toISOString(),
          maintenanceUntil: maintenanceUntil.toISOString(),
          priceFeePaid: payment.amount,
        },
        overrideAccess: true,
      })
      // Email the customer their license key — first time issuance
      await emailLicenseIssued(payload, licenseId, maintenanceUntil)
      break
    }
    case 'maintenance_renewal': {
      const base = license.maintenanceUntil ? new Date(license.maintenanceUntil) : new Date()
      const newUntil = new Date(base.getTime() + ONE_YEAR)
      await payload.update({
        collection: 'licenses',
        id: licenseId,
        data: { maintenanceUntil: newUntil.toISOString() },
        overrideAccess: true,
      })
      // Re-send key email (acts as a renewal receipt; customer often loses the original)
      await emailLicenseIssued(payload, licenseId, newUntil)
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
      await payload.update({
        collection: 'licenses',
        id: licenseId,
        data: { cloudBackupExpiresAt: new Date(base.getTime() + ONE_MONTH).toISOString() },
        overrideAccess: true,
      })
      break
    }
  }
}

/**
 * Send the LicenseIssued email — pulls the up-to-date license + customer
 * data and renders the React Email template. Best-effort: failures are
 * logged but don't block the payment flow.
 */
async function emailLicenseIssued(
  payload: PayloadRequest['payload'],
  licenseId: string | number,
  maintenanceUntil: Date,
): Promise<void> {
  try {
    const fullLicense = (await payload.findByID({
      collection: 'licenses',
      id: licenseId,
      depth: 1,
      overrideAccess: true,
    })) as unknown as {
      licenseKey?: string
      tier?: string
      customer?: string | { id: string | number; email?: string; name?: string }
    }
    if (!fullLicense.licenseKey) return
    const customer = typeof fullLicense.customer === 'object' ? fullLicense.customer : null
    if (!customer?.email) {
      payload.logger.warn({ licenseId }, '[email] license issued but customer has no email; skipping')
      return
    }
    const { renderEmail, sendEmail } = await import('./emails')
    const html = await renderEmail('LicenseIssued', {
      name: customer.name ?? 'there',
      licenseKey: fullLicense.licenseKey,
      tier: fullLicense.tier ?? 'standard',
      maintenanceUntil: maintenanceUntil.toISOString(),
    })
    await sendEmail({
      payload,
      to: customer.email,
      subject: `Your Omnix license — ${fullLicense.licenseKey}`,
      html,
    })
    payload.logger.info({ licenseId, to: customer.email }, '[email] LicenseIssued sent')
  } catch (err) {
    payload.logger.error({ err, licenseId }, '[email] LicenseIssued failed (non-fatal)')
  }
}

/* ── Pricing helper (re-used by charge endpoint) ─────────────────── */
export interface PricingShape {
  starter?: { oneTimeFee?: number; maintenanceYearly?: number }
  business?: { oneTimeFee?: number; maintenanceYearly?: number }
  cloudBackupMonthly?: number
  extraBranchOneTime?: number
  extraMachineOneTime?: number
  majorUpgradeDiscount?: number
  currency?: string
}

export type Purpose =
  | 'license_fee'
  | 'maintenance_renewal'
  | 'major_upgrade'
  | 'cloud_backup'
  | 'extra_branch'
  | 'extra_machine'

export function computeAmount(
  pricing: PricingShape,
  tier: string,
  purpose: Purpose,
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
  }
}
