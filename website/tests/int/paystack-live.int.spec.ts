/**
 * LIVE smoke tests against api.paystack.co using TEST keys.
 * Skipped by default — opt-in via PAYSTACK_LIVE=1.
 *
 *   PAYSTACK_LIVE=1 \
 *   PAYSTACK_SECRET_KEY=sk_test_… \
 *   pnpm test:int
 *
 * These tests prove the wrapper + keys + Paystack reachability work
 * end-to-end against the real test environment. They use Paystack's
 * official Kenyan M-Pesa sandbox phone (+254 710 000 000) which
 * auto-approves charges in test mode.
 */
import { describe, it, expect } from 'vitest'
import { chargeMobileMoney, chargeCard, verify, newReference } from '@/lib/paystack'

const RUN = process.env.PAYSTACK_LIVE === '1'
const d = RUN ? describe : describe.skip

const TEST_PHONE = '+254710000000' // official Paystack KE test number
const TEST_AMOUNT_KOBO = 10_000 // 100 KES — Paystack test floor
const TEST_EMAIL = 'qa+omnix@example.com'

d('LIVE: paystack /charge mpesa + /verify roundtrip', () => {
  it('M-Pesa charge with the test number returns success in test mode', async () => {
    expect(process.env.PAYSTACK_SECRET_KEY).toMatch(/^sk_test_/)
    const ref = newReference('OMNIX-LIVE')
    const out = await chargeMobileMoney({
      email: TEST_EMAIL,
      amountKobo: TEST_AMOUNT_KOBO,
      phone: TEST_PHONE,
      reference: ref,
      metadata: { test: true, source: 'omnix-int-suite' },
    })
    expect(out.reference).toBe(ref)
    // In test mode, the test phone returns 'success' immediately.
    // We accept the broader set in case Paystack changes behavior.
    expect(['success', 'pay_offline', 'pending']).toContain(out.status)
  }, 15_000)

  it('charge → verify roundtrip: amount + status survive', async () => {
    const ref = newReference('OMNIX-LIVE-VFY')
    await chargeMobileMoney({
      email: TEST_EMAIL,
      amountKobo: TEST_AMOUNT_KOBO,
      phone: TEST_PHONE,
      reference: ref,
    })
    // give Paystack a moment
    await new Promise((r) => setTimeout(r, 1500))
    const v = await verify(ref)
    expect(['success', 'pending']).toContain(v.status)
    if (v.status === 'success') {
      expect(v.amountKES).toBe(100) // 10_000 kobo / 100 = 100 KES
      expect(v.raw.channel).toBe('mobile_money')
    }
  }, 20_000)

  it('rejects a placeholder encrypted card payload with a clear error', async () => {
    await expect(
      chargeCard({
        email: TEST_EMAIL,
        amountKobo: TEST_AMOUNT_KOBO,
        encryptedCard: 'NOT_A_REAL_ENCRYPTED_PAYLOAD',
        reference: newReference('OMNIX-LIVE-CARD'),
      }),
    ).rejects.toThrow(/card|invalid|key/i)
  }, 10_000)

  it('rejects M-Pesa charges with a non-test phone in test mode (Paystack policy)', async () => {
    await expect(
      chargeMobileMoney({
        email: TEST_EMAIL,
        amountKobo: TEST_AMOUNT_KOBO,
        phone: '+254712345678', // a regular phone, not the test number
        reference: newReference('OMNIX-LIVE-NEG'),
      }),
    ).rejects.toThrow(/Charge attempted|test mobile money/i)
  }, 10_000)
})
