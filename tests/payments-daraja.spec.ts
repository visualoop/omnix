/**
 * Daraja (M-Pesa) integration tests.
 *
 * Mocks the global fetch so we can assert the EXACT URLs + headers +
 * payload shape sent to Safaricom's API. The real network is never
 * touched — these tests are hermetic and run on every CI build.
 *
 * Specifically verifies the bug-class the user has been hitting:
 *   - sandbox.safaricom.co.ke vs api.safaricom.co.ke depending on
 *     test_mode flag (was always sandbox before v0.11.5)
 *   - OAuth Basic auth header is constructed correctly
 *   - STK push payload contains shortcode + password + amount + phone
 *
 * Stub coverage: query<T>() + execute() from "@/lib/db" — those hit a
 * Tauri SQLite plugin that doesn't exist in vitest's jsdom env. We
 * provide a minimal in-memory replacement so the service layer compiles
 * and runs.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// ── In-memory db stub. Real services use these as side-effect-only
// calls (read config from settings, write tokens, etc.) so the stub
// returns whatever the test seeds via setRows().
const memory: { rows: unknown[] } = { rows: [] }
const setRows = (rows: unknown[]) => {
  memory.rows = rows
}

vi.mock("@/lib/db", () => ({
  query: vi.fn(async () => memory.rows),
  execute: vi.fn(async () => undefined),
}))

vi.mock("@/lib/locale", () => ({
  formatMoney: (n: number) => `KES ${n}`,
  formatNumber: (n: number) => String(n),
}))

// Country store stub so any indirect imports don't fail in jsdom.
vi.mock("@/stores/country", () => ({
  useCountry: { getState: () => ({ code: "KE" }) },
}))

// daraja.ts uses tauri-plugin-http's fetch (not the global). Mocking
// the module here so every fetch call in the service routes to our spy.
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

describe("daraja — environment switching", () => {
  it("verifyDarajaKey hits the sandbox URL when testMode is true", async () => {
    const { verifyDarajaKey } = await import("@/services/daraja")
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "abc" }), { status: 200 }))

    await verifyDarajaKey("ck", "cs", true)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toContain("https://sandbox.safaricom.co.ke")
    expect(url).toContain("/oauth/v1/generate")
    expect(url).toContain("grant_type=client_credentials")
  })

  it("verifyDarajaKey hits PRODUCTION URL when testMode is false", async () => {
    const { verifyDarajaKey } = await import("@/services/daraja")
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "abc" }), { status: 200 }))

    await verifyDarajaKey("ck", "cs", false)

    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toContain("https://api.safaricom.co.ke")
    expect(url).not.toContain("sandbox")
  })

  it("verifyDarajaKey defaults to sandbox if no flag is passed (back-compat)", async () => {
    const { verifyDarajaKey } = await import("@/services/daraja")
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "abc" }), { status: 200 }))

    await verifyDarajaKey("ck", "cs")

    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toContain("https://sandbox.safaricom.co.ke")
  })
})

describe("daraja — OAuth header", () => {
  it("constructs Basic auth from consumer key + secret", async () => {
    const { verifyDarajaKey } = await import("@/services/daraja")
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "abc" }), { status: 200 }))

    await verifyDarajaKey("MY_KEY", "MY_SECRET", true)

    const init = fetchSpy.mock.calls[0][1] as RequestInit
    const expected = btoa("MY_KEY:MY_SECRET")
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${expected}`)
  })

  it("returns ok=false with the API's errorMessage on 4xx", async () => {
    const { verifyDarajaKey } = await import("@/services/daraja")
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ errorMessage: "Invalid Authentication passed" }),
        { status: 400 },
      ),
    )

    const result = await verifyDarajaKey("wrong", "creds", true)

    expect(result.ok).toBe(false)
    expect(result.error).toBe("Invalid Authentication passed")
  })
})

describe("daraja — STK push initiation", () => {
  it("POSTs to /mpesa/stkpush/v1/processrequest with the right payload shape", async () => {
    setRows([
      {
        id: "daraja",
        name: "M-Pesa Daraja",
        public_key: "ck",
        secret_key: "cs",
        passkey: "pass",
        shortcode: "174379",
        test_mode: 1,
        active: 1,
      },
    ])
    const { initiateStkPush } = await import("@/services/daraja")

    // First call → OAuth, second call → STK push
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "test_token", expires_in: "3599" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            CheckoutRequestID: "ws_CO_111",
            MerchantRequestID: "12345-67890-1",
            ResponseCode: "0",
            ResponseDescription: "Success. Request accepted for processing",
          }),
          { status: 200 },
        ),
      )

    const res = await initiateStkPush({
      amount: 200,
      phone: "0712345678",
      accountRef: "TEST-001",
      transactionDesc: "Vitest run",
    })

    expect(res.checkoutRequestId).toBe("ws_CO_111")
    expect(res.merchantRequestId).toBe("12345-67890-1")

    const stkCall = fetchSpy.mock.calls[1]
    const stkUrl = stkCall[0] as string
    const stkInit = stkCall[1] as RequestInit
    expect(stkUrl).toContain("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest")
    expect((stkInit.headers as Record<string, string>).Authorization).toBe("Bearer test_token")

    const body = JSON.parse(stkInit.body as string)
    expect(body.BusinessShortCode).toBe("174379")
    expect(body.Amount).toBe(200)
    // Sandbox normalises 07xx → 2547xx
    expect(body.PartyA).toBe("254712345678")
    expect(body.PartyB).toBe("174379")
    expect(body.PhoneNumber).toBe("254712345678")
    expect(body.AccountReference).toBe("TEST-001")
    expect(body.TransactionDesc).toBe("Vitest run")
    expect(body.TransactionType).toBe("CustomerPayBillOnline")
    // Password = base64(shortcode + passkey + timestamp)
    expect(typeof body.Password).toBe("string")
    expect(typeof body.Timestamp).toBe("string")
    expect(body.Timestamp).toMatch(/^\d{14}$/)
  })

  it("uses production URL when config.test_mode = 0", async () => {
    setRows([
      {
        id: "daraja",
        name: "M-Pesa Daraja",
        public_key: "ck",
        secret_key: "cs",
        passkey: "pass",
        shortcode: "174379",
        test_mode: 0,
        active: 1,
      },
    ])
    const { initiateStkPush } = await import("@/services/daraja")

    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "prod_token" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            CheckoutRequestID: "ws_CO_222",
            MerchantRequestID: "55555-22222-2",
            ResponseCode: "0",
            ResponseDescription: "ok",
          }),
          { status: 200 },
        ),
      )

    await initiateStkPush({
      amount: 50,
      phone: "254700000000",
      accountRef: "PROD-1",
      transactionDesc: "live",
    })

    expect(fetchSpy.mock.calls[0][0]).toContain("https://api.safaricom.co.ke")
    expect(fetchSpy.mock.calls[1][0]).toContain("https://api.safaricom.co.ke")
  })
})
