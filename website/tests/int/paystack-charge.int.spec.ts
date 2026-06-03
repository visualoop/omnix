/**
 * paystack-charge endpoint tests.
 *
 * Coverage:
 *  - 401 anonymous / non-customer
 *  - 400 missing fields (licenseId / purpose / channel)
 *  - 400 unsupported channel
 *  - 400 mpesa without phone, card without encryptedCard
 *  - 404 license not found
 *  - 403 charging someone else's license
 *  - Happy path mpesa: pre-creates Payment + calls Paystack with kobo amount + returns ChargeResponse
 *  - Happy path card: forwards encryptedCard
 *  - 502 + Payment marked failed when Paystack rejects
 *  - Amount computed from pricing global + license tier + purpose
 *
 * fetch is stubbed; payload is fake (in-memory).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { paystackChargeEndpoint } from '@/endpoints/paystack-charge'

const ORIG_SECRET = process.env.PAYSTACK_SECRET_KEY

beforeEach(() => {
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_charge_unit'
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
  process.env.PAYSTACK_SECRET_KEY = ORIG_SECRET
})

const okJson = (data: Record<string, unknown>) =>
  ({ ok: true, status: 200, json: async () => ({ status: true, data }) }) as unknown as Response

const errJson = (status: number, message: string) =>
  ({ ok: false, status, json: async () => ({ status: false, message }) }) as unknown as Response

interface Db {
  licenses: Array<Record<string, unknown> & { id: string }>
  payments: Array<Record<string, unknown>>
}

const seed = (over: Partial<Db> = {}): Db => ({
  licenses: over.licenses ?? [{ id: 'l1', tier: 'starter', customer: 'c1' }],
  payments: over.payments ?? [],
})

const buildPayload = (db: Db) => ({
  findByID: vi.fn(async ({ id }: { id: string }) => {
    const doc = db.licenses.find((l) => l.id === id)
    if (!doc) throw new Error('Not found')
    return doc
  }),
  find: vi.fn(async () => ({ docs: [], totalDocs: 0 })),
  findGlobal: vi.fn(async () => ({
    starter: { oneTimeFee: 100_000, maintenanceYearly: 12_000 },
    business: { oneTimeFee: 200_000 },
    cloudBackupMonthly: 500,
    extraBranchOneTime: 15_000,
    extraMachineOneTime: 5_000,
    majorUpgradeDiscount: 50,
    currency: 'KES',
  })),
  create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const doc = { id: `p_${db.payments.length + 1}`, ...data }
    db.payments.push(doc)
    return doc
  }),
  update: vi.fn(async ({ where, data }: { where?: Record<string, { equals: unknown }>; data: Record<string, unknown> }) => {
    if (where) {
      const target = db.payments.find((p) =>
        Object.entries(where).every(([k, v]) => (p as Record<string, unknown>)[k] === v.equals),
      )
      if (target) Object.assign(target, data)
      return target
    }
    return null
  }),
})

const buildReq = (
  db: Db,
  body: Record<string, unknown>,
  user: { collection: 'customers' | 'users'; id: string } | undefined,
) =>
  ({
    payload: buildPayload(db),
    json: async () => body,
    text: async () => JSON.stringify(body),
    user,
    headers: { get: () => null },
  }) as unknown as Parameters<typeof paystackChargeEndpoint.handler>[0]

const customerC1 = { collection: 'customers' as const, id: 'c1' }

const lastFetchCall = () => {
  const f = global.fetch as unknown as ReturnType<typeof vi.fn>
  return f.mock.calls[f.mock.calls.length - 1]
}

describe('paystack-charge: auth + validation', () => {
  it('401 when not signed in', async () => {
    const res = await paystackChargeEndpoint.handler(buildReq(seed(), { licenseId: 'l1', purpose: 'license_fee', channel: 'mpesa', phone: '0712345678' }, undefined))
    expect(res.status).toBe(401)
  })

  it('401 when signed in as users (admin) instead of customers', async () => {
    const res = await paystackChargeEndpoint.handler(
      buildReq(seed(), { licenseId: 'l1', purpose: 'license_fee', channel: 'mpesa', phone: '0712345678' }, { collection: 'users', id: 'u1' }),
    )
    expect(res.status).toBe(401)
  })

  it('400 missing licenseId', async () => {
    const res = await paystackChargeEndpoint.handler(buildReq(seed(), { purpose: 'license_fee', channel: 'mpesa', phone: '0712345678' }, customerC1))
    expect(res.status).toBe(400)
  })

  it('400 missing purpose', async () => {
    const res = await paystackChargeEndpoint.handler(buildReq(seed(), { licenseId: 'l1', channel: 'mpesa', phone: '0712345678' }, customerC1))
    expect(res.status).toBe(400)
  })

  it('400 missing channel', async () => {
    const res = await paystackChargeEndpoint.handler(buildReq(seed(), { licenseId: 'l1', purpose: 'license_fee' }, customerC1))
    expect(res.status).toBe(400)
  })

  it('400 unsupported channel', async () => {
    const res = await paystackChargeEndpoint.handler(
      buildReq(seed(), { licenseId: 'l1', purpose: 'license_fee', channel: 'paypal', phone: '0712345678' }, customerC1),
    )
    expect(res.status).toBe(400)
  })

  it('400 mpesa without phone', async () => {
    const res = await paystackChargeEndpoint.handler(buildReq(seed(), { licenseId: 'l1', purpose: 'license_fee', channel: 'mpesa' }, customerC1))
    expect(res.status).toBe(400)
  })

  it('400 card without encryptedCard', async () => {
    const res = await paystackChargeEndpoint.handler(buildReq(seed(), { licenseId: 'l1', purpose: 'license_fee', channel: 'card' }, customerC1))
    expect(res.status).toBe(400)
  })
})

describe('paystack-charge: ownership', () => {
  it('404 when license not found', async () => {
    const res = await paystackChargeEndpoint.handler(
      buildReq(seed(), { licenseId: 'l-nope', purpose: 'license_fee', channel: 'mpesa', phone: '0712345678' }, customerC1),
    )
    expect(res.status).toBe(404)
  })

  it('403 when license belongs to another customer', async () => {
    const db = seed({ licenses: [{ id: 'l1', tier: 'starter', customer: 'c-other' }] })
    const res = await paystackChargeEndpoint.handler(
      buildReq(db, { licenseId: 'l1', purpose: 'license_fee', channel: 'mpesa', phone: '0712345678' }, customerC1),
    )
    expect(res.status).toBe(403)
  })
})

describe('paystack-charge: happy path', () => {
  it('mpesa: pre-creates Payment + calls Paystack /charge with kobo amount', async () => {
    const db = seed()
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      okJson({ reference: 'AUTO', status: 'pay_offline' }),
    )
    const res = await paystackChargeEndpoint.handler(
      buildReq(db, { licenseId: 'l1', purpose: 'license_fee', channel: 'mpesa', phone: '0712345678' }, customerC1),
    )
    expect(res.status).toBe(200)
    // Payment row created in pending status
    expect(db.payments).toHaveLength(1)
    expect(db.payments[0].status).toBe('pending')
    expect(db.payments[0].amount).toBe(100_000) // starter license_fee
    expect(db.payments[0].currency).toBe('KES')
    // Paystack call was sent
    const [, init] = lastFetchCall() as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.amount).toBe(10_000_000) // kobo
    expect(body.mobile_money.phone).toBe('+254712345678')
  })

  it('card: forwards encryptedCard to Paystack', async () => {
    const db = seed()
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      okJson({ reference: 'AUTO', status: 'send_otp' }),
    )
    const res = await paystackChargeEndpoint.handler(
      buildReq(db, { licenseId: 'l1', purpose: 'license_fee', channel: 'card', encryptedCard: 'ENC_BLOB' }, customerC1),
    )
    expect(res.status).toBe(200)
    const [, init] = lastFetchCall() as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.card).toBe('ENC_BLOB')
  })

  it('amount computed correctly for maintenance_renewal (12k)', async () => {
    const db = seed()
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(okJson({ reference: 'r', status: 'pay_offline' }))
    await paystackChargeEndpoint.handler(
      buildReq(db, { licenseId: 'l1', purpose: 'maintenance_renewal', channel: 'mpesa', phone: '0712345678' }, customerC1),
    )
    expect(db.payments[0].amount).toBe(12_000)
  })

  it('business tier license_fee = 200k (not 100k)', async () => {
    const db = seed({ licenses: [{ id: 'l1', tier: 'business', customer: 'c1' }] })
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(okJson({ reference: 'r', status: 'pay_offline' }))
    await paystackChargeEndpoint.handler(
      buildReq(db, { licenseId: 'l1', purpose: 'license_fee', channel: 'mpesa', phone: '0712345678' }, customerC1),
    )
    expect(db.payments[0].amount).toBe(200_000)
  })
})

describe('paystack-charge: failure paths', () => {
  it('502 when Paystack rejects + Payment marked failed', async () => {
    const db = seed()
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      errJson(400, 'Invalid mobile money phone'),
    )
    const res = await paystackChargeEndpoint.handler(
      buildReq(db, { licenseId: 'l1', purpose: 'license_fee', channel: 'mpesa', phone: '0712345678' }, customerC1),
    )
    expect(res.status).toBe(502)
    expect(db.payments[0].status).toBe('failed')
    expect((db.payments[0].failureReason as string)).toMatch(/Invalid mobile money/i)
  })
})
