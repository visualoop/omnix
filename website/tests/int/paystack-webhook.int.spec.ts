/**
 * Webhook handler tests — verifies the HMAC SHA-512 signature gate AND
 * that valid charge.success / charge.failed events drive the right
 * Payment + License state changes.
 *
 * The webhook reads raw body via `req.text()` and signs against
 * PAYSTACK_SECRET_KEY. We import the handler and feed it a fake
 * PayloadRequest.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createHmac } from 'crypto'

const TEST_SECRET = 'sk_test_webhook_unit'
const ORIG_SECRET = process.env.PAYSTACK_SECRET_KEY

beforeEach(() => {
  process.env.PAYSTACK_SECRET_KEY = TEST_SECRET
})
afterEach(() => {
  process.env.PAYSTACK_SECRET_KEY = ORIG_SECRET
  vi.restoreAllMocks()
})

// Re-import per test so env-reads inside handler take effect.
async function loadHandler() {
  const { paystackWebhookEndpoint } = await import('@/endpoints/paystack-webhook')
  return paystackWebhookEndpoint.handler
}

const makeFakePayload = () => {
  const db = {
    payments: [
      {
        id: 'pay_1',
        paystackReference: 'OMNIX-WEBHOOK-1',
        status: 'pending',
        purpose: 'license_fee',
        amount: 100_000,
        license: 'lic_1',
      } as Record<string, unknown> & { id: string },
    ] as Array<Record<string, unknown> & { id: string }>,
    licenses: [
      { id: 'lic_1', tier: 'starter', status: 'pending_payment', majorVersionCap: 1 },
    ] as Array<Record<string, unknown> & { id: string }>,
  }
  const matches = (doc: Record<string, unknown>, where: Record<string, { equals: unknown }>) =>
    Object.entries(where).every(([k, v]) => doc[k] === v.equals)
  return {
    db,
    find: async ({ collection, where }: { collection: 'payments' | 'licenses'; where: Record<string, { equals: unknown }> }) => ({
      docs: db[collection].filter((d) => matches(d, where)),
    }),
    findByID: async ({ collection, id }: { collection: 'payments' | 'licenses'; id: string }) =>
      db[collection].find((d) => d.id === id),
    update: async ({ collection, id, where, data }: { collection: 'payments' | 'licenses'; id?: string; where?: Record<string, { equals: unknown }>; data: Record<string, unknown> }) => {
      const targets = id !== undefined
        ? db[collection].filter((d) => d.id === id)
        : where
          ? db[collection].filter((d) => matches(d as never, where))
          : db[collection]
      Object.assign(targets[0], data)
      return targets[0]
    },
    create: async () => ({}),
  }
}

const buildReq = (body: unknown, signatureOverride?: string) => {
  const raw = typeof body === 'string' ? body : JSON.stringify(body)
  const sig = signatureOverride ?? createHmac('sha512', TEST_SECRET).update(raw).digest('hex')
  const payload = makeFakePayload()
  return {
    payload,
    text: async () => raw,
    headers: { get: (k: string) => (k.toLowerCase() === 'x-paystack-signature' ? sig : null) },
    user: undefined,
  } as unknown as Parameters<Awaited<ReturnType<typeof loadHandler>>>[0] & { payload: ReturnType<typeof makeFakePayload> }
}

/* ─── Signature gate ───────────────────────────────────────────────── */
describe('paystack webhook: signature gate', () => {
  it('401 when signature is missing', async () => {
    const handler = await loadHandler()
    const req = buildReq({ event: 'charge.success', data: {} }, '') // empty sig header
    const res = await handler(req)
    expect(res.status).toBe(401)
  })

  it('401 when signature is wrong', async () => {
    const handler = await loadHandler()
    const wrong = createHmac('sha512', 'WRONG_KEY').update('{}').digest('hex')
    const req = buildReq({ event: 'charge.success', data: {} }, wrong)
    const res = await handler(req)
    expect(res.status).toBe(401)
  })

  it('200 when signature is valid', async () => {
    const handler = await loadHandler()
    const req = buildReq({ event: 'charge.unknown', data: {} })
    const res = await handler(req)
    expect(res.status).toBe(200)
  })

  it('500 when PAYSTACK_SECRET_KEY is missing', async () => {
    delete process.env.PAYSTACK_SECRET_KEY
    const handler = await loadHandler()
    const req = buildReq({ event: 'charge.success', data: {} })
    const res = await handler(req)
    expect(res.status).toBe(500)
  })
})

/* ─── charge.success ───────────────────────────────────────────────── */
describe('paystack webhook: charge.success', () => {
  it('marks payment success + activates license', async () => {
    const handler = await loadHandler()
    const event = {
      event: 'charge.success',
      data: {
        id: 12345,
        reference: 'OMNIX-WEBHOOK-1',
        channel: 'card',
        fees: 200_000, // kobo
        authorization: { last4: '4321', brand: 'visa', authorization_code: 'AUTH_xyz' },
      },
    }
    const req = buildReq(event)
    const res = await handler(req)
    expect(res.status).toBe(200)
    const db = (req as unknown as { payload: ReturnType<typeof makeFakePayload> }).payload.db
    expect(db.payments[0].status).toBe('success')
    expect(db.licenses[0].status).toBe('active')
  })

  it('idempotent: replaying does not re-activate', async () => {
    const handler = await loadHandler()
    const event = {
      event: 'charge.success',
      data: {
        id: 1,
        reference: 'OMNIX-WEBHOOK-1',
        channel: 'card',
        fees: 0,
      },
    }
    const req = buildReq(event)
    await handler(req)
    const firstPaidAt = (req as unknown as { payload: ReturnType<typeof makeFakePayload> }).payload.db.licenses[0].paidAt

    const req2 = buildReq(event)
    // copy state from req1 into req2 to simulate persistent DB
    const r1Payload = (req as unknown as { payload: ReturnType<typeof makeFakePayload> }).payload
    const r2Payload = (req2 as unknown as { payload: ReturnType<typeof makeFakePayload> }).payload
    r2Payload.db.payments[0] = { ...r1Payload.db.payments[0] }
    r2Payload.db.licenses[0] = { ...r1Payload.db.licenses[0] }

    await handler(req2)
    const secondPaidAt = r2Payload.db.licenses[0].paidAt
    expect(secondPaidAt).toBe(firstPaidAt) // unchanged
  })
})

/* ─── charge.failed ────────────────────────────────────────────────── */
describe('paystack webhook: charge.failed', () => {
  it('marks payment failed without touching the license', async () => {
    const handler = await loadHandler()
    const event = {
      event: 'charge.failed',
      data: {
        reference: 'OMNIX-WEBHOOK-1',
        gateway_response: 'Insufficient funds',
      },
    }
    const req = buildReq(event)
    const res = await handler(req)
    expect(res.status).toBe(200)
    const db = (req as unknown as { payload: ReturnType<typeof makeFakePayload> }).payload.db
    expect(db.payments[0].status).toBe('failed')
    expect(db.payments[0].failureReason).toBe('Insufficient funds')
    expect(db.licenses[0].status).toBe('pending_payment') // unchanged
  })
})

/* ─── unhandled events ─────────────────────────────────────────────── */
describe('paystack webhook: unhandled events', () => {
  it('returns 200 for unknown event types (Paystack expects 2xx)', async () => {
    const handler = await loadHandler()
    const req = buildReq({ event: 'transfer.success', data: { reference: 'X' } })
    const res = await handler(req)
    expect(res.status).toBe(200)
  })
})
