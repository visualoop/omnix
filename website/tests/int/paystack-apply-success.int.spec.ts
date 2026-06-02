/**
 * Tests for applyPaymentSuccess() — the function that translates a
 * successful Paystack charge into business-state changes on the Payment
 * + License records. Uses a tiny in-memory fake Payload so we don't
 * need a database.
 *
 * Covered cases:
 *   • license_fee   → license becomes active + maintenanceUntil += 1y
 *   • maintenance_renewal → extends maintenanceUntil by 1y from current end
 *   • major_upgrade → bumps majorVersionCap by 1
 *   • cloud_backup  → extends cloudBackupExpiresAt by 1m
 *   • idempotent    → calling twice on a successful payment is a no-op
 *   • mpesa channel → channel mapped from "mobile_money" → "mpesa"
 *   • payment not found → silently no-op
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { applyPaymentSuccess } from '@/lib/paystack'

type Doc = Record<string, unknown> & { id: string | number }

interface Collections {
  payments: Doc[]
  licenses: Doc[]
}

/** Minimal Payload-shaped fake good enough for applyPaymentSuccess */
function makeFakePayload(seed: Partial<Collections> = {}) {
  const db: Collections = {
    payments: seed.payments ? [...seed.payments] : [],
    licenses: seed.licenses ? [...seed.licenses] : [],
  }

  const matches = (doc: Doc, where: Record<string, { equals: unknown }>) => {
    return Object.entries(where).every(([k, v]) => doc[k] === v.equals)
  }

  const fake = {
    db,
    find: async ({
      collection,
      where,
      depth: _depth,
    }: {
      collection: keyof Collections
      where: Record<string, { equals: unknown }>
      limit?: number
      depth?: number
    }) => {
      const docs = db[collection].filter((d) => matches(d, where))
      return { docs }
    },
    findByID: async ({ collection, id }: { collection: keyof Collections; id: string | number }) => {
      const doc = db[collection].find((d) => String(d.id) === String(id))
      if (!doc) throw new Error('Not found')
      return doc
    },
    update: async ({
      collection,
      id,
      data,
    }: {
      collection: keyof Collections
      id?: string | number
      where?: Record<string, { equals: unknown }>
      data: Record<string, unknown>
    }) => {
      const targets = id !== undefined
        ? db[collection].filter((d) => String(d.id) === String(id))
        : db[collection]
      Object.assign(targets[0], data)
      return targets[0]
    },
    create: async ({ collection, data }: { collection: keyof Collections; data: Record<string, unknown> }) => {
      const doc = { id: String(db[collection].length + 1), ...data } as Doc
      db[collection].push(doc)
      return doc
    },
  }
  return fake
}

const baseLicense = (overrides: Partial<Doc> = {}): Doc => ({
  id: 'lic_1',
  tier: 'starter',
  status: 'pending_payment',
  majorVersionCap: 1,
  ...overrides,
})

const basePayment = (overrides: Partial<Doc> = {}): Doc => ({
  id: 'pay_1',
  paystackReference: 'OMNIX-TEST-1',
  status: 'pending',
  purpose: 'license_fee',
  amount: 100_000,
  license: 'lic_1',
  ...overrides,
})

const paystackData = (over: Record<string, unknown> = {}) => ({
  id: 999_888,
  channel: 'card',
  fees: 200_000, // kobo
  authorization: { last4: '4321', brand: 'visa', authorization_code: 'AUTH_xyz' },
  ...over,
})

let payload: ReturnType<typeof makeFakePayload>
beforeEach(() => {
  payload = makeFakePayload()
})

describe('applyPaymentSuccess: license_fee', () => {
  it('marks payment success + activates license + sets 1-year maintenance', async () => {
    payload = makeFakePayload({
      payments: [basePayment()],
      licenses: [baseLicense()],
    })
    const before = Date.now()
    await applyPaymentSuccess(payload as never, 'OMNIX-TEST-1', paystackData())

    const pay = payload.db.payments[0]
    expect(pay.status).toBe('success')
    expect(pay.cardLast4).toBe('4321')
    expect(pay.cardBrand).toBe('visa')
    expect(pay.netAmount).toBe(100_000 - 2000) // fees converted from kobo (200000 / 100)

    const lic = payload.db.licenses[0]
    expect(lic.status).toBe('active')
    expect(lic.priceFeePaid).toBe(100_000)
    const maintUntilMs = new Date(lic.maintenanceUntil as string).getTime()
    expect(maintUntilMs).toBeGreaterThan(before + 364 * 24 * 60 * 60 * 1000)
  })

  it('maps M-Pesa channel "mobile_money" → "mpesa"', async () => {
    payload = makeFakePayload({
      payments: [basePayment()],
      licenses: [baseLicense()],
    })
    await applyPaymentSuccess(payload as never, 'OMNIX-TEST-1', paystackData({ channel: 'mobile_money' }))
    expect(payload.db.payments[0].channel).toBe('mpesa')
  })
})

describe('applyPaymentSuccess: maintenance_renewal', () => {
  it('extends maintenanceUntil by 1 year from existing end', async () => {
    const existingEnd = new Date('2027-01-01T00:00:00Z')
    payload = makeFakePayload({
      payments: [basePayment({ purpose: 'maintenance_renewal' })],
      licenses: [baseLicense({ status: 'active', maintenanceUntil: existingEnd.toISOString() })],
    })
    await applyPaymentSuccess(payload as never, 'OMNIX-TEST-1', paystackData())
    const newEnd = new Date(payload.db.licenses[0].maintenanceUntil as string)
    expect(newEnd.toISOString()).toBe(new Date('2028-01-01T00:00:00.000Z').toISOString())
  })

  it('extends from now() when license has no current maintenanceUntil', async () => {
    payload = makeFakePayload({
      payments: [basePayment({ purpose: 'maintenance_renewal' })],
      licenses: [baseLicense({ status: 'active' })],
    })
    const before = Date.now()
    await applyPaymentSuccess(payload as never, 'OMNIX-TEST-1', paystackData())
    const newEnd = new Date(payload.db.licenses[0].maintenanceUntil as string).getTime()
    expect(newEnd).toBeGreaterThan(before + 364 * 24 * 60 * 60 * 1000)
  })
})

describe('applyPaymentSuccess: major_upgrade', () => {
  it('increments majorVersionCap', async () => {
    payload = makeFakePayload({
      payments: [basePayment({ purpose: 'major_upgrade' })],
      licenses: [baseLicense({ majorVersionCap: 2 })],
    })
    await applyPaymentSuccess(payload as never, 'OMNIX-TEST-1', paystackData())
    expect(payload.db.licenses[0].majorVersionCap).toBe(3)
  })
})

describe('applyPaymentSuccess: cloud_backup', () => {
  it('extends cloudBackupExpiresAt by ~30 days', async () => {
    const existing = new Date('2027-06-01T00:00:00Z')
    payload = makeFakePayload({
      payments: [basePayment({ purpose: 'cloud_backup' })],
      licenses: [baseLicense({ cloudBackupExpiresAt: existing.toISOString() })],
    })
    await applyPaymentSuccess(payload as never, 'OMNIX-TEST-1', paystackData())
    const newEnd = new Date(payload.db.licenses[0].cloudBackupExpiresAt as string)
    // 30 days later
    expect(newEnd.toISOString()).toBe(new Date('2027-07-01T00:00:00.000Z').toISOString())
  })
})

describe('applyPaymentSuccess: idempotency', () => {
  it('does not re-extend maintenance when called twice on same payment', async () => {
    payload = makeFakePayload({
      payments: [basePayment()],
      licenses: [baseLicense()],
    })
    await applyPaymentSuccess(payload as never, 'OMNIX-TEST-1', paystackData())
    const firstEnd = payload.db.licenses[0].maintenanceUntil

    await applyPaymentSuccess(payload as never, 'OMNIX-TEST-1', paystackData()) // replay
    const secondEnd = payload.db.licenses[0].maintenanceUntil

    expect(secondEnd).toBe(firstEnd) // unchanged
  })
})

describe('applyPaymentSuccess: edge cases', () => {
  it('no-op when payment reference is unknown', async () => {
    payload = makeFakePayload({ payments: [], licenses: [] })
    await expect(
      applyPaymentSuccess(payload as never, 'NOPE', paystackData()),
    ).resolves.toBeUndefined()
  })

  it('no-op when payment has no license link', async () => {
    payload = makeFakePayload({
      payments: [basePayment({ license: undefined })],
      licenses: [baseLicense()],
    })
    await applyPaymentSuccess(payload as never, 'OMNIX-TEST-1', paystackData())
    // payment marked success, license untouched
    expect(payload.db.payments[0].status).toBe('success')
    expect(payload.db.licenses[0].status).toBe('pending_payment')
  })
})
