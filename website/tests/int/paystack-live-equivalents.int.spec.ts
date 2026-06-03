/**
 * Mocked equivalents of the Paystack-live integration tests.
 *
 * These run in CI without IP allowlisting. They cover the same four
 * scenarios that paystack-live.int.spec.ts hits against real Paystack:
 *
 *   1. M-Pesa charge with the test number returns success
 *   2. charge → verify roundtrip preserves amount + status
 *   3. Bad encrypted card payload is rejected with a clear error
 *   4. Non-test phone in test mode is rejected ("use test mobile money number")
 *
 * The fetch global is stubbed to return Paystack-shaped JSON. Every assertion
 * matches what we'd see live, just deterministically + offline.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { chargeMobileMoney, chargeCard, verify, newReference } from '@/lib/paystack'

const TEST_PHONE = '+254710000000'

beforeEach(() => {
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_mocked_paystack_unit_key'
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const ok = (data: Record<string, unknown>) =>
  ({ ok: true, status: 200, json: async () => ({ status: true, message: 'ok', data }) }) as unknown as Response

const err = (status: number, message: string, data?: Record<string, unknown>) =>
  ({
    ok: false,
    status,
    json: async () => ({ status: false, message, ...(data ? { data } : {}) }),
  }) as unknown as Response

const mock = () => global.fetch as unknown as ReturnType<typeof vi.fn>

describe('paystack live-equivalents (mocked)', () => {
  it('1) M-Pesa charge with the test number returns success status', async () => {
    mock().mockResolvedValueOnce(
      ok({
        reference: 'OMNIX-MOCK-1',
        status: 'success',
        message: 'Approved',
        amount: 10_000,
      }),
    )
    const out = await chargeMobileMoney({
      email: 'qa+omnix@example.com',
      amountKobo: 10_000,
      phone: TEST_PHONE,
      reference: 'OMNIX-MOCK-1',
    })
    expect(out.status).toBe('success')
    expect(out.reference).toBe('OMNIX-MOCK-1')
  })

  it('2) charge → verify roundtrip: amount + status survive', async () => {
    const ref = newReference('OMNIX-RT')
    mock().mockResolvedValueOnce(ok({ reference: ref, status: 'success' }))
    mock().mockResolvedValueOnce(ok({ status: 'success', amount: 10_000, channel: 'mobile_money' }))

    await chargeMobileMoney({
      email: 'qa+omnix@example.com',
      amountKobo: 10_000,
      phone: TEST_PHONE,
      reference: ref,
    })
    const v = await verify(ref)
    expect(v.status).toBe('success')
    expect(v.amountKES).toBe(100)
    expect(v.raw.channel).toBe('mobile_money')
  })

  it('3) bad encrypted card payload is rejected with a clear error', async () => {
    mock().mockResolvedValueOnce(err(400, 'Invalid encrypted card data'))
    await expect(
      chargeCard({
        email: 'qa+omnix@example.com',
        amountKobo: 10_000,
        encryptedCard: 'NOT_A_REAL_ENCRYPTED_PAYLOAD',
        reference: newReference('OMNIX-CARD'),
      }),
    ).rejects.toThrow(/Invalid encrypted card/i)
  })

  it('4) non-test phone in test mode is rejected', async () => {
    mock().mockResolvedValueOnce(
      err(400, 'Charge attempted', {
        status: 'failed',
        message: 'Declined. Please use the test mobile money number since you are doing a test transaction.',
      }),
    )
    await expect(
      chargeMobileMoney({
        email: 'qa+omnix@example.com',
        amountKobo: 10_000,
        phone: '+254712345678',
        reference: newReference('OMNIX-NEG'),
      }),
    ).rejects.toThrow(/Charge attempted|test mobile money/i)
  })
})

describe('paystack live-equivalents: extra failure cases', () => {
  it('insufficient funds → error surfaces', async () => {
    mock().mockResolvedValueOnce(err(402, 'Insufficient funds'))
    await expect(
      chargeMobileMoney({
        email: 'qa@x.com',
        amountKobo: 100,
        phone: TEST_PHONE,
        reference: 'r',
      }),
    ).rejects.toThrow(/Insufficient/i)
  })

  it('rate-limited → error surfaces', async () => {
    mock().mockResolvedValueOnce(err(429, 'Too many requests'))
    await expect(verify('r')).rejects.toThrow()
  })

  it('5xx upstream → error surfaces', async () => {
    mock().mockResolvedValueOnce(err(503, 'Service unavailable'))
    await expect(verify('r')).rejects.toThrow()
  })
})
