# Payment integration runbook

What this app sends to Paystack + Safaricom Daraja, and how to verify
each path live. The Vitest suite (`tests/payments-daraja.spec.ts`,
`tests/payments-paystack.spec.ts`, `tests/payment-split.spec.ts`) covers
the unit-level + integration assertions. This doc is the manual smoke
test for a freshly-built install.

## Vitest coverage

```
$ pnpm vitest run tests/payments-daraja.spec.ts tests/payments-paystack.spec.ts tests/payment-split.spec.ts

✓ daraja — environment switching (3 tests)
    sandbox URL when testMode is true
    production URL when testMode is false
    defaults to sandbox if no flag (back-compat)
✓ daraja — OAuth header (2 tests)
    Basic auth from consumer key + secret
    propagates errorMessage on 4xx
✓ daraja — STK push initiation (2 tests)
    POSTs the right shape to /mpesa/stkpush/v1/processrequest
    uses production URL when config.test_mode = 0
✓ paystack — secret-key verification (2 tests)
✓ paystack — M-Pesa charge init (2 tests)
✓ paystack — transaction verify (1 test)
✓ payment split — chunk amount per method switch (5 tests)
✓ payment split — total settlement (4 tests)

Total: 21 tests
```

## Live smoke flow on a Tauri build

1. **Connect Daraja in sandbox** — Settings → Payment Settings →
   M-Pesa Daraja section. Paste:
   - Consumer key + secret from the developer.safaricom.co.ke sandbox app
   - Passkey for the Lipa Na M-Pesa Online sandbox shortcode (174379)
   - Shortcode `174379`
   - Tick **Test mode**

   Click **Test connection** — the page should show `✓ Connected` within
   2 seconds. The Vitest suite proves this flow hits
   `https://sandbox.safaricom.co.ke/oauth/v1/generate` with the right
   Basic auth header.

2. **Run an STK push to the sandbox test number**:
   - At POS, ring up any product (e.g. 200 KES)
   - Tap **Pay** → choose M-Pesa
   - Enter phone `254708374149` (Safaricom's documented sandbox test MSISDN)
   - Send STK push

   In sandbox mode the response is auto-completed by Safaricom within
   ~10 seconds — you do NOT need a real phone. The polling loop in
   `DarajaMpesaCharge` queries every 5 s; the new **Check now** button
   triggers an immediate query if you don't want to wait.

3. **What to verify** (each is an automatic toast or screen state):
   - Polling banner shows the elapsed `m:ss` timer
   - **Check now** + **Resend STK** + **Cancel** buttons visible
     during polling
   - On success: green checkmark, cart clears, receipt drawer pops
   - On failure: red icon + the API's error message verbatim + **Try
     again** button

4. **Paystack sandbox** — Settings → Payment Settings → Paystack
   section. Paste your `sk_test_…` secret + `pk_test_…` public, keep
   Test mode on. Click **Test connection**:
   - The verify endpoint hits `https://api.paystack.co/bank?country=kenya`
     (covered by `paystack — secret-key verification` tests)

   Run an M-Pesa charge from POS:
   - Pick any product, tap Pay → M-Pesa
   - Sandbox phone `0712345678` (any number works with test keys —
     the response is canned)
   - Watch the modal: `send_otp` → OTP input → success

## Split-payment flow

Reproduced bug from the user report: "if I put 200 on cash tab, the
inputs of cash carry to mpesa". Fixed in v0.11.6 — switching method
resets the amount input to the **remaining** balance.

To re-verify after a build:
1. Ring up 1500 KES
2. Pay → Cash → type `200` → **Add cash payment**
3. The "Paid so far: 200, remaining: 1300" line appears
4. Switch tab to M-Pesa — the amount input is now `1300.00` (NOT 200)
5. Type `800` → Add M-Pesa payment → remaining = 500
6. Switch to Card → amount input is `500.00`
7. Add → Pay → sale completes

The Vitest assertions (`payment-split.spec.ts`) prove the math; the
manual run proves the UI plumbing.

## STK retry / manual confirm

New in v0.11.6: while the polling loop is waiting:

- **Check now** — fires an immediate `queryStkStatus`. Useful when the
  customer says "I've paid" but the auto-poll hasn't caught up.
- **Resend STK** — re-dials the customer's phone. Use when the
  customer dismissed the prompt by accident.
- **Cancel** — abandons the polling cycle entirely.

Both new buttons use the same Tauri capabilities + URL allowlist that
the initial push uses, so no extra Tauri config is required.

## What the tests catch (and don't)

| Layer | Coverage |
|---|---|
| URL switching sandbox ↔ prod | ✅ unit |
| OAuth Basic auth | ✅ unit |
| STK push payload shape | ✅ unit |
| Paystack /charge payload | ✅ unit |
| Verify endpoints | ✅ unit |
| Error propagation | ✅ unit |
| Split chunk math | ✅ unit |
| Polling success path | ⚠️  manual (needs a Tauri runtime + sandbox server) |
| OTP entry flow | ⚠️  manual (Paystack-side UX) |
| Receipt drawer post-payment | ⚠️  manual |

The unit tests prove "the right bytes go on the wire". The manual run
proves "the user sees the right thing". Both layers together are the
acceptance gate before tagging a release.
