/**
 * Paystack integration tests.
 *
 * Same approach as payments-daraja.spec.ts — mocks tauri-plugin-http's
 * fetch and asserts every URL + payload sent to api.paystack.co matches
 * the documented API contract.
 *
 * Covers:
 *   - Secret-key verification hits /bank?country=kenya with Bearer auth
 *   - M-Pesa charge initialization sends the right shape (amount in
 *     cents, currency KES, mobile_money provider mpesa, normalised
 *     phone)
 *   - Transaction verify hits /transaction/verify/{ref}
 *   - 4xx responses return the API's error message verbatim
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const memory: { rows: unknown[] } = { rows: [] }
const setRows = (rows: unknown[]) => {
  memory.rows = rows
}

vi.mock("@/lib/db", () => ({
  query: vi.fn(async () => memory.rows),
  execute: vi.fn(async () => undefined),
}))

vi.mock("@/stores/country", () => ({
  useCountry: { getState: () => ({ code: "KE" }) },
}))

let fetchSpy: ReturnType<typeof vi.fn>

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: (...args: unknown[]) => fetchSpy(...args),
}))

beforeEach(() => {
  fetchSpy = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("paystack — secret-key verification", () => {
  it("hits /bank?country=kenya with Bearer auth", async () => {
    const { verifyPaystackKey } = await import("@/services/paystack")
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ status: true, data: [] }), { status: 200 }))

    const result = await verifyPaystackKey("sk_test_abc")

    expect(result.ok).toBe(true)
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toBe("https://api.paystack.co/bank?country=kenya")
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_abc")
  })

  it("returns the API's error message on 401", async () => {
    const { verifyPaystackKey } = await import("@/services/paystack")
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: false, message: "Invalid key" }), { status: 401 }),
    )

    const result = await verifyPaystackKey("sk_bad")

    expect(result.ok).toBe(false)
    expect(result.error).toContain("Invalid key")
  })
})

describe("paystack — M-Pesa charge init", () => {
  it("POSTs to /charge with amount in cents + KES + mobile_money payload", async () => {
    setRows([
      {
        id: "paystack",
        public_key: "pk_test_1",
        secret_key: "sk_test_2",
        test_mode: 1,
        active: 1,
      },
    ])
    const { initiateMpesaCharge } = await import("@/services/paystack")

    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: true,
          message: "Charge attempted",
          data: {
            reference: "ref_test_111",
            status: "send_otp",
            display_text: "Please enter the OTP sent to your phone",
            currency: "KES",
            amount: 20000,
          },
        }),
        { status: 200 },
      ),
    )

    const res = await initiateMpesaCharge({
      amount: 200,
      phone: "0712345678",
      email: "test@omnix.co.ke",
      saleId: "TEST-SALE-1",
    })

    expect(res.reference).toBe("ref_test_111")
    expect(res.display_text).toContain("OTP")

    const call = fetchSpy.mock.calls[0]
    expect(call[0]).toBe("https://api.paystack.co/charge")
    const init = call[1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_2")
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json")

    const body = JSON.parse(init.body as string)
    expect(body.email).toBe("test@omnix.co.ke")
    // 200 KES → 20000 cents
    expect(body.amount).toBe(20000)
    expect(body.currency).toBe("KES")
    expect(body.mobile_money).toEqual({ phone: "254712345678", provider: "mpesa" })
  })

  it("propagates API error message on bad credentials", async () => {
    setRows([
      {
        id: "paystack",
        public_key: "pk_test_1",
        secret_key: "sk_test_wrong",
        test_mode: 1,
        active: 1,
      },
    ])
    const { initiateMpesaCharge } = await import("@/services/paystack")

    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: false,
          message: "Invalid key. Provide a valid Paystack secret key",
        }),
        { status: 401 },
      ),
    )

    await expect(
      initiateMpesaCharge({
        amount: 100,
        phone: "0700000000",
        email: "x@example.com",
      }),
    ).rejects.toThrow(/Invalid key/i)
  })
})

describe("paystack — transaction verify", () => {
  it("hits /transaction/verify/{ref}", async () => {
    setRows([
      {
        id: "paystack",
        public_key: "pk_test_1",
        secret_key: "sk_test_2",
        test_mode: 1,
        active: 1,
      },
    ])
    const { verifyTransaction } = await import("@/services/paystack")

    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: true,
          data: {
            reference: "ref_test_111",
            status: "success",
            amount: 20000,
            currency: "KES",
          },
        }),
        { status: 200 },
      ),
    )

    const out = await verifyTransaction("ref_test_111")

    expect(out.status).toBe("success")
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toBe("https://api.paystack.co/transaction/verify/ref_test_111")
  })
})
