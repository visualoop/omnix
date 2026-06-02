/**
 * Unit tests for src/lib/paystack.ts — the single source of truth for all
 * Paystack HTTP calls. Uses a mocked global.fetch so the tests are
 * deterministic and run without network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  chargeMobileMoney,
  chargeCard,
  submitOtp,
  verify,
  computeAmount,
  newReference,
  type ChargeResponse,
  type PricingShape,
} from '@/lib/paystack'

const TEST_SECRET = 'sk_test_unit'
const ORIG_SECRET = process.env.PAYSTACK_SECRET_KEY

beforeEach(() => {
  process.env.PAYSTACK_SECRET_KEY = TEST_SECRET
  // reset the fetch spy each test
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
  process.env.PAYSTACK_SECRET_KEY = ORIG_SECRET
})

const okJson = (data: Record<string, unknown>) =>
  ({
    ok: true,
    status: 200,
    json: async () => ({ status: true, message: 'ok', data }),
  }) as unknown as Response

const errJson = (status: number, message: string) =>
  ({
    ok: false,
    status,
    json: async () => ({ status: false, message }),
  }) as unknown as Response

const lastFetchCall = () => {
  const f = global.fetch as unknown as ReturnType<typeof vi.fn>
  return f.mock.calls[f.mock.calls.length - 1]
}

/* ─── newReference ─────────────────────────────────────────────────── */
describe('newReference', () => {
  it('produces a unique uppercase-suffixed reference with prefix', () => {
    const a = newReference('OMNIX')
    const b = newReference('OMNIX')
    expect(a).toMatch(/^OMNIX-\d{10,}-[A-Z0-9]{6}$/)
    expect(a).not.toBe(b)
  })
  it('respects custom prefix', () => {
    expect(newReference('PHARM')).toMatch(/^PHARM-\d{10,}-[A-Z0-9]{6}$/)
  })
})

/* ─── computeAmount ────────────────────────────────────────────────── */
describe('computeAmount', () => {
  const pricing: PricingShape = {
    starter: { oneTimeFee: 100_000, maintenanceYearly: 12_000 },
    business: { oneTimeFee: 200_000, maintenanceYearly: 24_000 },
    cloudBackupMonthly: 500,
    extraBranchOneTime: 15_000,
    extraMachineOneTime: 5_000,
    majorUpgradeDiscount: 50,
  }

  it('starter license_fee = 100k', () => {
    expect(computeAmount(pricing, 'starter', 'license_fee')).toBe(100_000)
  })
  it('business license_fee = 200k', () => {
    expect(computeAmount(pricing, 'business', 'license_fee')).toBe(200_000)
  })
  it('starter maintenance_renewal = 12k', () => {
    expect(computeAmount(pricing, 'starter', 'maintenance_renewal')).toBe(12_000)
  })
  it('starter major_upgrade discounts 50%', () => {
    expect(computeAmount(pricing, 'starter', 'major_upgrade')).toBe(50_000)
  })
  it('cloud_backup = 500/month', () => {
    expect(computeAmount(pricing, 'starter', 'cloud_backup')).toBe(500)
  })
  it('extra_branch / extra_machine pass through', () => {
    expect(computeAmount(pricing, 'starter', 'extra_branch')).toBe(15_000)
    expect(computeAmount(pricing, 'starter', 'extra_machine')).toBe(5_000)
  })
  it('falls back to defaults when pricing missing', () => {
    expect(computeAmount({}, 'starter', 'license_fee')).toBe(100_000)
    expect(computeAmount({}, 'starter', 'maintenance_renewal')).toBe(12_000)
    expect(computeAmount({}, 'starter', 'cloud_backup')).toBe(500)
  })
})

/* ─── chargeMobileMoney ────────────────────────────────────────────── */
describe('chargeMobileMoney', () => {
  it('hits POST /charge with mpesa payload + bearer auth', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      okJson({
        reference: 'OMNIX-1-X',
        status: 'pay_offline',
        display_text: 'Confirm M-Pesa STK on your phone',
      }),
    )
    const out = await chargeMobileMoney({
      email: 'q@example.com',
      amountKobo: 10_000_000, // 100k KES
      phone: '0712345678',
      reference: 'OMNIX-1-X',
    })
    const [url, init] = lastFetchCall() as [string, RequestInit]
    expect(url).toBe('https://api.paystack.co/charge')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TEST_SECRET}`)
    const body = JSON.parse(init.body as string)
    expect(body.currency).toBe('KES')
    expect(body.amount).toBe(10_000_000)
    expect(body.mobile_money).toEqual({ phone: '+254712345678', provider: 'mpesa' })
    expect(body.metadata.channel).toBe('mobile_money')
    expect(out.status).toBe('pay_offline')
    expect(out.displayText).toMatch(/STK/)
  })

  it.each([
    ['0712345678', '+254712345678'],
    ['254712345678', '+254712345678'],
    ['+254712345678', '+254712345678'],
    ['712345678', '+254712345678'],
  ])('normalises phone %s → %s', async (input, expected) => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      okJson({ reference: 'r', status: 'pay_offline' }),
    )
    await chargeMobileMoney({
      email: 'q@example.com',
      amountKobo: 100,
      phone: input,
      reference: 'r',
    })
    const body = JSON.parse((lastFetchCall()![1] as RequestInit).body as string)
    expect(body.mobile_money.phone).toBe(expected)
  })

  it('throws when Paystack rejects', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      errJson(400, 'Invalid phone'),
    )
    await expect(
      chargeMobileMoney({ email: 'a@b', amountKobo: 1, phone: '07x', reference: 'r' }),
    ).rejects.toThrow(/Invalid phone/)
  })
})

/* ─── chargeCard ───────────────────────────────────────────────────── */
describe('chargeCard', () => {
  it('forwards encryptedCard verbatim and returns send_otp shape', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      okJson({
        reference: 'OMNIX-2-X',
        status: 'send_otp',
        display_text: 'Enter the OTP from SMS',
      }),
    )
    const out = await chargeCard({
      email: 'q@example.com',
      amountKobo: 100,
      encryptedCard: 'ENC_BLOB_xxx',
      reference: 'OMNIX-2-X',
    })
    const body = JSON.parse((lastFetchCall()![1] as RequestInit).body as string)
    expect(body.card).toBe('ENC_BLOB_xxx')
    expect(body.metadata.channel).toBe('card')
    expect(out.status).toBe('send_otp')
    expect(out.displayText).toMatch(/OTP/)
  })

  it('parses open_url (3DS) responses', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      okJson({
        reference: 'r',
        status: 'open_url',
        url: 'https://standard.paystack.co/3ds/abc',
      }),
    )
    const out: ChargeResponse = await chargeCard({
      email: 'a@b.c',
      amountKobo: 1,
      encryptedCard: 'x',
      reference: 'r',
    })
    expect(out.status).toBe('open_url')
    expect(out.redirectUrl).toContain('standard.paystack.co')
  })
})

/* ─── submitOtp ────────────────────────────────────────────────────── */
describe('submitOtp', () => {
  it('hits /charge/submit_otp', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      okJson({ reference: 'OMNIX-3', status: 'success' }),
    )
    const out = await submitOtp({ reference: 'OMNIX-3', otp: '123456' })
    const [url, init] = lastFetchCall() as [string, RequestInit]
    expect(url).toBe('https://api.paystack.co/charge/submit_otp')
    expect(JSON.parse(init.body as string)).toEqual({ reference: 'OMNIX-3', otp: '123456' })
    expect(out.status).toBe('success')
  })

  it('throws on invalid otp response', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      errJson(400, 'Invalid OTP'),
    )
    await expect(submitOtp({ reference: 'r', otp: '0000' })).rejects.toThrow(/Invalid OTP/)
  })
})

/* ─── verify ───────────────────────────────────────────────────────── */
describe('verify', () => {
  it('maps "success" + amount kobo → KES', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      okJson({ status: 'success', amount: 10_000_000 }),
    )
    const out = await verify('OMNIX-9')
    expect(out.status).toBe('success')
    expect(out.amountKES).toBe(100_000)
  })

  it.each([['failed'], ['abandoned'], ['reversed']])(
    'maps "%s" → failed',
    async (s) => {
      ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        okJson({ status: s, amount: 0 }),
      )
      const out = await verify('r')
      expect(out.status).toBe('failed')
    },
  )

  it('maps "ongoing" / unknown → pending', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      okJson({ status: 'ongoing', amount: 0 }),
    )
    const out = await verify('r')
    expect(out.status).toBe('pending')
  })

  it('throws when /verify HTTP errors', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      errJson(500, 'oops'),
    )
    await expect(verify('r')).rejects.toThrow(/verify failed/)
  })
})
