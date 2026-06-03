# DUKA WEBSITE — Plan 03: Page-by-Page Spec & Information Architecture

This document defines every route, every section on every route, every CTA, every form, and the customer/admin dashboards. Components reference Plan 02's collections by slug. Patterns derived from studying Linear, Vercel, Stripe, Resend, Supabase, Cal.com.

---

## 1. ROUTE MAP

```
PUBLIC (marketing)
├─ /                                  Landing
├─ /pricing                           Pricing & comparison
├─ /modules                           All modules grid
│  ├─ /modules/dawa                   Pharmacy module
│  ├─ /modules/retail                 Retail module
│  ├─ /modules/[slug]                 Generic module page (CMS-driven)
├─ /downloads                         Latest installer + version history
├─ /changelog                         Releases timeline (auto from CMS)
├─ /blog                              Blog index
│  ├─ /blog/[slug]                    Post
├─ /docs                              Help/user docs (rendered from Pages where kind='help')
│  ├─ /docs/[slug]
├─ /about                             Company
├─ /contact                           Contact form (form-builder)
├─ /support                           Support hub (raise ticket if logged in, else WhatsApp/email)
├─ /privacy, /terms, /refund-policy   Legal (Pages where kind='legal')
├─ /404, /500                         Error states

AUTH
├─ /signup                            Customer registration
├─ /login                             Customer login
├─ /forgot-password
├─ /verify-email/[token]

CHECKOUT
├─ /buy/[licenseId]                   Custom Paystack flow (server-side init)
├─ /buy/success                       Payment success (Paystack callback)
├─ /buy/cancelled

CUSTOMER DASHBOARD (authenticated, /dashboard route group)
├─ /dashboard                         Overview (licenses, machines, latest version)
├─ /dashboard/licenses                List
│  ├─ /dashboard/licenses/[id]        License detail (machines, payments, expiry, upgrade)
├─ /dashboard/downloads                Their entitled installers
├─ /dashboard/machines                 List of registered installs
│  ├─ /dashboard/machines/[id]         Machine detail (version, location, last sync, deactivate)
├─ /dashboard/payments                 Receipts + invoices (PDF download)
├─ /dashboard/support                  Their tickets
│  ├─ /dashboard/support/new           Open ticket
│  ├─ /dashboard/support/[id]          Thread
├─ /dashboard/billing                  Renewals, add-ons (cloud backup, extra branches)
├─ /dashboard/profile                  Account settings
├─ /dashboard/api-keys                 (future) for advanced integrations

ADMIN (Payload's /admin, custom views injected)
├─ /admin                              Default Payload admin
├─ /admin/views/installs-map           Custom view — Leaflet map of all machines
├─ /admin/views/telemetry-overview     Custom view — Recharts dashboards
├─ /admin/views/revenue                Custom view — Payments aggregations

API (Next.js route handlers, app/api/*)
├─ /api/paystack/init                  POST  initialize Paystack transaction (server-side)
├─ /api/paystack/webhook               POST  webhook receiver
├─ /api/licenses/validate              POST  desktop app license check
├─ /api/licenses/activate              POST  desktop app activation (machine register)
├─ /api/telemetry/events               POST  desktop app posts batched events
├─ /api/telemetry/heartbeat            POST  lightweight ping
├─ /api/releases                       POST  CI uploads new release (system-token auth)
├─ /api/releases/latest                GET   public — used by Tauri updater
├─ /api/downloads/track                POST  bump downloadCount
```

---

## 2. GLOBAL UI ELEMENTS

### 2.1 Header (sticky, transparent → opaque on scroll)

```
[BRAND_NAME logo wordmark]   Product ▾   Modules ▾   Pricing   Downloads   Docs    [Sign in]  [Start free trial →]
```

- Wordmark: BRAND_NAME in Space Grotesk 700 + 4px amber dot — `Duka.`
- "Product" mega-menu (Linear/Vercel-style): grid with Core / POS / HR / Banking / Reports columns
- "Modules" mega-menu: Dawa, Retail, Salon (planned), Restaurant (planned)
- "Sign in" → ghost button. "Start free trial" → primary amber.
- Mobile: hamburger → full-screen sheet, sections collapse.
- Theme toggle (sun/moon/system) far right of nav, under hamburger on mobile.

### 2.2 Footer

5-column grid, narrows to accordion on mobile. Content bound to `Settings` global.

```
PRODUCT          MODULES         RESOURCES        COMPANY          CONNECT
Pricing          Dawa            Documentation    About            WhatsApp
Downloads        Omnix Retail     Changelog        Blog             support@…
Changelog        Salon (soon)    Status           Contact          Twitter
Security         Hardware        Help center      Careers          GitHub

[BRAND wordmark]                                                    KRA PIN: P051234567A
© 2026 Duka. All rights reserved.    Privacy   Terms   Refund Policy
                                                                    🌐 EN | SW (toggle)
```

- "Status" links to a status page (placeholder /status; real BetterStack/StatusPage later).
- WhatsApp link → `wa.me/<Settings.whatsappNumber>`.

### 2.3 Common section atoms

- `<SectionHeader eyebrow="..." title="..." subtitle="...">` (consistent vertical rhythm)
- `<CTA primary="Start free trial" secondary="See pricing">`
- `<Card>` (border, subtle hover lift, no shadow)
- `<Bento span={1|2|3}>` (12-col grid, configurable)
- `<TestimonialCard quote name role photo company>`
- `<StatBlock value="30 days" label="Free trial">`
- `<ScreenshotFrame caption>` — wraps real product screenshots in a window-chrome frame
- `<CodeBlock>` — for any code/CLI references
- `<MoneyBadge>` — KES amounts in monospaced typography

---

## 3. MARKETING PAGES

### 3.1 `/` — Landing page

Single-source-of-truth for content: `LandingPage` global + `Modules` collection + `Releases` (latest published) + `Pricing` global.

**Section A — Hero (full viewport on desktop)**
```
[eyebrow]    NEW · v0.2.0 — Banking & Recurring Invoices
              ↳ tag links to /changelog#v0.2.0

[H1]         Run your duka. Pay yourself.
[subheadline] All-in-one ERP for Kenyan pharmacies, mini-marts, salons,
              and shops. Works offline. Costs less than your rent.
              No subscription forever.

[primary CTA] Download free trial (30 days)
[secondary]  See it in action →

[hero visual]  Real screenshot of POS in dark mode, slight 3D tilt
               (NOT a 3D laptop mockup — the actual UI)
```

- Hero visual is a `Media`-uploaded image cropped 16:10. CMS field allows replace.
- Below hero: small system-requirements pill ("Windows 10/11 · 64-bit · 4 GB RAM minimum")

**Section B — Stat row (replaces "trusted by" logos until we have real ones)**
4 stat blocks in a row, no border:
- `30 days` Free trial · no card
- `KES 30,000` One-time fee, lifetime updates¹
- `<300 ms` Average POS sale completion
- `Offline` Works without internet

¹ asterisk → "Major versions priced separately."

**Section C — "Built for your trade" modules bento**
6-card bento grid (Linear-style alternating spans). Reads from `Modules` collection where `available != 'planned'`. Each card:
- Module icon + name + tagline
- Short feature pill list (max 4)
- Tiny screenshot in lower right
- "Live" / "Beta" / "Coming Q3 2026" badge
- Click → /modules/[slug]

**Section D — How it works (3 steps with numbered badges, Cal.com-style)**
1. **Download** — One installer. 30-day free trial. No credit card.
2. **Run your business** — POS, inventory, employees, banking, taxes — already wired together.
3. **Pay once** — When the trial ends, pay one-time license fee. Use forever.

**Section E — Feature spotlight (alternating image-text, 3 spotlights)**
1. **Point of Sale that doesn't break** — KRA eTIMS receipts, M-Pesa STK push, parked sales, layaway, refunds with manager approval. Screenshot of POS in action.
2. **Inventory that closes itself** — Branch transfers, expiry tracking, batch numbers, low-stock alerts to WhatsApp. Screenshot of inventory grid.
3. **Banking + payroll + tax** — Reconcile M-Pesa Till, run NHIF/SHA + NSSF + PAYE in one click, file with KRA. Screenshot of banking dashboard.

Each spotlight: 60/40 split, screenshot left or right alternating, eyebrow-h2-paragraph-bullet stack.

**Section F — Module deep dive teaser**
2-card grid:
- **For pharmacies → Dawa** (compliance-first card)
- **For shops → Omnix Retail** (volume-first card)

Each card has 3 selling points + photograph of the actual industry (real, not stock).

**Section G — Testimonials (Resend-style 3-col infinite scroll)**
Reads from `LandingPage.testimonials`. Empty array on day-1 means section is hidden via conditional render. Build placeholder testimonials of 6 quotes (pharmacist, retailer, salon owner, hardware shop, mini-mart, restaurant) — owner replaces with real ones.

**Section H — Pricing teaser (3 cards mini)**
Pulls from `Pricing` global. Only the headline number + 3 bullets per tier. CTA → `/pricing`.

**Section I — Closing CTA (large, centred, dark band)**
```
Stop juggling spreadsheets.
Run your duka properly.

[Download free trial]   [See pricing]
```

**Section J — Footer**

---

### 3.2 `/pricing` — Pricing page

Single, no-bullshit page. All numbers from `Pricing` global.

**Section A — Header + lockup**
```
[eyebrow]   Pricing
[H1]        Pay once. Use forever. Update on your schedule.
[sub]       No subscriptions, no per-user fees, no surprise charges.
            One licence per business. Major upgrades priced separately,
            so you decide when to pay for what's new.
```

**Section B — Toggle: pay frequency / currency**
- Currency toggle: KES (default) / USD (read-only display, computed from CMS field — for diaspora customers buying for relatives back home)
- "Show maintenance" toggle: shows the optional 1-year maintenance subscription on top of base fee

**Section C — 3-tier cards (Stripe-style)**

| Card | Header | Big number | Bullets | CTA |
|---|---|---|---|---|
| **Starter** | "For 1 shop" | KES 30,000 *one-time* | 1 branch · 3 PCs · Core+Dawa+Retail · Email support · 1 year free maintenance | Buy Starter |
| **Business** ⭐ | "For growing teams" | KES 75,000 *one-time* | Up to 5 branches · 10 PCs · All current modules · Priority WhatsApp support · 1 year free maintenance · Cloud backup included | Buy Business |
| **Enterprise** | "For chains & franchises" | Custom | Unlimited branches · Unlimited PCs · Dedicated onboarding · Custom integrations · SLA · On-prem option | Talk to us |

- Middle card has amber glow border + "Most popular" pill.
- Each card lists what's included with checkmarks; what's NOT included with `–` in muted color.

**Section D — Add-ons (full-width row)**

```
Cloud backup       KES 500 / month / branch       Auto-backup nightly to R2
Extra branch       KES 15,000 one-time             Add to existing license
Extra PC seat      KES 5,000 one-time              Add machine slot
Major upgrade      50% off list price              When v2.x ships, half-price for current owners
Custom training    Quote                            On-site or remote
```

**Section E — Comparison table (Stripe pricing table pattern)**
Wide horizontally-scrolling table from `Pricing.compareTable`. Rows = features; columns = Starter / Business / Enterprise. Sticky first column.

**Section F — FAQ (accordion, 8-12 items)**

Examples (all editable from a `Pages` doc with slug `pricing-faq`):
1. What does "lifetime" actually mean?
2. What happens when v2.x ships?
3. Is there a refund policy?
4. Can I move my licence to a new computer?
5. What if I add a new branch later?
6. Do I need internet to use Duka?
7. How does the cloud backup work?
8. Do you offer student / NGO / agriculture cooperative discounts?

**Section G — "Still not sure?"**
Three cards: WhatsApp / Email / Book a demo (book-a-demo opens contact form with category=demo).

**Section H — Closing CTA + footer**

---

### 3.3 `/modules` — All modules

Grid of all `Modules` (live + beta + planned). 3-col on desktop, 1 on mobile.

Filter chips above grid: "All / Live / Beta / Coming soon".

Each card → `/modules/[slug]`.

Below grid:
- **"Don't see your trade?"** card with link to `/contact?category=feature_request` — captures: business type, what features they need.

---

### 3.4 `/modules/dawa` — Pharmacy module page

Long-form, vertical-specific. Pulls from `Modules where moduleId='dawa'`.

Sections:
1. **Hero** — `Run your pharmacy. Calm and compliant.` + subheading + screenshot of dispensing screen.
2. **Compliance check** — Big card listing PPB, KEMSA, KRA, SHA, NHIF requirements with checkmarks (from `module.compliance[]`).
3. **For who** — 4 cards: independent chemists, retail pharmacy chains, hospital out-patient pharmacies, dispensaries.
4. **Features** — 6-bento grid with screenshots:
   - Prescription tracking & dispensing log
   - Batch & expiry management
   - Controlled drugs ledger
   - Drug-drug interaction warnings
   - Insurance billing (NHIF/SHA + private)
   - Refill reminders to patients
5. **Workflow video / GIF placeholder** — embedded, looped, no audio
6. **What you'll need** — cards: PPB licence, KRA PIN, SHA configuration, M-Pesa till
7. **Pricing pullout** — Starter price + module is included
8. **CTA** — Download trial + WhatsApp

### 3.5 `/modules/retail`

Same structure as Dawa, content swapped:
1. Hero: `Sell faster. Reorder smarter.`
2. For who: mini-marts, hardware shops, electronics, general dukas.
3. Features: barcode scanner, multi-branch transfer, supplier credit ledger, customer loyalty cards, layaway, end-of-day Z-report.
4. Workflow video.
5. CTA.

---

### 3.6 `/downloads`

The page CI updates indirectly via Releases collection.

**Header:**
```
[eyebrow]   Downloads
[H1]        Get Duka on your computer.
[sub]       Latest version, ready to install.
```

**Latest release card (full-width, prominent):**
- Version badge `v{latest.version}` + `{channel}` pill
- Title + summary
- Two big buttons: "Download for Windows (.msi)" + "Download for Windows (.exe)"
  - Filesize next to each: `48.3 MB`
  - SHA-256 hash on hover/click
  - Click triggers `/api/downloads/track` then redirects to R2 signed URL
- "What's new" → bullet list from `release.highlights[]`
- Link "Read full changelog →" → /changelog#vX.Y.Z

**System requirements** (small card):
```
Windows 10 (1903+) or Windows 11
64-bit (x86_64)
4 GB RAM minimum (8 GB recommended)
2 GB free disk space
SQLite is bundled. No external database required for single-PC.
```

**Older versions** (collapsible):
Table of last 10 published releases — version, date, size, download links. Click row → expand → highlights + changelog link.

**Sidebar (sticky, right):**
- "Verify your download" — explanation of SHA-256
- "License troubleshooting" → /docs/license-issues
- "Auto-updater explanation" — "Once installed, Duka updates itself when new versions ship and your maintenance is current."

**Trial vs paid lookup:**
- If logged-in customer with active license → button text changes to "Download (your license: DUKA-XXXX-...)"
- Anonymous → "Download free trial"

---

### 3.7 `/changelog`

Reads `Releases` collection where `status='published'`, sorted desc.

**Pattern:**
- Linear/Resend-style timeline. Each entry:
  - Sticky date column on left (desktop)
  - Right column: version pill + title + summary + highlights with screenshots + breaking changes (red callout) + "Download" button
  - Anchor link `#v0.2.0` for direct linking
- Filter pills at top: All / Stable / Beta / Major releases only.
- Pagination: load more, 10 per page.

---

### 3.8 `/blog`

Standard SaaS blog. Reads `BlogPosts where status='published'`.

- Top: featured post (large card, latest where category='announcement')
- Grid: 3-col cards by date desc
- Category filter pills: All / Product / Industry / Tutorial / Announcement
- Each card: hero image, category, title, excerpt, author + date
- Pagination

`/blog/[slug]` — long-form post template:
- Hero image full-bleed
- Title + excerpt + author/date
- Body (rich text)
- "Read next" 3-card row
- Newsletter signup inline

---

### 3.9 `/docs` (Help center)

Renders from `Pages where kind='help'`.

- Sidebar: nested categories (Setup / Modules / Troubleshooting / Pricing / Integrations)
- Main: rendered rich text + table of contents (right rail on desktop)
- Search bar (Algolia DocSearch later — placeholder Cmd-K dialog day 1)
- Each page links to `/contact?category=question` at bottom.

---

### 3.10 `/about`, `/contact`, `/support`, `/privacy`, `/terms`, `/refund-policy`

- **/about** — Founder story, mission, KE focus, contact. Single Pages doc, kind='about'.
- **/contact** — Form (form-builder): name, email, phone, business name, category dropdown, message. Submits to `FormSubmissions`. WhatsApp + email + KE office address shown alongside.
- **/support** — Logged out: WhatsApp button + email + "How to read your license key" + "Common issues" (links to /docs). Logged in: redirect to `/dashboard/support`.
- **/privacy, /terms, /refund-policy** — Pages where kind='legal'. Plain prose, table of contents, last-updated date prominent.

---

## 4. AUTH PAGES

### 4.1 `/signup`

Two-column on desktop:

**Left column (form):**
- Headline: "Create your Duka account."
- Sub: "Free 30-day trial. No card required."
- Fields: full name, email, password (with strength meter), business name, phone, county dropdown, business type dropdown.
- Marketing opt-in checkbox (default checked).
- Terms acceptance checkbox (required).
- Submit → "Create account" amber button.
- "Already have an account? Sign in" link.

**Right column (visual):**
- Quote testimonial + small product screenshot.
- 3 quick benefits: "Free trial · No card · Pay once if you keep it"

**Flow:**
1. Submit creates Customer (Payload auth, `emailVerified=false`).
2. Sends verification email via Resend.
3. Auto-creates Trial License with status='trial', trial duration 30 days.
4. Redirects to `/dashboard?welcome=1`.

### 4.2 `/login`

Single column, centered. Email + password. "Forgot password?" link. "Don't have an account? Sign up" link.

### 4.3 `/forgot-password`

Email field → sends reset link via Payload. Generic confirmation message regardless of email validity (prevent enumeration).

### 4.4 `/verify-email/[token]`

GET — calls Payload's verify endpoint, sets `emailVerified=true`, redirects to /dashboard with toast.

---

## 5. CHECKOUT FLOW

### 5.1 `/buy/[licenseId]` — Custom Paystack flow

**No Paystack popup. We control the UI.**

Page is gated: must be logged-in customer who owns this license.

**Layout:**
- Left: order summary (line items: license tier upgrade, optional cloud backup, optional extra branches), totals, KES.
- Right: payment form.

**Right side — payment form:**
- Tab switcher: `Card` | `M-Pesa` | `Bank Transfer`
- **Card tab**: name on card, card number, expiry, CVV (validates client-side; numbers tokenised via Paystack inline JS without showing popup — we use `PaystackPop.setup({onClose, onSuccess})` programmatically OR Paystack's `transaction/initialize` server-side and redirect to a hosted-only-when-needed page; for max control we use server-side init + custom Paystack form via `paystack-checkout` API).
- **M-Pesa tab**: phone number input. Click "Pay KES X with M-Pesa" → server calls `POST /charge` with `mobile_money={phone, provider: 'mpesa'}`. UI shows polling state: "Confirm the prompt on your phone…". Paystack returns `display_text`. After 60s timeout, allow retry.
- **Bank Transfer tab**: server creates dedicated nuban via Paystack `dedicated_account`, displays bank + account number + reference. UI auto-polls status every 5s.

**Backend orchestration:**
```
POST /api/paystack/init
  body: { licenseId, purpose, amount, channel }
  ↓ verifies user owns license
  ↓ creates Payment doc with status='pending'
  ↓ calls Paystack /transaction/initialize with our reference
  ↓ returns access_code + reference
Frontend submits with that reference
  ↓ Paystack processes
  ↓ webhook to /api/paystack/webhook → updates Payment, License
  ↓ frontend polls /api/payments/[reference]/status until success
On success → /buy/success?ref=xxx
```

### 5.2 `/buy/success`
- Confetti animation (subtle, 1.5s, then fades).
- License key displayed prominently in monospace, with copy button.
- Receipt download button (PDF generated server-side).
- "What's next" 3-card row: Download installer / Activate on first PC / Read user docs.

### 5.3 `/buy/cancelled`
- Clear messaging: "Payment didn't go through. No money was charged."
- Reason if known (Paystack failure code mapped to friendly text).
- "Try again" button → back to /buy/[id].
- "Need help? WhatsApp us."

---

## 6. CUSTOMER DASHBOARD (`/dashboard/*`)

Authenticated route group. Layout: top nav + left sidebar + main.

### 6.1 Layout

```
TOP NAV: [Logo]   [Dashboard / Licenses / Downloads / Support]   [Avatar ▾]
LEFT SIDEBAR: My licences (count), Machines (count), Payments, Profile, Sign out
MAIN: route content
```

Sidebar collapses to icon-only on tablet, drawer on mobile.

### 6.2 `/dashboard` — Overview

Grid of cards (Supabase-style):

**Card 1 — License status (large, span-2)**
- License key (monospace, copyable)
- Tier badge
- Status pill (active / trial / lapsed)
- Trial countdown if applicable: "23 days left in trial · [Buy now]"
- Modules included
- Maintenance until date
- "Manage license" → /dashboard/licenses/[id]

**Card 2 — Machines (span-1)**
- "X of Y machines used"
- Last sync
- "Manage" link

**Card 3 — Latest version (span-1)**
- v0.2.0 published 3 days ago
- "Your machines: 2 on v0.2.0, 1 on v0.1.6 (out of date)"
- "Download / View changelog"

**Card 4 — Recent payments (span-2)**
- Last 3 payments table

**Card 5 — Open tickets (span-2)**
- 0 open / 2 resolved
- "Open new ticket" button

### 6.3 `/dashboard/licenses` and `/dashboard/licenses/[id]`

- List view: each license as a card with key, tier, status, expiry, "Manage".
- Detail view: 4 tabs — Overview / Machines / Payments / Upgrade.
  - **Overview**: license key + dates + downloadable PDF certificate.
  - **Machines**: list registered machines with deactivate button (frees a slot).
  - **Payments**: list of payments tied to this license.
  - **Upgrade**: shows next major version + upgrade price + "Pay & unlock v2.0" button → /buy flow.

### 6.4 `/dashboard/downloads`

- Same as public `/downloads` but personalised: "your license: DUKA-XXXX-XXXX-XXXX" badge above download buttons.
- If license is lapsed: "Pay to access latest version" CTA replaces download buttons.

### 6.5 `/dashboard/machines` and detail

- List: hostname, OS, version, last seen, status.
- Detail: full info — geo (with map preview), telemetry (last 10 events of severity ≥ warn), integrations status, deactivate button.

### 6.6 `/dashboard/payments`

- Table sortable by date. Columns: ref, date, purpose, amount, channel, status, [Receipt PDF].
- Filter: by purpose, status.

### 6.7 `/dashboard/support` and threads

- List of customer's tickets.
- "New ticket" button → form with: subject, category, license picker, machine picker (optional), description, file attachments.
- Detail view: chat-thread style, customer types reply at bottom, sends with Cmd-Enter.
- Status pill at top right.

### 6.8 `/dashboard/billing`

- "Renew maintenance" card if `maintenanceUntil < 60 days from now`.
- "Add cloud backup" toggle → opens checkout for KES 500/mo subscription.
- "Add extra branch" / "Add machine seat" cards.
- Auto-renew toggle (off by default; honest reminder emails 14/7/1 day before lapse).

### 6.9 `/dashboard/profile`

- Tabs: Profile / Password / Email preferences / Danger zone.
- Danger zone: "Delete account" with 30-day grace + warning about license loss.

---

## 7. PAYLOAD ADMIN EXTENSIONS

We do NOT build a separate admin frontend. Everything lives in `/admin` (Payload's built-in UI), extended via:

### 7.1 Custom dashboard component (`payload.config.ts → admin.components.beforeDashboard`)

Replace the default dashboard with custom React that shows:
- 4 KPI cards: Active licenses · Trial licenses · Total machines online · MRR (monthly recurring from cloud backup + maintenance)
- Recent telemetry errors (last 24h, severity ≥ error)
- Recent payments (last 7 days, success only)
- Active geo activity: "X machines online right now"

### 7.2 Custom views (`payload.config.ts → admin.components.views`)

**`/admin/views/installs-map` — Live map**
- Full-screen Leaflet map of Kenya
- Pin per Machine with `lat`/`lng` (clustered with `react-leaflet-markercluster`)
- Pin click → side panel: machine details + license + customer + recent events
- Filter chips: by module, by status, by version, by county
- Refreshes every 60s.

**`/admin/views/telemetry-overview` — Diagnostics**
- Recharts dashboards:
  - Errors per day (bar, last 30 days)
  - Crashes by version (stacked bar)
  - Sales volume reported per machine (top 20 list)
  - Integration failure breakdown (mpesa / etims / sha) pie
- "Most recent fatal errors" table (with stack trace toggle)
- Filter: date range, machine, license, version, severity

**`/admin/views/revenue` — Revenue dashboard**
- Total revenue (lifetime, this month, this year)
- New licenses per week
- Maintenance renewals breakdown
- Cloud backup MRR
- Refund rate
- Payment method breakdown

### 7.3 Custom field components

- `LicenseKeyField` — copy-to-clipboard built in
- `MapPickerField` — pick a county/coords visually for Customers manual entry
- `R2DownloadLinkField` — for Releases artifact URLs, validates that file exists in R2 and shows size

### 7.4 Admin column customisations

- Customers list: add column "Active licenses count"
- Licenses list: add column "Days until trial ends" / "Days until maintenance lapse"
- Machines list: relative-time "Last seen" with traffic-light icon (green <24h, amber <7d, red >7d)

### 7.5 Bulk actions

- Licenses: "Suspend selected" / "Restore selected" / "Send broadcast email"
- Machines: "Deactivate selected"
- TelemetryEvents: "Bulk delete debug events"

### 7.6 Saved views (Payload Lists views)

Pre-configured for owner:
- "Trials ending in 7 days"
- "Lapsed licenses (this week)"
- "Errors in last 24h"
- "Outdated machines (running version < latest -1)"
- "High-usage customers (sales > KES 1M/mo)"

---

## 8. FORMS (form-builder plugin config)

Three forms registered via Payload's form-builder:

1. **Contact** (`slug: contact`)
   - Fields: name, email, phone, business, category (general/sales/demo/feedback), message
   - Confirmation: redirect to `/contact?submitted=1`
   - Email to: `Settings.salesEmail`

2. **Demo Request** (`slug: demo-request`)
   - Fields: name, email, phone, business, employees, modules of interest, preferred time
   - Confirmation: "We'll WhatsApp you within 1 business day."
   - Email to: `Settings.salesEmail` + create lead (FormSubmission visible in Payload)

3. **Support Ticket Public** (`slug: support-public`)
   - Available on /support when logged out
   - Fields: name, email, subject, license key (optional), description, attachments
   - On submit: creates SupportTicket if license matches existing customer; otherwise creates FormSubmission for triage.

---

## 9. EMAILS (Resend templates)

All emails as React Email components in `src/emails/`. Sent via Resend. Each is a React function returning JSX rendered to HTML.

| Template | Trigger |
|---|---|
| `WelcomeEmail` | Customer signup → verify email |
| `EmailVerified` | After clicking verify link |
| `TrialStarted` | New License with status='trial' |
| `TrialEndingSoon` | 7 days / 1 day before trialEndsAt |
| `TrialEnded` | trialEndsAt passed |
| `LicenseIssued` | Payment success → license activated |
| `PaymentReceipt` | Every successful Payment |
| `PaymentFailed` | Failed Payment |
| `MaintenanceEndingSoon` | 30/7/1 days before maintenanceUntil |
| `MaintenanceRenewed` | After renewal payment |
| `NewReleasePublished` | Release.status → published, to maintained customers |
| `MajorUpgradeAvailable` | New majorVersion released, to current owners |
| `SupportTicketUpdate` | New thread message (to ticket owner) |
| `PasswordReset` | Forgot password |
| `BroadcastEmail` | Manual from owner (composes in Payload, sends to filter set) |

---

## 10. SEO

Plugin: `@payloadcms/plugin-seo`. Per-page metadata fields auto-injected on `Pages`, `BlogPosts`, `Modules`, `Releases`.

- `<title>` template: `{page} — Duka` (from BRAND_NAME).
- Default OG image: 1200x630 PNG with brand wordmark + tagline (regenerated per page using Vercel OG when post has hero image).
- `sitemap.xml` generated dynamically from all published Pages, BlogPosts, Modules, Releases.
- `robots.txt` allows all except /admin, /dashboard, /buy, /api.
- Structured data:
  - `Organization` schema in `<head>` everywhere
  - `Product` schema on /pricing
  - `SoftwareApplication` schema on /downloads
  - `FAQPage` schema on /pricing
  - `Article` schema on /blog/[slug]
  - `BreadcrumbList` everywhere
- Canonical URLs always set.
- `hreflang` for English/Swahili once Swahili content lands (out of scope for v1).

---

## 11. ANALYTICS & ERROR TRACKING

- **PostHog**: pageviews, signup funnel, checkout funnel, dashboard usage. `posthog-js` initialised in app/(frontend)/layout.tsx, only after consent (cookie banner per GDPR-style — even though Kenya has no current strict requirement, we model good behaviour).
- **Sentry**: client + server. DSN per environment. Source maps uploaded on Vercel build.
- **Cookie banner**: Settings global has `cookieBannerEnabled` flag; off by default (no cookies set without consent except essential session).

---

## 12. CONTENT FREEZE FOR LAUNCH (DAY-1 ESSENTIALS)

Owner must populate the following before public launch (admin handoff doc covers how):

- `Settings` global: brand, contacts, social
- `Pricing` global: tiers + comparison table
- `LandingPage` global: hero copy, 3 module cards, 6 testimonials
- `Modules` collection: at minimum `core`, `dawa`, `retail` with full content
- `Pages`: privacy, terms, refund-policy, about
- `Releases`: latest stable release with installer URLs
- 6 blog posts (1 announcement, 2 tutorials, 2 industry, 1 product)
- `Pages where kind='help'`: 12 starter docs (install, license activation, common errors, etc.)

---

## 13. WHAT'S NEXT

Plan 03 done. Next:
- **Plan 04** — CI/CD pipeline (GitHub Actions on the desktop repo → R2 → Payload Releases entry).
- **Plan 05** — Telemetry SDK in Tauri Rust side.
- **Plan 06** — Acceptance tests + Visual Bible per page + Performance/Deployment/Admin handoff.
