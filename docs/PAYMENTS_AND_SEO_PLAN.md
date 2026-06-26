# Payments + Cart UX + SEO — full audit and plan

Triggered by a flurry of user reports stacked on top of each other:

> "the split UI has quirks like I entered 2k in cash, clicked split,
> then selected M-Pesa — I don't even see what amount is remaining to
> enter in the M-Pesa input. Completely redo that UI for payments —
> has a lot of quirks."

Plus earlier asks:
- M-Pesa / Paystack / Visa / Mastercard branded SVGs everywhere
- Settings → Payments should show the brand chip per provider
- Customer display should reflect the brand mid-payment
- Cart needs "tap quantity → type the number" instead of +/- only
- Virtual on-screen keyboard for touch terminals
- SEO sweep using Kenya search-intent (POS with M-Pesa, eTIMS, etc.)
- Seed admin image slots so the marketing site looks complete
- Use Paystack Popup (not custom card UI) so 3DS + fraud rules apply
- M-Pesa polling needs to handle the sandbox's "pending forever"
- Paybill + Till manual entry (the actual flow most Kenyan SMEs use)
- Scrollable dialogs — current payment dialog expands off-screen

## Research findings (June 2026)

### Paystack — official guidance
- Recommended: **Paystack Popup (InlineJS V2)** — it's the iframe-hosted checkout. Card data never touches our code; Paystack handles 3DS, OTP, fraud rules. Reduces our PCI exposure to zero and reduces fraud flag rate to nearly zero because RAMS (Paystack's risk engine) sees the standard checkout fingerprint, not a custom flow.
- Custom card UIs trigger their RAMS risk model more aggressively because they look like a card-testing pattern.
- For mobile money (M-Pesa via Paystack): the `/charge` endpoint with `mobile_money: { phone, provider: "mpesa" }` is still fine — there's no card data to PCI-scope.
- We'll switch the **card** flow to Paystack Popup and keep the **mobile money** flow on `/charge`.

### M-Pesa polling
- Sandbox's STK push query returns `ResultCode: "1032"` ("Request cancelled by user") OR an empty pending state on bad days (per Sim-Pesa community docs).
- Best practice: poll every 5s for ~180s, then surface a "Pending — verify manually" state so the cashier can enter the M-Pesa code if Safaricom never resolves the request.
- Production setups use a `CallBackURL` (Safaricom POSTs the result back). The desktop app has no public URL so polling is the only path.

### Paybill + Till usage (the actual Kenyan SME flow)
- Most SMEs **don't** wire Daraja. They have a Paybill or Till and customers pay manually (read the till number out loud → customer enters in M-Pesa → gets SMS → cashier types the confirmation code into our POS).
- Need:
  - Settings → Payment → "Paybill" + "Till" fields per business
  - POS payment modal → "Manual M-Pesa" tab shows the business's till/paybill prominently + an input for the customer's M-Pesa code
  - Saved as `method_name='M-Pesa Manual'`, `reference=<code>`. No API call, just reconciliation.

## Quirks audited in the current payment modal

| # | Symptom | Root cause |
|---|---|---|
| 1 | After "Split" the M-Pesa input doesn't clearly show what's remaining | `Split` button = `addPayment()` = same as `Add Payment`. The next-tab amount IS pre-filled with remaining (after the `handleSelectMethod` fix in v0.11.6), but the UI never tells the cashier "I just added 2k cash, here's 3k still to go". Remaining shows in tiny grey text under the total. |
| 2 | Two CTAs at the bottom (`Split` and `Complete`) — operators don't know which to press | Confusing labels. There's only one operation: "add this chunk". When chunks cover the total, the button becomes "Complete". |
| 3 | Method buttons are unbranded text rectangles | No brand recognition. M-Pesa, Card, Cash all read identical. |
| 4 | Amount input doesn't show what's expected with no payment text | The "Remaining: X" line only renders when `paidSoFar > 0`. On first open, the input shows the full total but with no surrounding explanation. |
| 5 | Cash overpay → "Change: X" shows only for cash. M-Pesa overpay (rare) is silent. | Inconsistent feedback. |
| 6 | "Send STK Push" button is a separate row, not part of the M-Pesa tab | Looks like two M-Pesa modes when really STK push IS M-Pesa via Daraja. |
| 7 | Cart QR — `+`/`−` for quantity. No way to type "30" directly. | The cart's QuantityStepper is buttons-only. Useful for 1, painful for 30. |
| 8 | Touch density users on tablet POS need an on-screen keyboard for the numeric inputs but the existing TouchKeypad only opens for inputs that opt in. | Inconsistent coverage. |
| 9 | M-Pesa STK push success/failure screens show generic green/red checks; no Safaricom logo, no "M-Pesa" branding. | The customer sees the cashier's screen during STK confirmation. Branding matters. |
| 10 | Marketing site hero says "ERP for owner-operators" — most Kenyans search "POS with M-Pesa" or "pharmacy POS Kenya". They never hit our pages. | SEO mismatch — leading with "ERP" misses the term customers actually use. |
| 11 | OG image, hero illustration, module hero images all empty by default (the admin media library was built, but no slots seeded). | Site looks half-finished on first load. |

## Plan

### Phase 1 — Payment brand icons (shipped this batch)
- `src/components/icons/payment-brands.tsx` — inline SVGs for M-Pesa, Paystack, Visa, Mastercard, Cash, Card, Bank, Insurance
- A resolver `paymentBrandIcon(idOrName)` so any caller can pass "mpesa-paystack" or "Cash" and get the right component

### Phase 2 — Rebuild the payment modal (this batch)
Drop the dual `[Split] [Complete]` button row. Replace with:

```
┌──────────────────────────────────────────┐
│   Total                  Remaining       │
│   5,000.00               3,000.00        │
├──────────────────────────────────────────┤
│ Method:                                  │
│ [💵 Cash] [📱 M-Pesa] [💳 Card] [🛡 SHA] │
├──────────────────────────────────────────┤
│ Amount (KES)                             │
│ ┌──────────────────────────────┐         │
│ │  3,000.00                    │         │
│ └──────────────────────────────┘         │
│ +50 +100 +500 +1000 [Exact] [Clear]      │
│                                          │
│ (cash overpay → Change: 200 in green)    │
├──────────────────────────────────────────┤
│ Splits paid so far (when any):           │
│  ✓ Cash · 2,000           [Remove]       │
├──────────────────────────────────────────┤
│  [Add this payment]  /  [Complete sale]  │
│  (Complete becomes primary when          │
│   remaining = 0)                         │
└──────────────────────────────────────────┘
```

Behaviours:
- Method buttons show brand icons via `paymentBrandIcon()` — instant recognition
- Amount auto-fills to `remaining` whenever method changes or a chunk is added
- Single CTA at the bottom — "Add payment" or "Complete sale" depending on remaining
- "Splits paid so far" list shows every chunk with a remove (`X`) button
- Cash quick-add chips remain
- STK push triggers immediately when the user picks M-Pesa AND there's an active Daraja config — no separate "Send STK push" button
- Same for Paystack mobile-money branch

### Phase 3 — Custom quantity input in cart (next session)
- Tap on the quantity number in the cart line → opens a small popover with a numeric pad + Done button. Touch density users get the same TouchKeypad component already shipped; mouse/keyboard users get a plain Input with Enter to confirm.
- File: `src/components/pos/quantity-stepper.tsx` (extend, don't replace)

### Phase 4 — Virtual on-screen keyboard for touch (next session)
- Research showed `react-simple-keyboard` is the maintained option, but it's 30kb and themed. Build a minimal text keyboard ourselves matching the editorial style of the app — `src/components/ui/touch-keyboard.tsx`. QWERTY by default, swappable to numeric. Shifts up when any text input gets focus in touch density mode.

### Phase 5 — Marketing + SEO sweep (next session)
Kenya search intent (from search research):
1. **"POS system Kenya"** (head term)
2. **"POS with M-Pesa"** / **"M-Pesa POS integration"**
3. **"Lipa na M-Pesa"** + **"Till"** + **"Paybill"** + **"Buy Goods"**
4. **"eTIMS"** + **"KRA"**
5. **"Pharmacy POS"** / **"POS software for pharmacy"** / **"Pharmacy management system Kenya"**
6. **"Restaurant POS Kenya"** / **"Mama Mboga POS"** / **"Duka POS"**
7. **"Hardware POS Kenya"**
8. **"Offline POS Kenya"** / **"POS works without internet"**
9. **"Free POS"** (discovery driver — Omnix uses 30-day trial)

Updates:
- Hero h1: "POS with M-Pesa for Kenyan businesses. Lipa na M-Pesa built in. eTIMS-ready. Pay once, own forever."
- Hero subhead: leads with M-Pesa STK push + eTIMS auto-signing
- Variant landings:
  - Dawa → "Pharmacy POS for Kenya. M-Pesa + insurance claims + eTIMS."
  - Retail → "Retail POS Kenya. M-Pesa Lipa na M-Pesa Online + eTIMS."
  - Hardware → "Hardware Store POS Kenya. Quotations, contractor accounts, M-Pesa."
  - Hospitality → "Restaurant POS Kenya. Tables, orders, M-Pesa, KRA-ready."
- `<title>` + `<meta name="description">` per page with the right Kenya terms
- Structured data (`PaymentMethod`, `Offer`, `SoftwareApplication`)
- OG image filled in via the media library seed

### Phase 6 — Image seeding via Serper (next session)
The user gave us a Serper API key. Use it to pull a couple of public-domain or CC-licensed images for:
- Hero background (Kenyan small business interior)
- Module landings (pharmacy counter, hardware shop, restaurant, retail till)
- OG default
Auto-seed by uploading to R2 via the existing admin/media endpoint with a one-shot script (`scripts/seed-marketing-media.mjs`).

## Tasks (will track via todo_list)

1. Payment brand SVGs ✅
2. Rebuild payment modal layout — single-CTA flow + brand chips + auto-fill remaining
3. Wire branded chips into Settings → Payment Settings (each provider gets its logo in the section header)
4. Branded success/failure screens for STK push (Safaricom logo + tone)
5. Cart custom-quantity popover (tap qty → type)
6. Virtual keyboard for touch
7. SEO + meta + structured data rewrite (homepage + 4 variant landings + pricing)
8. Serper-driven image seeding script + seed
9. Tests for new modal: chunk math + brand resolver + method switch
10. Tag v0.11.7
