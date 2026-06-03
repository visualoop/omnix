# DUKA — Comprehensive Build Brief

**The desktop ERP for Kenyan businesses · omnix.co.ke**

This document is a complete instruction set for the AI agent. Read it end-to-end before writing a single line. Do not produce an MVP. Build the production-grade product described here.

---

## 0. MISSION

Build the website for **Duka** — a Kenyan-built desktop ERP serving pharmacies, mini-marts, salons, restaurants, and hardware shops. The product is a paid Tauri application customers download once and own forever. The website's job is **convert a small-business owner into a free trial download**, then later **collect a one-time KES 30,000 payment** when the trial ends.

The brand voice: **direct, confident, locally fluent**. The product is *software you own*, not a subscription. The audience is owner-operators who already run things — they need fewer slogans and more proof.

The audience has already seen ten foreign-SaaS-translated-to-KE landing pages. They will judge Duka on the same axis they judge their own duka: precision, restraint, intentional choices.

If a section looks like a generic Bootstrap template, rebuild it. If a screen looks like a Calendly clone, rebuild it. The reference is **Linear / Stripe / Vercel / Cereal magazine**, not B2B WordPress.

Brand contact (visible across the site): WhatsApp `+254 700 000 000`, `hello@omnix.co.ke`, Nairobi, Kenya. Categories displayed: *Software for Kenyan SMEs · Pharmacy · Retail · Banking · Payroll*.

---

## 1. SOURCE & APPROACH

The Payload+Next 15 monorepo already exists at `website/`. It is the seed. **Do not** scaffold a second project. Iterate the existing scaffold to match this brief.

Verify before any change:
1. `pnpm dev` from `website/`
2. `http://localhost:3000/admin` boots
3. `http://localhost:3000` boots

Postgres is already in Docker (`database` container). The website's database is `duka_dev`. R2 bucket targets are documented in `RUNBOOK-deployment.md`.

---

## 2. TECH STACK (exact, no substitutions)

- **Runtime**: Node 20 LTS
- **Framework**: Next.js 16 App Router (Payload-scaffolded — keep)
- **CMS**: Payload CMS 3.84 — single source of truth for content, releases, customers, licenses, telemetry
- **Database**: Postgres 18 (Neon production, local Docker for dev)
- **Storage**: Cloudflare R2 via `@payloadcms/storage-s3`
- **Components**: shadcn/ui + Radix primitives + framer-motion
- **Styling**: Tailwind CSS v4 + custom CSS variables for the Duka palette (§3.2)
- **Fonts**: **Fraunces** (display, variable serif with italic + soft/wonk axes) + **Geist** (body, variable sans). Plus Jakarta Sans for UI labels. JetBrains Mono for numbers. **No Inter as the default.**
- **Icons**: **Phosphor Icons** (`@phosphor-icons/react`), bold weight by default. **No Lucide.**
- **Forms**: `@payloadcms/plugin-form-builder` for contact + demo + support forms
- **Email**: Resend via `@payloadcms/email-resend`
- **Payments**: Paystack REST API only — custom UI (no Paystack popup). Cards + M-Pesa via `mobile_money` channel
- **Hosting**: Vercel (Next.js) + Neon (Postgres) + Cloudflare R2 (media + installers)
- **Analytics**: PostHog (EU region)
- **Errors**: Sentry

---

## 3. UI / VISUAL DIRECTION — non-negotiable

The site signals **modern Kenyan SaaS confidence** — think *Linear's discipline, Cereal's restraint, Stripe's editorial proof, all with a warm Nairobi accent*. It is not "tropical software", not "African-optimised", not anything decorative. It is a serious tool for serious owner-operators.

### 3.1 Reference websites (study before designing)

**Tier 1 — primary anchors (the visual ceiling):**
1. **https://linear.app** — primary anchor. Dark surface, dense product detail, italic word emphasis on display headlines, sub-200ms motion.
2. **https://stripe.com** — confidence in restraint. One accent. Full-bleed product proof.
3. **https://vercel.com** — black/white precision. Geist typography. Bento.
4. **https://resend.com** — minimal dark, monospace accents, code-first developer voice.
5. **https://cal.com** — 3-step "how it works" pattern + open-source SaaS vibe.

**Tier 2 — editorial peers:**
6. **https://www.cerealmag.com** — single best typographic peer. Italic display, generous whitespace.
7. **https://aman.com** — slow, cinematic, type that breathes.
8. **https://www.aesop.com** — restraint as identity.

**Tier 3 — local relevance:**
9. **https://intasend.com** — KE fintech, professional tone.
10. **https://flutterwave.com** — pan-African fintech standard.

**Anti-references (study, copy nothing):**
- WordPress "ERP system" templates with 3D laptop mockups
- Bootstrap landing pages with "Trusted by 5,000+ companies" avatar strips
- ChatGPT-generated SaaS sites with purple-to-cyan gradients
- "🚀 Boost your business 10x" hero copy
- Calendly-style 3-column emoji feature grids

### 3.2 Palette — warm-luxe dark default

Two modes. Dark is default. Light is reserved for the receipt PDF (browser print) and the public PDF route — never the marketing pages.

```
Dark mode (DEFAULT — every page)
--bg:                #0B0907   /* deep warm black, espresso-toned */
--surface:           #15110D   /* warm stone */
--surface-2:         #1F1A14   /* elevated card */
--surface-hover:     #2A241B
--border:            #2C2620
--border-strong:     #443B30

--fg:                #F2EDE3   /* warm cream, never pure white */
--fg-muted:          #B8AC95   /* sand */
--fg-subtle:         #7A6F5C   /* taupe */

--accent:            #C77B3F   /* deep terracotta-copper */
--accent-hover:      #D89456
--accent-foreground: #0B0907
--accent-soft:       rgba(199, 123, 63, 0.08)
--accent-line:       rgba(199, 123, 63, 0.18)
--accent-glow:       rgba(199, 123, 63, 0.22)

--positive:          #B5904A   /* gilded amber for "active" */
--caution:           #C77B3F
--negative:          #B0432F   /* warm clay-red */
--neutral:           #7A6F5C
```

**Forbidden anywhere:**
- ANY green, blue, teal, purple, indigo (no `#22c55e`, `#3B82F6`, `#5E6AD2`, `#6366F1`, `#8B5CF6`, no Tailwind defaults `bg-blue-500`, `from-purple-500 to-indigo-600`)
- Pure black `#000000`, pure white `#FFFFFF`
- Gradient buttons, gradient hero overlays
- Drop-shadow cards (use 1px borders)
- Three-column emoji feature grids
- Section titles literally called "Features", "Services", "Why Choose Us"
- Stock photography of "businesspeople in suits"
- "Trusted by 50+ companies" avatar strip
- Pill badges saying "PREMIUM", "BESPOKE", "PRO"
- Carousels that auto-rotate < 8s
- Scroll-jacking, parallax

### 3.3 Typography

- **Display** (Fraunces, variable, italic on emphasis): H1 hero `clamp(56px, 7vw, 108px)` line 1.0, tracking -0.025em. **One italic word per headline** carries the brand voice.
- **H2 section**: Fraunces `clamp(40px, 4.5vw, 64px)` line 1.05.
- **H3**: Fraunces `clamp(26px, 2.6vw, 36px)` weight 400.
- **Body** (Geist): standard 16px / 1.6, lede 19px / 1.55, caption 13px.
- **UI labels** (Plus Jakarta Sans 600, uppercase, `letter-spacing: 0.22em`, 11px) — eyebrows, nav, button text.
- **Numbers / refs** (JetBrains Mono): tabular-nums for prices, license keys, timestamps.

### 3.4 UI patterns (the rules every component follows)

- **Spacing**: 4px base; section vertical rhythm 96/120/180px (tight/default/loose). Card padding 28–40px minimum.
- **Container widths**: NO `max-w-7xl`. Use the tokens in `globals.css`: `--w-narrow: 760px`, `--w-text: 920px`, `--w-default: 1180px`, `--w-wide: 1320px`, `--w-bleed: 1480px`.
- **Borders not shadows**: `border: 1px solid var(--border)`. Shadows reserved for modals + dropdowns + the one elevated price card.
- **Buttons**:
  - Primary: filled accent, 6px corners, ring-inset highlight on top edge, 13–15px label.
  - Secondary: 1px border on `--border-strong`, transparent bg.
  - Ghost: text-only with `hover:bg-surface-hover`.
- **Inputs**: dark surface bg, 1px border, 6px corners. Focus → border becomes `--accent`. Label above, never as placeholder.
- **Cards**: 1px border, 12–16px radius, no shadow (the one exception is the "Most popular" pricing card which gets the accent ring + soft accent-glow).
- **Imagery**: real product screenshots (POS, dashboards). Until they exist, hand-built `<PosPreview>` and `<FakeWindow>` components in dark surface chrome.
- **Animation**: Framer Motion `whileInView` fades only. Sub-200ms transitions on hover.

### 3.5 Anti-patterns (verify against EVERY page before shipping)

- No 🚀 ✨ ⚡ 💪 emoji in headlines
- No "Boost your business 10x" / "Get started in 60 seconds" copy
- No floating chat-bubble support widget
- No 3D laptop mockup
- No "Trusted by 50+" avatar strip
- No green status dots — use `--positive` (gilded amber)
- No pure white text — use `--fg` (warm cream)
- No `bg-blue-500`, `from-purple-500 to-indigo-600` anywhere
- No section title saying literally "Features" or "Why Choose Us"
- No `border-left: 4px solid` cards (per ai-slop-check skill)

---

## 4. REPOSITORY SETUP STEPS (already mostly done)

The repo at `website/` is the working tree. Verification commands:

```
pnpm install
pnpm exec tsc --noEmit         # must pass clean
pnpm dev                        # http://localhost:3000
```

Existing wiring already in place:
- shadcn initialized (`components.json`)
- Phosphor icons installed
- Fraunces + Geist + Plus Jakarta + JetBrains Mono loaded via `next/font/google`
- Tailwind v4 with `@theme` block
- Payload + Postgres + Cloudflare R2 storage adapter (env-driven)
- Resend email adapter
- Paystack endpoints
- License + telemetry endpoints
- 36 pages

What needs **rebuild** (per user's verdict that current cards/hero "look extremely ugly, lacks confidence"):
- Hero — sharper editorial composition, Italic word emphasis, no triple-card pricing strip cluttering above-fold
- Stats — kill the cliché "30 days · KES 30,000 · <300ms · Offline" 4-stat row, replace with editorial proof
- Modules bento — currently Linear-bento-mimic; rebuild into editorial alternating image/text rows
- Cards — currently 12px corners + 28px padding feel like Bootstrap. Tighten to single-pixel borders, larger padding (40px), no rounded corners on the elevated price card
- Pricing-above-fold — keep the **one tier + free trial + custom** model, but as a single editorial price block with three subtle entry points, not three competing cards
- Testimonials marquee — delete. It reads as Resend-clone. Replace with three editorial pull-quotes hung off-grid
- Closing CTA — currently a dark band with center text. Rebuild as a Linear-style oversized italic line.

---

## 5. PAYLOAD COLLECTIONS

Already exist (don't redesign — they're correct):

| Collection | Purpose |
|---|---|
| `users` | Internal staff (owner / support) |
| `customers` | Public users — auth-enabled, KE counties, business profile |
| `licenses` | DUKA-XXXX-XXXX-XXXX keys, tier, trial dates, majorVersionCap |
| `machines` | Desktop installs, telemetry rollups, geo |
| `releases` | Versioned installer artifacts (CI auto-creates drafts) |
| `payments` | Paystack transactions (source of truth for revenue) |
| `support-tickets` | Ticket threads with auto-numbered DUKA-T-YYYY-NNNNNN |
| `telemetry-events` | Append-only log, severity-tagged, 90/365-day retention |
| `pages` | Legal + help articles |
| `blog-posts` | Marketing content |
| `modules` | Per-trade marketing pages (Dawa, Omnix Retail, Salon …) |
| `media` | Uploads → Cloudflare R2 |

Globals: `Settings`, `Pricing`, `LandingPage`. All editable from `/admin` — owner never touches code.

---

## 6. PAGE-BY-PAGE SPEC (the redesign mandate)

### 6.1 `/` — Home (rebuild required)

Section order, exactly:

1. **Header** — sticky, transparent until 60px scroll → `bg-bg/82 backdrop-blur-xl`. Logo wordmark left in Fraunces 22px (`Duka` + amber dot). Nav center: `Modules · Pricing · Downloads · Changelog · Docs`. Hard right: `Sign in` (ghost) + `Start free trial` (filled accent).

2. **Hero — editorial** —
   - Eyebrow pill linking to `/changelog`: `v0.2.0 — Banking & Recurring Invoices shipped` in Plus Jakarta 600 12px tracked uppercase, with a small accent dot before it.
   - Headline in Fraunces 300, **`Run your duka.`** then a hard line break, then **`<em>Pay yourself.</em>`** at smaller weight in italic — never on the same line.
   - Below in Geist 19px (`max-w-[640px]` centred): one paragraph. *No bullet list. No proof points strip.*
   - Single primary CTA: `Start free trial →` (no secondary CTA above the fold).
   - Below CTA, in monospaced 11px tracked uppercase: `Windows 10 / 11 · 64-bit · 4 GB RAM minimum · KES 30,000 once`. **This is the only price reference above the fold.**
   - Hand-built `<PosPreview>` window centred under the headline, max-w 1080px, with subtle accent glow ring behind it.

3. **A note from the studio** (NEW — replaces the stats row) — full-bleed warm surface, single column 60ch centred. Three short paragraphs in Geist 19px italic introducing the product, signed `— Justin, founder`. No CTA.

4. **What we make** (NOT "Modules") — eyebrow "What we make". Four full-width image-and-text rows alternating image-left / image-right: Dawa Pharmacy, Omnix Retail, Salon (planned badge), Restaurant (planned badge). Each row: 6/12 image col, 5/12 text col with offset. Title in Fraunces 56px. Body Geist 17px. `Read more →` underline link.

5. **The receipt is the proof** (NEW dark-mode-within-dark) — surface bumps to `--surface-2`. Side-by-side: real eTIMS receipt UI on the left, the same data filed with KRA on the right, with a horizontal divider rule. Caption in Fraunces italic 26px hung off-grid: *"What you ring up is what KRA sees."*

6. **The studio's hand** — eyebrow "How we work". Three steps as a horizontal lockup: `01. Download.` `02. Run your duka.` `03. Pay once.` Each numeral in Fraunces 96px accent. One sentence each. No bullets, no icons.

7. **Recent work** — eyebrow "Customers running Duka today". 1-2-1 layout: full-width photograph hero of an actual KE business, then two side-by-side, then one full again. Each tile: real photo + business name overlaid bottom-left in Fraunces 36px cream + town + module in Plus Jakarta 12px tracked uppercase. **Until photos exist, render an honest placeholder** — a striped warm-grey card with `Pharmacy · Westlands · running v0.2.0` in monospace 11px, marked `placeholder: true` in the CMS so the owner can swap them.

8. **Built into the systems that run Kenya** (compliance / integrations) — quiet 4-col grid of integrations (KRA eTIMS, M-Pesa, NHIF/SHA, NSSF, Paystack, KEBS, PPB, Equity, KCB, Co-op). Each: name + 3-word description. NO icons. Single rule between rows.

9. **Three quotes** — three Fraunces italic 32px pull quotes, each with a thin accent rule above and below. Attribution in Plus Jakarta 13px tracked uppercase. **No avatars, no star ratings.**

10. **One price** (NEW — replaces the messy 3-card strip) — eyebrow "Pricing". Full-bleed warm surface. Single huge `KES 30,000` in Fraunces 144px. Below in Fraunces italic 28px: *"Once. For the whole product."* Below that, a single line with three quiet entry points: `[Start free trial] · [Buy a licence] · [Talk to us about Custom]` rendered as text links separated by mid-dot, NOT three competing cards.

11. **FAQ** — accordion, 8 questions. Question typeset as Fraunces 22px. Plus icon rotates to × on open.

12. **Closing CTA** — full-bleed dark band. Single line in Fraunces italic 64px centred: *"Run your duka properly."* Below: `[Start free trial]` accent button + small WhatsApp link. Nothing else.

13. **Footer** — wordmark, four small column lists (Product · Trade · Resources · Company), social icons in muted accent, KRA PIN footer line.

### 6.2–6.10 — Other pages

The other pages (`/pricing`, `/modules`, `/modules/[slug]`, `/downloads`, `/changelog`, `/about`, `/contact`, `/support`, `/blog`, `/blog/[slug]`, `/docs`, `/docs/[slug]`, `/privacy`, `/terms`, `/refund-policy`) already exist at the right level of detail. They need:

- **Container width audit** — every page uses `<Container width="default|wide|narrow|text|bleed">` (already done)
- **Hero swap** — every page hero gets the same Fraunces italic-word treatment
- **Card audit** — kill any leftover 3-column emoji grids; replace with either editorial alternating rows or single-column quote stacks
- **CTA discipline** — at most one primary CTA per section
- **Card border** — every card uses 1px `--border` only; the elevated card uses `--accent` ring + glow

### 6.11 — Auth + Dashboard + Checkout

Already built and correct. No changes needed except the same hero treatment on `/signup` and `/login`.

---

## 7. FORMS & SUBMISSIONS

`@payloadcms/plugin-form-builder` for:
- **Contact** (`/contact`) — name, email, phone, business, category, message → writes to FormSubmissions, emails sales@omnix.co.ke + customer confirmation via Resend.
- **Demo request** (`/contact?type=demo`) — same fields plus preferred time → routes to sales calendar.
- **Public support** (when not logged in) — name, email, license key (optional), description → routes to either an existing customer's tickets if license matches, otherwise FormSubmissions for triage.

Honeypot field on every form. Rate-limit 3 / hour per IP via Upstash Redis (only on production; dev skips).

---

## 8. SEO

- `@payloadcms/plugin-seo` already wired
- Per-page meta titles via `metadata` export
- `sitemap.ts` generated dynamically from MODULES_SEED + POSTS_SEED + DOCS_SEED + static routes (already done)
- `robots.ts` allows `/`, blocks `/admin`, `/dashboard`, `/buy`, `/api` (already done)
- Structured data: `Organization` on home, `SoftwareApplication` on `/downloads`, `FAQPage` on `/pricing`, `Article` on `/blog/[slug]`, `BreadcrumbList` everywhere
- OG image: `/api/og` with Vercel `@vercel/og` — title + Duka mark on warm surface

---

## 9. PERFORMANCE

- Lighthouse Performance ≥ 90 (mobile, simulated 3G), Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95
- LCP < 2.0s, CLS < 0.05
- JS budget: home `≤ 110 KB gz`, pricing `≤ 90 KB gz`, modules `≤ 120 KB gz`
- Hero image priority + AVIF + WebP fallback; everything else lazy
- No 3rd-party JS in critical path

---

## 10. DEPLOYMENT

Already documented exhaustively in `docs/website/RUNBOOK-deployment.md` — Vercel + Neon + Cloudflare R2 + Resend + Paystack.

---

## 11. ADMIN HANDOFF

Owner can do all of this from `/admin` without code:
- Edit hero copy + screenshot via `LandingPage` global
- Edit pricing tier numbers + add-ons via `Pricing` global
- Edit contact details + flags via `Settings` global
- Add new module page via `Modules` collection
- Add blog post via `BlogPosts`
- Read incoming form submissions and support tickets
- Publish or roll back releases (CI creates drafts, owner approves)

Document at `/docs/admin-handbook.md`. Already in deployment runbook.

---

## 12. TESTING

- TypeScript: `pnpm exec tsc --noEmit` clean
- Cargo (desktop): `cargo test --lib` — 10 passing
- Playwright E2E (when added): home → free trial signup → license activation → checkout → support ticket
- Manual QA matrix: iPhone SE (375px), iPad (768px), 1440px desktop
- Visual diff via webapp-testing skill: screenshot every public route, compare to Visual Bible

---

## 13. WHAT GOOD LOOKS LIKE

When the rebuild is done:

1. A first-time visitor lands on `/` and feels they have walked into Linear's settings with Cereal magazine's typography (warm dark, Fraunces italic, real product UI, no emoji).
2. The pricing is **one number** (`KES 30,000`) shown editorially, not three competing cards.
3. Every section title uses an **evocative phrase**, never "Features" or "Why Choose Us".
4. Every card has **1px border, no shadow** (except the one elevated pricing card).
5. The hero has **one CTA**, not two competing ones.
6. **No green / blue / purple / teal anywhere** — strict warm-luxe palette.
7. **No Inter / Roboto / Arial silently used** — Fraunces + Geist + Plus Jakarta only.
8. **No 3-column emoji feature grid anywhere.**
9. Lighthouse Performance ≥ 90, Accessibility ≥ 95.
10. The owner can swap every piece of marketing copy + every photograph from `/admin` in ten minutes, no developer.

If any one of these fails, the rebuild is not done.

---

## 14. REFERENCES (visual study before designing — Tier 1 mandatory)

**Tier 1 (visual ceiling):**
- https://linear.app
- https://stripe.com
- https://vercel.com
- https://resend.com
- https://www.cerealmag.com

**Tier 2 (editorial confidence):**
- https://aman.com
- https://www.aesop.com
- https://supabase.com
- https://cal.com

**Tier 3 (local KE relevance):**
- https://intasend.com
- https://flutterwave.com
- https://www.singita.com

**Anti-references (study, copy nothing):**
- Generic Bootstrap / Wix "ERP" templates with hard-hat icons + blue+orange palettes
- Calendly clones with three-column emoji feature grids
- ChatGPT-generated landing pages with purple-to-cyan gradients

---

## 15. THINGS TO EXPLICITLY NOT DO

- Do not build an MVP. Build the production site.
- Do not introduce a second component library (no MUI, no Chakra, no Mantine).
- Do not introduce a second icon library — Phosphor only. Lucide is banned.
- Do not use `max-w-7xl` anywhere.
- Do not use any color outside the §3.2 palette. No green, no blue, no purple.
- Do not use Inter / Roboto / Arial as a default — Fraunces + Geist + Plus Jakarta only.
- Do not auto-play hero video with sound.
- Do not title a section "Features", "Services", "Why Choose Us", "Solutions", or any other generic phrase.
- Do not put three competing cards above the fold for pricing — there is one tier, plus a free trial entry, plus a custom entry. **Editorial, not competitive.**
- Do not use emoji icons on any page.
- Do not add a chat-bubble support widget — WhatsApp link is enough.
- Do not put avatars on testimonials.
- Do not use shadow-cards. 1px border, no shadow.
- Do not write copy that says "Boost your business 10x" or "Get started in 60 seconds".
- Do not ship without screenshotting every route via the webapp-testing skill and comparing to Tier 1 references.

End of brief. Build it.
