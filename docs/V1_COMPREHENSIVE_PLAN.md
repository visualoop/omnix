# Omnix v1 — Comprehensive Plan

Locked plan for the v1 push. Research is finished; this doc is the
contract for every change going in.

The user's hard requirements:
- Payment UX for POS rebuilt end-to-end. Brand chrome everywhere. No
  vibecoded looks. Editorial UI, big icons, proper hierarchy.
- Paystack must use the iframe Popup (avoid building 3DS ourselves —
  RAMS marks custom card UIs as fraud).
- M-Pesa: support Paybill + Till manual flow (the actual SME pattern).
  STK Push polling with manual fallback for sandbox dead-air.
- Cart custom-quantity input (tap qty → type), virtual keyboard for
  touch terminals.
- Marketing site must feel COMPLETE — hero + variant landings + meta
  + structured data + setup guides + images everywhere.
- Setup guides: how to acquire Daraja keys, Paystack keys, AI keys,
  and how to insert them. Linked from dashboard surfaces and from
  marketing pages.
- Setup CTAs on dashboard (Overview / License / Machine pages).
- "M-Pesa-first" SEO. Lead copy mentions M-Pesa, Lipa na M-Pesa, Till,
  Paybill, eTIMS — NOT "ERP" as the hook.
- Image seeding for every section that needs one. **Serper only** —
  no Unsplash, no other stock library.
- All Cloudflare-R2 uploads happen via the existing /api/admin/media
  pipeline so the slots become editable from /admin later.
- SEO + Lighthouse score 100 across all categories.
- Install testing libraries / MCPs to validate UI layout, padding,
  margins, icon placement, a11y automatically.
- v1 quality bar — no shipped bugs.

---

## Research summary (compiled from June 2026)

### Paystack — confirmed path
- Use **`@paystack/inline-js` Popup V2** for ALL Paystack flows in the
  POS:
  ```js
  const paystack = new PaystackPop();
  paystack.newTransaction({
    key:    PUBLIC_KEY,
    email:  customerEmail,
    amount: amountInKobo,     // KES * 100
    currency: "KES",
    reference: ourTxnRef,
    onSuccess: (txn) => { /* verify on server, mark sale paid */ },
    onCancel:  () => { /* user closed popup */ },
  });
  ```
- Keep a server-side `/api/paystack/verify` step. Don't trust the
  client-side `onSuccess` alone — call `GET /transaction/verify/:ref`
  with the SECRET key from our server before marking paid.
- Mobile-money branch (Paystack M-Pesa) keeps using `/charge` — no
  card data so no PCI scope; Popup is overkill there.

### Daraja — STK push hardening
- Sandbox returns `1032 Cancelled by user` or stays pending forever
  on bad days (per Sim-Pesa community docs).
- Recommended polling: every 5s for ~180s, then surface a
  "Pending — verify manually" panel where the cashier enters the
  M-Pesa code from the customer's SMS.
- Add a "Mark as paid manually" fallback that records the chunk
  with `method=mpesa-manual`, `reference=<M-Pesa code>`, no API call.
- Track polling state: `idle → initiated → pending → success | failed
  | timeout`. UI shows elapsed seconds + "Check now" + "Resend STK".

### Paybill / Till manual flow
- Most Kenyan SMEs don't have Daraja keys — they have a Paybill or
  Till from Safaricom. Customer pays directly to the till; cashier
  reads the M-Pesa SMS to capture the confirmation code.
- Per-business config in Settings → Payments: paybill number,
  account-number convention, till number.
- POS modal: when no Daraja keys are configured, "Manual M-Pesa" tab
  shows the till/paybill prominently (big number, copy button) + a
  "M-Pesa code" input + amount + Save.
- Optional later: C2B callback wiring so Daraja-paying merchants
  can match the code automatically. Out of scope for v0.12.0 since it
  requires our server to receive Safaricom webhooks.

### SEO + Lighthouse 100
- Use Next.js Metadata API on every page (already partially done —
  audit + complete).
- `metadataBase` set, title templates, `robots`, `alternates.canonical`.
- Use `schema-dts` for type-safe JSON-LD blocks:
  - `SoftwareApplication` on homepage + variant landings
  - `Offer` on pricing
  - `Organization` site-wide
  - `FAQPage` on FAQ section
  - `Article` on blog posts + docs
  - `LocalBusiness` only if/when we have a registered address
- Sitemap (`app/sitemap.ts` already exists — audit + complete with
  locale alternates).
- Robots (`app/robots.ts` already exists — keep).
- Dynamic OG cards via `/api/og` (already exists) — wire per page.
- Core Web Vitals: 100ms preload budget, no CLS, no unused JS, lazy-
  load below-the-fold.

### MCPs to use (research only — install on user's machine, not in repo)
| MCP | Purpose | Source |
|---|---|---|
| chrome-devtools-mcp | Live Chrome inspection, take screenshots, run Lighthouse, read DOM/CSS, debug layout | github.com/ChromeDevTools/chrome-devtools-mcp |
| playwright-mcp | E2E test automation with accessibility snapshots | playwright.dev/mcp |
| lighthouse-mcp-server | Automated Lighthouse audits (performance, SEO, a11y, security) | github.com/danielsogl/lighthouse-mcp-server |
| a11y-mcp | axe-core driven a11y audits, agentic loop for fixes | github.com/priyankark/a11y-mcp |
| shadcn MCP | Component search + install from registry | ui.shadcn.com/docs/mcp |
| siteaudit-mcp | Full website audit (broken links, perf budgets) | mcpservers.org/servers/vdalhambra/siteaudit-mcp |

These will be added to a `docs/MCPS.md` setup guide; the user runs
them locally. They're not installed in the repo.

### Skills already available (in .kiro/skills/)
- `frontend-design` — for editorial UI choices
- `emil-design-eng` — for polish + animation decisions
- `hallmark` — for greenfield + redesigns + design extraction
- `ui-ux-pro-max` — for component-level UI guidance
- `anti-slop-writing` — for marketing copy

### NPM dependencies to add
| Package | Purpose | Side |
|---|---|---|
| `@paystack/inline-js` | Paystack Popup V2 | Desktop app (`src/`) |
| `simple-keyboard` | Virtual QWERTY + numeric keyboard | Desktop app |
| `driver.js` | Onboarding tour (coach marks) | Website (`/dashboard`) |
| `schema-dts` | Type-safe JSON-LD | Website |
| `vitest-axe` | a11y assertions in tests | Both |
| `axe-core` | a11y engine | Both |

### Onboarding tour library
- **driver.js** chosen — MIT license, 5kB, no deps, works without a
  React wrapper. Shepherd.js + Intro.js are AGPL (commercial license
  needed). React-joyride works but heavier. Driver.js is the most
  permissive + smallest.

### Image source — Serper only
- `POST https://google.serper.dev/images` with `X-API-KEY` header.
- Filter via the `tbs=il:cl` parameter for Creative-Commons-licensed
  images (Google's "Usage rights: licensable").
- For each platform_media slot, run a Serper query → pick the first
  result with a permissive license → upload to R2 via the existing
  `/api/admin/media` endpoint.
- NEVER commit the Serper key. Use as `SERPER_API_KEY` env var in a
  one-shot script.

---

## File-level execution plan

### Phase 0 — Foundations (no UI yet)
1. Install npm deps: `@paystack/inline-js`, `simple-keyboard`, `driver.js`,
   `schema-dts`, `vitest-axe`, `axe-core`
2. `docs/MCPS.md` — guide for the user to install all the MCPs above
   with the right config snippets per client (Cursor/Claude Code/etc.)

### Phase 1 — Global UI fixes (cross-cutting)
The user said "inputs in the entire app and the title above its like
they dont have space". Audit + fix:
3. `src/components/ui/dialog.tsx` — bump `DialogHeader` bottom padding
   from `pb-4` to `pb-6`; bump `DialogContent` to `p-6 md:p-8` and
   `max-h-[90vh]` with internal scroll. The current title-to-content
   spacing is too tight on small screens.
4. `src/components/ui/input.tsx` — bump `h-10` to `h-11` for touch
   comfort; ensure `px-3` left/right.
5. `src/components/ui/label.tsx` — confirm `mb-2` between label and
   the field it labels. Replace any `mb-1` we find.
6. Run a codebase audit for `mb-1` followed by `<Input` and bump to
   `mb-2`. Likely 20-30 hits.

### Phase 2 — Payment brand icons (upgrade fidelity)
7. `src/components/icons/payment-brands.tsx` — replace the
   first-pass icons with proper-fidelity versions:
   - **MpesaIcon**: green tile + the canonical lowercase "m-pesa"
     wordmark with the red dot at the end of the "a". Use the same
     proportions as the official mark.
   - **PaystackIcon**: navy tile + four-bar "P" silhouette in
     `#00C3F7` matching the Paystack identity.
   - **VisaIcon**: blue rounded rect, italic-V hint, yellow tail.
   - **MastercardIcon**: black chip + two interlocking circles
     (`#EB001B` + `#F79E1B`) with a `#FF5F00` overlap in the middle.
     Add a subtle radial-gradient for premium feel.
   - **CashIcon**: KES note silhouette in `#1F8B3A`, white centre
     panel with "KES", two diagonal corner pips.
   - **CardIcon**: dark chip with metallic golden EMV chip + three
     hairline number bars.
   - **BankIcon**: navy tile + classical pillar facade.
   - **InsuranceIcon**: sky-blue shield with white tick.
8. Each icon takes a `size` prop and respects currentColor where
   appropriate.

### Phase 3 — Rebuild POS payment modal
File: `src/components/pos/payment-modal.tsx`

Replace the whole layout (keep handlers + completeSale wiring):

```
┌──────────────────────────────────────────┐
│  Sticky header:                          │
│  Total                Remaining          │
│  KES 5,000.00         KES 3,000.00       │
│  ▰▰▰▰▰▰▰▰▰░░░░░ progress bar (paid/total)│
├──────────────────────────────────────────┤
│  Internal-scrollable body:               │
│                                          │
│  Pay with                                │
│  ┌─────────────────────────────────────┐ │
│  │ [💚 M-Pesa STK Push]                │ │
│  │ Customer phone → instant            │ │
│  │ (only if Daraja keys set)           │ │
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │ [💚 Manual M-Pesa (Paybill XYZ)]    │ │
│  │ Customer pays → cashier types code  │ │
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │ [💵 Cash]                           │ │
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │ [🔵 Paystack — Card / M-Pesa]       │ │
│  │ Opens Paystack popup                │ │
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │ [🛡 Insurance / SHA]                │ │
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │ [🏦 Credit account]                 │ │
│  └─────────────────────────────────────┘ │
│                                          │
│  Active method panel (changes by choice):│
│  Amount KES ┌──────────────┐             │
│             │ 3,000.00     │             │
│             └──────────────┘             │
│  Quick: +50 +100 +500 +1000 [Exact]      │
│  (cash → Change: 250 in green)           │
│  (M-Pesa → phone input + Send STK push)  │
│  (Manual M-Pesa → till display + code)   │
│                                          │
│  Splits so far (when any):               │
│  ✓ Cash 2,000             [×]            │
│                                          │
├──────────────────────────────────────────┤
│  Sticky footer:                          │
│  [ Add payment ] / [ Complete sale ]     │
│  (Complete = primary when remaining = 0) │
└──────────────────────────────────────────┘
```

Behaviours:
- One CTA button, label switches by state (Add payment / Complete)
- `paid + remaining` always visible in the sticky header
- Method block is a full-width brand-colour panel with the brand icon
  on the left, the label in the brand font weight, and a short hint
  on the right
- Per-method panel slides in below the picker — amount input is
  pre-filled with the remaining balance
- Splits list shows each chunk with brand icon, name, amount, and a
  remove button
- Internal scroll on the body; header + footer stay sticky
- Max-height `90vh` so it never spills off-screen

### Phase 4 — Paystack Popup
9. `src/services/paystack-popup.ts` — thin wrapper around
   `@paystack/inline-js`:
   ```ts
   import PaystackPop from "@paystack/inline-js";
   export async function payByPaystackPopup(args: {
     publicKey: string;
     email:     string;
     amountKes: number;     // we'll * 100 inside
     reference: string;
   }): Promise<{ status: "success" | "cancelled"; reference: string }> {
     return new Promise((resolve) => {
       const paystack = new PaystackPop();
       paystack.newTransaction({
         key:       args.publicKey,
         email:     args.email,
         amount:    Math.round(args.amountKes * 100),
         currency:  "KES",
         reference: args.reference,
         onSuccess: (txn) => resolve({ status: "success", reference: txn.reference }),
         onCancel:  ()    => resolve({ status: "cancelled", reference: args.reference }),
       });
     });
   }
   ```
10. Payment modal wires this for the Paystack method block.
11. Server-side verify endpoint reused (already at
    `website/src/app/api/paystack/init/route.ts` — extend to support
    `verify`).

### Phase 5 — Manual M-Pesa (Paybill + Till)
12. `src-tauri/migrations/048_paybill_till.sql` — add
    `paybill_number`, `paybill_account_pattern`, `till_number` to
    `business_settings` (or whatever the existing settings table is).
13. `src/services/business-settings.ts` — getter/setter for these.
14. `src/pages/payment-settings.tsx` — new section "Manual M-Pesa
    (Paybill / Till)" with three inputs + a "Save" button.
15. Payment-modal manual-M-Pesa panel:
    - Large display of the till/paybill number (mono, big, with copy
      button)
    - "Account number" hint if it's a Paybill
    - Amount input (KES)
    - "M-Pesa transaction code" input (e.g. `SHA9X3LF12`)
    - Save → records as `method=mpesa-manual`, `reference=<code>`.

### Phase 6 — STK polling + manual fallback
16. `src/components/pos/daraja-mpesa.tsx` already has check-now /
    resend / elapsed. Add a "Mark as paid manually" button that
    surfaces after 90s of pending. Clicking shows a code-input panel
    + saves the chunk as `method=mpesa-manual`.

### Phase 7 — Custom cart quantity input
17. `src/components/pos/qty-multiplier-dialog.tsx` already touch-
    first. Rename to `qty-edit-dialog.tsx` + give it two modes:
    "replace" (set to N) and "multiply" (x N).
18. `src/pages/pos-sale.tsx` cart line items — tap the qty number →
    opens the dialog in "replace" mode.

### Phase 8 — Virtual keyboard for touch
19. `src/components/ui/touch-text-keyboard.tsx` — wrapper around
    `simple-keyboard` styled to match our editorial chrome.
    QWERTY + a "123" shift to numeric.
20. `src/stores/density.ts` — `useTouchTextKeyboard()` hook that
    listens for focus on text inputs in touch mode and opens the
    keyboard at the bottom of the screen. Skips numeric inputs (those
    use TouchKeypad).

### Phase 9 — Setup guides (docs + dashboard)
Docs entries (use the existing docs system at
`website/src/lib/docs-seed.ts`):
21. `getting-started/mpesa-daraja-keys.mdx` — step-by-step:
    1. Sign up at developer.safaricom.co.ke
    2. Create an app → get Consumer Key + Consumer Secret
    3. Apply for a Paybill or Till (see Safaricom requirements:
       KRA PIN, board resolution, IDs)
    4. Activate Lipa na M-Pesa Online (STK Push)
    5. Get your Passkey from the M-Pesa Express config page
    6. Switch to live credentials when ready
    7. Open Omnix → Settings → Payments → paste keys + verify
22. `getting-started/paystack-keys.mdx` —
    1. Sign up at paystack.com/signup (live for KE merchants)
    2. Complete business onboarding (KRA PIN, bank account, ID)
    3. Settings → API Keys & Webhooks → copy Public + Secret keys
    4. Switch to Live mode once approved
    5. Paste into Omnix → Settings → Payments → Paystack section
23. `getting-started/ai-keys.mdx` —
    1. Choose a provider (Groq free + cheap, OpenRouter aggregator,
       Anthropic for quality)
    2. Sign up, generate an API key
    3. Paste into Omnix → Settings → AI

24. Dashboard surface mirrors at `(dashboard)/dashboard/setup/[guide]/`
    pages that render the same content with a "I'm done — verify
    connection" button at the bottom.

### Phase 10 — Dashboard setup CTAs
25. `(dashboard)/dashboard/page.tsx` — when the latest license is
    bound but Daraja keys aren't configured (read via a small
    `/api/dashboard/setup-status` endpoint), show a yellow banner:
    "Set up M-Pesa to accept payments at the till →"
26. Same banner on `licenses/[id]/page.tsx` and `machines/[id]/page.tsx`
    when the relevant config is missing.

### Phase 11 — Onboarding tour (driver.js)
27. `website/src/components/dashboard/welcome-tour.tsx` — first-login
    tour walking the user from "Download installer" → "Activate key"
    → "Open Omnix" → "Set up M-Pesa" → "Try a sale".
28. Persisted dismissal flag in the user's profile.

### Phase 12 — Marketing site SEO + copy
29. `website/src/components/landing/hero-section.tsx` — h1:
    "POS with M-Pesa for Kenyan businesses. Lipa na M-Pesa, eTIMS,
    pay once."
    Subhead leads with M-Pesa STK Push + Paybill/Till + eTIMS.
30. `website/src/components/marketing/variant-landing.tsx` —
    Dawa: "Pharmacy POS for Kenya with M-Pesa, eTIMS, insurance"
    Retail: "Retail POS Kenya with M-Pesa Lipa na M-Pesa + eTIMS"
    Hardware: "Hardware Store POS Kenya. Quotations, contractor
    accounts, M-Pesa STK Push."
    Hospitality: "Restaurant + Bar POS Kenya. Tables, M-Pesa, KRA."
31. Page-level metadata (`generateMetadata` per route) with:
    - title using `{ template: "%s — Omnix" }`
    - description with M-Pesa / eTIMS / variant keywords
    - openGraph + twitter cards using `/api/og?title=...` per page
    - alternates.canonical
    - robots (default; noindex on legal pages where appropriate)
32. `website/src/components/seo/jsonld.tsx` — extend with
    `SoftwareApplication`, `Offer`, `FAQPage`, `Article`,
    `Organization`, `BreadcrumbList` builders typed via `schema-dts`.

### Phase 13 — Image seeding via Serper
33. `scripts/seed-marketing-images.mjs`:
    - Read every entry in `website/src/lib/media-slots.ts`
    - For each slot, build a Serper query from the slot's
      `searchQuery` field (add this field if missing)
    - POST `https://google.serper.dev/images` with `X-API-KEY` and
      `tbs=il:cl` (licensable filter)
    - Pick the first result with a permissive license
    - Download + upload to R2 via `/api/admin/media`
    - PUT `/api/admin/media/:slot` with the new image URL
    - Log every choice to `scripts/seed-marketing-images.log`
34. Run once with `SERPER_API_KEY=... node scripts/seed-marketing-images.mjs`
35. The script is idempotent — re-running won't double-seed.

### Phase 14 — Lighthouse + a11y pass
Cannot run from this sandbox (no Chrome) but configure:
36. `package.json` script: `lighthouse:audit` (uses
    `@lhci/cli` against a deployed URL)
37. `tests/ui/a11y.spec.tsx` — uses `vitest-axe` to assert no
    a11y violations on each marketing page + each dashboard page +
    POS payment modal.

### Phase 15 — Test coverage
38. `tests/payments/paystack-popup.spec.ts` — mocks
    `@paystack/inline-js`, asserts the right key/email/amount are
    passed.
39. `tests/payments/manual-mpesa.spec.ts` — asserts the saved
    payment has `method=mpesa-manual`, `reference=<code>` shape.
40. `tests/payments/payment-modal.spec.tsx` — full payment-flow
    test: cash 2k → switch to M-Pesa → enter 3k → assert remaining
    is 0, Complete button is primary.

### Phase 16 — Release
41. Bump to v0.12.0, commit, tag, push.
42. Update `website/src/app/[locale]/(frontend)/changelog/page.tsx`
    with v0.12.0 highlights.

---

## Quality bar

Before tagging v0.12.0:
- `npx tsc --noEmit` passes
- `pnpm exec vitest run` passes
- `node scripts/audit-codebase.mjs` passes
- The website builds without warnings:
  `pnpm --filter @omnix/website build`
- Manual smoke test passes (will document a runbook for the user
  to run on their built installer)

---

## Out of scope for v0.12.0 (deferred to v0.13.0)

- Public C2B callback URL for auto-matching Paybill payments (needs
  the user's deployed server URL)
- React-Native mobile app
- KOT printer integration
- Multi-business / franchise mode

---

## Constraints I'm aware of

- This is a Linux machine (Ubuntu 24.04 aarch64, Node 24, pnpm 9).
  I can install npm packages, run Playwright + Chromium, run
  Lighthouse, hit Serper, hit Daraja sandbox, hit Paystack test.
- I'll install playwright's own chromium via `npx playwright install`
  rather than the system chromium so the version is pinned.
- The Serper key the user shared in chat is a real key — used only
  as an env var when running the seed script, never committed.
- I will not push to main without the user's explicit "go" — but I
  WILL commit locally and push at logical checkpoints.
- If a phase fails twice, I will stop and report root cause rather
  than patch-patch.
