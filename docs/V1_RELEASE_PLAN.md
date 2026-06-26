# v1 Release — master plan + execution log

Comprehensive bundle the user asked for before v1:

1. Editorial payment-modal rebuild + brand icons everywhere
2. Paystack Popup (iframe) for cards — no custom 3DS, no PCI scope
3. Mobile money on Paystack stays as `/charge` (no card data)
4. Paybill + Till manual flow (the actual Kenyan SME pattern)
5. Setup guides — how to get M-Pesa Daraja keys, Paystack keys, AI
   provider keys — accessible from both /dashboard and the marketing
   pages
6. Setup CTAs on dashboard surfaces (Overview, License detail, Machine
   detail) — "Set up M-Pesa", "Set up Paystack", "Set up AI"
7. SEO sweep — hero copy, variant landings, structured data, meta
   keywords aligned to actual Kenya search intent (POS with M-Pesa,
   eTIMS, pharmacy POS, Mama Mboga POS, etc.)
8. Image seeding via Serper → R2 → admin media slots populated by
   default so the site looks complete out of the box
9. OG cards for every page, including dynamic ones
10. Lighthouse / SEO automation — `next-sitemap` for sitemap.xml +
    robots.txt, structured data validation tests, axe accessibility
    tests
11. Internal scroll on every dialog so it never spills off-screen
12. v0.12.0 tag → first true 1.0-track release

## Constraints

- I cannot install OS-level MCPs from this env. I can install npm
  packages (next-sitemap, schema-dts, vitest-axe, etc.).
- I cannot run Lighthouse against a deployed URL from this sandbox.
  But I can configure `next-sitemap` + a Lighthouse-friendly meta tag
  setup + structured data so the score is achievable on the deployed
  site.
- Image seeding requires Serper + R2 access. The Serper key the user
  provided is committed-key-shaped (a real key shared in conversation).
  I'll use it as an env var only, never commit it. R2 keys are already
  in Vercel env.

## Execution order

Phase A — Payment modal rebuild (this batch)
  1. New payment-modal layout: hero amount, brand-block method chips,
     single CTA, internal scroll, sticky footer
  2. Manual M-Pesa Paybill/Till panel with prominent till number +
     code-input + amount + Save
  3. STK polling: 'Mark as paid manually' fallback after timeout
  4. Brand icons: upgrade fidelity (proper M-Pesa wordmark + red dot,
     Paystack 4-bar P, Visa with italic V, Mastercard interlocking
     circles with overlap)
  5. Settings → Payment Settings: per-business Paybill + Till fields

Phase B — Paystack Popup (next batch)
  6. Replace custom card flow with PaystackPop.setup() / openIframe
  7. Vitest coverage: brand resolver, manual-mpesa save shape

Phase C — Setup guides (next batch)
  8. /dashboard/setup/mpesa — step-by-step guide for getting Daraja
     keys + entering them
  9. /dashboard/setup/paystack — same for Paystack
  10. /dashboard/setup/ai — getting Groq / OpenRouter / Anthropic keys
  11. Marketing-side mirrors at /setup/mpesa, /setup/paystack so
      prospects can preview the flow before buying

Phase D — Dashboard setup CTAs
  12. Overview banner: "Set up M-Pesa to accept payments at the till"
      links to the guide. Hides once Daraja is connected.
  13. License detail + Machine detail: same banner

Phase E — SEO sweep
  14. Hero h1 + subhead with Kenya search terms
  15. Variant landing titles + meta-descriptions
  16. Structured data: SoftwareApplication, Offer, PaymentMethod
  17. next-sitemap config
  18. OG image template via @vercel/og (dynamic per page)

Phase F — Image seeding
  19. scripts/seed-marketing-media.mjs — pulls licensed images via
      Serper, uploads to R2, sets the right platform_media slot

Phase G — Tag
  20. v0.12.0 — first release on the v1 track
