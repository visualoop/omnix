# DUKA WEBSITE — Comprehensive Build Brief
**Public marketing site + customer dashboard + admin/telemetry platform for the Duka ERP product family · omnix.co.ke**

This document is a complete instruction set for an AI coding agent (Cursor, Claude Code, Bolt, v0). Read it end-to-end before writing a single line. Do not produce an MVP. Build the production-grade product described here.

---

## 0. MISSION

Build the website + dashboard system that supports every Duka ERP customer from first visit through perpetual ownership.

**Audience layers:**
1. **Prospects** — Kenyan SME owners (pharmacies, retail shops, dukas, salons, mini-marts) discovering the product, evaluating modules, downloading the trial.
2. **Trial users** — running the 30-day evaluation, deciding whether to buy.
3. **Paying customers** — managing their license, downloading new versions, raising support tickets, paying maintenance.
4. **The owner (justinelut)** — single admin who needs total visibility: every install, every machine, every license, every payment, every error report — without ever touching code.

**The website's job:**
- Convert a prospect into a download (trial or paid).
- Take payment online via Paystack (custom UI).
- Issue licenses automatically.
- Distribute installers (latest + version history).
- Host customer dashboard for self-service.
- Receive telemetry from every install and present it on a single owner dashboard with map + diagnostics.
- Drive everything through Payload CMS so the owner never edits code to change content, prices, modules, or release notes.

**Brand contact (visible on website):** WhatsApp +254 XXX XXX XXX, support email TBA, Nairobi, Kenya — all editable from Payload.

---

## 1. SOURCE & APPROACH

There is no source repo to clone. Build from scratch using **Payload CMS 3.x** as the seed, which scaffolds a Next.js 15 App Router app.

This is non-negotiable. Start by running:

```bash
pnpm dlx create-payload-app@latest duka-web
```

When prompted, choose:
- **Template**: blank (full visual control — do NOT use Payload's default frontend)
- **Database**: Postgres
- **Use Payload Cloud**: No (self-hosted on K3s per workspace AGENTS.md)

After scaffolding, verify locally:
1. `pnpm dev`
2. `http://localhost:3000/admin` → sign up the first admin user (the owner)
3. `http://localhost:3000` → confirm the default frontend renders
4. Only then start customising

The Next.js frontend lives in `app/(frontend)/`. Payload mounts at `/admin`. **Do NOT spin up a separate Next.js project.**

---

## 2. THE BRAND NAME PROBLEM

The name "Omnix" is being retired. The replacement candidate is **Duka** — Swahili for shop/store. Single Kenyan word, every business owner already says it daily, works for pharmacy (duka la dawa), retail (duka), salon (duka la urembo), mini-mart, anything.

**`BRAND_NAME` MUST live in a single TypeScript constant** so swapping is one-line:

```ts
// src/lib/brand.ts
export const BRAND_NAME = "Duka" as const;
export const BRAND_DOMAIN = "omnix.co.ke" as const;          // current domain — can swap later
export const BRAND_TAGLINE = "Run your business. From your duka." as const;
```

Every UI string that mentions the brand MUST import from this file. The agent must NOT hardcode "Duka" anywhere else. The owner can rename to any other word — `BRAND_NAME = "Tindo"`, `BRAND_NAME = "Bidhaa"` — by editing this one file. Agent: verify with `grep -ri "Duka" src/ | grep -v lib/brand.ts` before declaring done; expected output is zero.

**Module names** stay as-is (Dawa, Omnix Retail) — they're descriptive, not the umbrella brand.

---

## 3. TECH STACK (exact versions, do not substitute)

- **Runtime**: Node 20 LTS
- **Framework**: Next.js 15 App Router (scaffolded by Payload)
- **CMS / data layer**: Payload CMS 3.x — single source of truth for ALL content, releases, customers, licenses, telemetry, payments
- **Database**: Postgres 15 (Neon serverless or Supabase)
- **ORM**: Drizzle (Payload's internal — do not introduce a second ORM)
- **Object storage**: Cloudflare R2 (installer binaries, screenshots, video uploads). Configure via `@payloadcms/storage-s3`
- **Component library**: shadcn/ui — install fresh in the Next.js side. Allowed extensions: Radix primitives, Lucide icons, sonner (toasts), embla-carousel-react (testimonials), framer-motion (scroll transitions), recharts (admin dashboards), react-leaflet + leaflet (admin map), date-fns
- **Styling**: Tailwind CSS v3 + custom CSS variables
- **Fonts**: **Inter** (UI body 400/500/600/700) + **Space Grotesk** (display 500/700) — both via `next/font/google` with `display: swap`. Self-hosted, no third typeface.
- **Forms**: `@payloadcms/plugin-form-builder` for contact, support tickets, refund requests
- **Payments**: **Paystack REST API only** with a custom UI built in shadcn (no Paystack inline popup). Paystack handles cards + M-Pesa via `/charge` mobile_money endpoint. Webhook receiver at `/api/paystack/webhook` validates signature, records payment, issues license.
- **Email**: Resend (transactional) — license delivery, payment receipts, admin alerts
- **Analytics**: PostHog (product analytics)
- **Error tracking**: Sentry (frontend + Payload server)
- **Hosting**:
  - Frontend (Next.js + Payload admin) → Vercel
  - Postgres → Neon (free tier)
  - Storage → Cloudflare R2
  - Per workspace AGENTS.md, K3s is preferred for backend services. **Exception**: Payload CMS auto-scaffolds with Vercel-friendly defaults; running on Vercel keeps the build pipeline simple. Document the deviation in `/docs/deployment.md`.

---

## 4. UI / VISUAL DIRECTION — premium SaaS, not template-y

The site must signal "serious modern SaaS that respects your time" — Linear, Vercel, Stripe, Resend, Cal.com tier, not generic Bootstrap-Elementor SaaS.

### 4.1 Reference websites (visually study before designing)

**Tier 1 — primary anchors:**
1. **https://linear.app** — PRIMARY. Dark background, dense product detail, sharp typography, generous spacing in places that matter, animation discipline.
2. **https://vercel.com** — secondary primary. Black/white, geometric, type-first, bento-grid feature sections.
3. **https://stripe.com** — tier-1 reference. Color used as accent (mint, indigo) on near-black/white. Confidence in restraint.
4. **https://resend.com** — clean, dev-friendly, clear pricing, good docs UX.
5. **https://cal.com** — open source product with serious marketing site. Calendar/scheduling parallel to ERP scheduling.
6. **https://supabase.com** — bento dashboards on landing page. Reference for the admin map dashboard.

**Tier 2 — Kenyan/African luxury restraint references:**
7. https://intasend.com — Kenyan fintech, professional tone
8. https://flutterwave.com — pan-African fintech standard

**Tier 3 — anti-references (NEVER copy):**
- Wix/Squarespace "ERP system" templates with a 3D laptop mockup
- Bootstrap landing pages with "Trusted by 5,000+ companies" avatar strips
- ChatGPT-generated SaaS sites with purple-to-cyan gradients
- "🚀 Boost your business 10x" emoji-laden hero sections

### 4.2 Palette — dark-default with warm accent

Two themes, dark is default (Linear-style). Light theme available via toggle.

**Dark mode (default)** — applies to all marketing pages and customer dashboard:

```css
--background:        #0A0A0B   /* not pure black */
--surface:           #111113
--surface-elevated:  #1A1A1D
--surface-hover:     #232326
--border:            #27272A
--border-strong:     #3F3F46
--text-primary:      #FAFAFA
--text-secondary:    #A1A1AA
--text-muted:        #71717A
--accent:            #F59E0B   /* warm amber — Kenyan sun, NOT generic indigo */
--accent-hover:      #FBBF24
--accent-foreground: #0A0A0B
--success:           #22C55E
--warning:           #F59E0B
--danger:            #EF4444
--info:              #3B82F6
```

**Light mode** (toggle, optional secondary):

```css
--background:        #FFFFFF
--surface:           #FAFAFA
--surface-elevated:  #FFFFFF
--surface-hover:     #F4F4F5
--border:            #E4E4E7
--border-strong:     #A1A1AA
--text-primary:      #09090B
--text-secondary:    #3F3F46
--text-muted:        #71717A
--accent:            #B45309   /* deeper amber for contrast on white */
--accent-hover:      #D97706
--accent-foreground: #FFFFFF
```

**Forbidden colors anywhere:**
- Generic SaaS indigo `#6366F1`, `#4F46E5`
- Purple-to-cyan gradients
- Pure black `#000000` (use `#0A0A0B`)
- Neon greens, electric blues, lime
- Tailwind defaults (`bg-blue-500`, `text-purple-600`)

### 4.3 Typography

- **Display headlines** (Space Grotesk 500/700, tight tracking):
  - H1 hero: `clamp(48px, 6vw, 88px)`, line-height 1.05, letter-spacing -0.02em
  - H2 section: `clamp(32px, 3.5vw, 56px)`, line-height 1.1
  - H3 sub: `clamp(24px, 2vw, 32px)`, weight 500
- **Body** (Inter 400):
  - Lede: 20px / 1.55
  - Standard: 16px / 1.65
  - Small: 14px / 1.5
- **Eyebrows / labels**: Inter 600, uppercase, tracking 0.18em, 12px
- **Code / numbers**: Geist Mono or `ui-monospace` system stack — for prices, license keys, machine IDs

### 4.4 UI patterns — premium SaaS rules

- **8px spacing base**. Section vertical rhythm 96px desktop / 56px mobile.
- **Borders, not shadows**. `border: 1px solid var(--border)`. Shadows reserved for modals + dropdowns only.
- **Buttons**:
  - Primary: filled amber, 6px corners, padding 12px 24px, no gradient
  - Secondary: 1px border on `--border-strong`, transparent bg
  - Ghost: text-only with `hover:bg-surface-hover`
- **Cards**: 1px border on `--border`, 12px corners (subtle, not pill-shaped). Elevated cards bump to `--surface-elevated`.
- **Inputs**: `--surface` background, 1px border, 6px corners. Focus → border becomes `--accent`. NO floating labels — labels above inputs.
- **Navigation**: sticky, transparent until scroll, then `--surface/80` with `backdrop-blur`. Logo wordmark left. Center: Product / Pricing / Docs / Changelog. Right: Sign in + amber "Start free trial" CTA.
- **Animation**: scroll-triggered fades only. No parallax, no scroll-jacking, no autoplay carousels under 8s.
- **Imagery**: real product screenshots from the ERP itself (POS, dashboards). NO 3D laptop mockups. NO stock photography of "businesspeople in suits."

### 4.5 Anti-patterns (verify against every page before shipping)

- No "🚀" "✨" "⚡" emojis in copy
- No "Get started in 60 seconds" urgency framing
- No floating chat-bubble support widget at launch (WhatsApp link is enough)
- No 3-column emoji feature grids
- No carousel auto-rotation under 8 seconds
- No video autoplay with sound
- No "Trusted by 50+ companies" avatar strips (we don't have them yet)
- No section titles like "Why Choose Us" or "Features"
- No `bg-blue-500`, `bg-indigo-500`, `bg-purple-500`, `from-purple-500 to-indigo-600`

---

## 5. CONTENT PHILOSOPHY

Every word on the public site is editable from Payload. Marketing copy lives in Payload `Pages` collection or page-specific `Globals`. The agent ships placeholder copy that the owner replaces; the placeholder copy must already be production-quality so launch is possible without rewriting.

Tone:
- **Direct over clever**. "Run your duka. Pay yourself." not "Unlock your retail potential."
- **Proof over promise**. Show the actual POS screen, the actual dashboard, the actual receipt. Never abstract "Streamline your workflow."
- **Local where it matters**. KES not USD. M-Pesa not "mobile wallet." KRA eTIMS not "tax compliance." Karibu, not "Welcome aboard."
- **No jargon**. "License" not "Tenant subscription." "Branch" not "Location entity."

Voice should sound like the owner (justinelut) wrote it personally — not a marketing agency, not GPT.

---

## 6. WHAT I WILL ASK NEXT

Before drafting Payload collections + page-by-page spec (Plan 02 + 03), I need:

1. **Brand name confirm**: Going with `BRAND_NAME = "Duka"`? Yes / pick from {Tindo, Bidhaa, Hesabu, Soko, Kibanda} / I'll suggest more.
2. **Domain at launch**: `omnix.co.ke` (existing) or do you want to register `duka.co.ke` / `dukaapp.com` / `getduka.com` at the same time?
3. **Trial → paid lockout behavior**: When 30-day trial ends and customer hasn't paid:
   - (a) Soft lock — POS stops, customer can still see existing data + export, must pay to resume sales
   - (b) Read-only — full app browsable but no new sales/data entry
   - (c) Hard lock — splash screen with payment CTA, no other access
   I recommend (a). Confirm.

Answer those 3 and I'll write Plan 02 (collections + telemetry).

---

## 7. PHASE GATES

Each subsequent plan document gates the next:
- **Plan 02** — Payload collections (releases, licenses, customers, machines, telemetry events, support tickets, payments). Owner approves the data model before pages reference it.
- **Plan 03** — Page-by-page spec (marketing + customer dashboard + admin extensions inside Payload). Owner approves UX flow.
- **Plan 04** — CI/CD: GitHub Actions on the desktop repo → builds Windows installer → uploads to R2 → POSTs new release to Payload's `/api/releases` endpoint → marketing site auto-shows new download. Owner approves release pipeline.
- **Plan 05** — Telemetry SDK in the desktop app (Rust side) — what gets sent, when, how to opt out, how to authenticate.
- **Plan 06** — Acceptance test plan + Visual Bible per page.

The agent must NOT start coding until Plan 02–05 are written and approved.
