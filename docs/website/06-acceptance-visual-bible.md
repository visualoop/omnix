# DUKA WEBSITE — Plan 06: Acceptance, Visual Bible, Performance, Deployment, Admin Handoff

This is the closing document. It defines:
- What "done" means for each page (visual bible)
- Lighthouse + bundle-size budgets
- Deployment topology (Vercel + Neon + R2 + Cloudflare DNS)
- Admin handoff guide (the owner's runbook)
- Acceptance test scenarios that must pass before launch

Once implementation begins, **every Pull Request lands one section** of one prior plan. Reviewers check against the visual bible here.

---

## 1. VISUAL BIBLE — what good looks like, page by page

For each page below: the anchor reference, the must-haves, the must-NOT-haves, and sample copy.

### 1.1 `/` (Landing page)

**Anchor**: Linear's homepage + Vercel's product hero. Dark surface, generous whitespace, real product UI in the hero.

**Must have**:
- Sticky header that turns from transparent → `bg-surface/80 backdrop-blur-md` after 80px scroll.
- Hero: 88vh on desktop, eyebrow with NEW pill linked to changelog, H1 in Space Grotesk 700 with tight tracking, real POS screenshot below (NOT a 3D laptop mockup), two CTAs side-by-side (primary amber + secondary ghost).
- Stat row: 4 numbers, monospaced figures, 1px borders separating, no gradients.
- Module bento: Linear-style alternating card spans (1-2-1 or 2-1-2 grid), each card has Lucide icon + tagline + screenshot in lower right corner cropped at angle.
- Closing CTA: full-width dark band, single H2, one primary CTA, one ghost. Footer below.

**Must NOT have**:
- Any 🚀 ✨ ⚡ emoji
- "Boost your business 10x" / "Get started in 60 seconds" copy
- Floating chat-bubble support widget
- Auto-rotating carousel under 8s
- Stock photo of "businesspeople in suits"
- Tailwind default `bg-blue-500`, `from-purple-500 to-indigo-600`

**Sample copy** (placeholder; owner can edit live):
- Eyebrow: `NEW · v0.2.0 — Banking & Recurring Invoices →`
- H1: `Run your duka. Pay yourself.`
- Sub: `All-in-one ERP for Kenyan pharmacies, mini-marts, salons, and shops. Works offline. Costs less than your rent. No subscription forever.`
- CTA primary: `Download free trial (30 days)`
- CTA secondary: `See it in action →`

### 1.2 `/pricing`

**Anchor**: Stripe pricing page + Resend pricing simplicity.

**Must have**:
- 3 tier cards in a row (mobile: stacked). Middle "Business" card has 1px amber border + glow shadow + "Most popular" pill at top.
- Each card top: tier name (Inter 600), one-line description, big number (`KES 75,000` in Space Grotesk 500 + small "one-time" label).
- Bullet checklist with green checkmarks for included, muted dash for excluded.
- "Buy" button — primary on Business, ghost on others.
- Add-ons row below the 3 cards — 5 horizontal items in cards with light separator borders.
- Comparison table — sticky first column, scroll-x on mobile, alternating row backgrounds for readability.
- FAQ accordion at bottom.

**Must NOT have**:
- Annual/monthly toggle (we don't do recurring; keep simple)
- "Save 20%" badge (we don't discount per-period)
- Asterisks on hidden fees (there are none — keep page honest)

### 1.3 `/modules` and `/modules/dawa`, `/modules/retail`

**Anchor**: Vercel's solutions pages, Supabase's product detail pages.

**Must have**:
- Hero with module tagline + screenshot of THAT module's actual UI.
- "Compliance" callout — 1px-bordered card listing PPB, KEMSA, KRA, SHA, NHIF requirements with green ✓ icons.
- 6-card feature bento (alternating spans).
- Single workflow video/GIF embedded inline, looped, muted, no autoplay over 30s loops.
- Module-specific CTA bottom: `Download Duka with Dawa` → /downloads.

### 1.4 `/downloads`

**Anchor**: Resend's downloads page + GitHub release pages.

**Must have**:
- Latest release card spanning full width — version + channel + title + 2 download buttons (MSI + NSIS) showing filesize, then highlights bullet list.
- System requirements card on right.
- Older versions table — 10 rows, expandable.
- SHA-256 hash visible on hover/click for verification.
- For logged-in customers: license key visible above buttons; if license is lapsed, replace download buttons with `Pay to access latest version`.

### 1.5 `/changelog`

**Anchor**: Linear, Vercel changelogs.

**Must have**:
- Vertical timeline. Date pinned to left column on desktop. Right column = entry.
- Each entry: version pill + title + summary + highlights (with screenshots) + breaking changes red callout if any + "Download this version" button.
- Filter pills: All / Stable / Beta / Major releases.
- Anchor links per version (`#v0.2.0`).

### 1.6 Auth pages (`/signup`, `/login`)

**Anchor**: Vercel's sign-in, Resend's signup.

**Must have**:
- 2-column on desktop: form left, visual quote right.
- Single primary CTA ("Create account" or "Sign in" — never both on same screen).
- Inline error state: red border + small message below field, never modal alerts.
- Password strength meter (small bar below password field).
- "Terms acceptance" checkbox required.
- Auto-focus on first field.

**Must NOT have**:
- "Continue with Google/GitHub" SSO yet (deferred; owner adds later)
- CAPTCHA visible by default (Cloudflare Turnstile invisible, only fires on suspicious behaviour)

### 1.7 `/buy/[id]` (Custom Paystack flow)

**Anchor**: Stripe Checkout's custom embedded flow + IntaSend's M-Pesa pages.

**Must have**:
- 2-column: order summary left, payment form right.
- Tab switcher: Card / M-Pesa / Bank Transfer.
- M-Pesa: phone field, "Pay KES X" button, polling state with friendly message ("Confirm the prompt on your phone — we're waiting…"), 60s timeout with retry button.
- Card: card number with brand auto-detect icon, expiry + CVV in same row, name on card.
- Bank transfer: dedicated NUBAN displayed prominently with copy buttons + auto-poll status every 5s.
- Error states: clear, friendly, never expose Paystack technical codes ("Your card was declined" not "ERR_INSUFFICIENT_FUNDS_5101").

**Must NOT have**:
- The Paystack inline popup (we built our own UI)
- Saved card "Use Stripe" / "Use Paystack" branding (white-label)

### 1.8 `/dashboard/*` (Customer dashboard)

**Anchor**: Supabase dashboard + Linear app.

**Must have**:
- Top nav: brand wordmark + nav items + avatar dropdown.
- Left sidebar: icon + label, collapses to icon-only on tablet, drawer on mobile.
- Page header: H1 + breadcrumb + page actions (right).
- Content cards: 1px border, rounded-xl, no shadow.
- Empty states: small illustration + 1 sentence + 1 CTA.
- Loading states: skeleton cards, never spinners alone.

**Must NOT have**:
- Tabs more than 4 deep
- Pagination > 1 level (use load-more or infinite scroll)
- Modal-on-modal (anti-pattern)

### 1.9 Payload admin extensions (`/admin/*`)

**Anchor**: Payload's default UI + Supabase Studio.

**Must have**:
- Custom dashboard at `/admin` showing 4 KPI cards + recent errors + recent payments + active geo indicator.
- Custom view `/admin/views/installs-map` — full-screen Leaflet, KE-centered, marker clusters, click pin → side drawer with machine details.
- Custom view `/admin/views/telemetry-overview` — 4 Recharts: errors/day, crashes/version, sales-volume rollups (top 20), integration failures pie. Date range picker.
- Custom view `/admin/views/revenue` — total + this-month + this-year, breakdown by payment type, refund rate.
- Saved list views ("Trials ending in 7 days", "Errors last 24h", etc.) auto-loaded into Releases/Licenses/Machines list pages.

**Must NOT have**:
- Replace Payload's native list/edit screens — we extend, not override.

---

## 2. PERFORMANCE BUDGETS

### 2.1 Lighthouse scores (mobile, simulated 3G, mid-tier device)

Each public marketing page must hit:

| Metric | Target | Hard fail |
|---|---|---|
| Performance | ≥ 90 | < 80 |
| Accessibility | ≥ 95 | < 90 |
| Best Practices | ≥ 95 | < 90 |
| SEO | 100 | < 95 |
| LCP (Largest Contentful Paint) | < 2.0s | > 3.0s |
| FID / INP | < 100ms | > 300ms |
| CLS | < 0.05 | > 0.1 |

CI runs Lighthouse via `@lhci/cli` on every PR for `/`, `/pricing`, `/modules`, `/modules/dawa`, `/downloads`. PR fails if score drops below threshold.

### 2.2 Bundle-size budgets

| Surface | First-load JS | Hard fail |
|---|---|---|
| `/` (Landing) | ≤ 110 KB gz | > 150 KB |
| `/pricing` | ≤ 90 KB gz | > 120 KB |
| `/modules/[slug]` | ≤ 120 KB gz | > 160 KB |
| `/downloads` | ≤ 100 KB gz | > 140 KB |
| `/buy/[id]` | ≤ 180 KB gz | > 220 KB |
| `/dashboard/*` | ≤ 220 KB gz | > 280 KB |
| `/admin/*` (Payload) | not measured (vendor-controlled) | n/a |

Enforced via `next-bundle-analyzer` + `size-limit` config. CI fails on regression.

### 2.3 Image budgets

- Hero images: ≤ 200 KB AVIF, ≤ 350 KB WebP fallback
- Module screenshots: ≤ 120 KB AVIF
- OG images: 1200×630 PNG ≤ 250 KB

All served via Cloudflare R2 with Cloudflare's image-resize transformations (`/cdn-cgi/image/...`).

### 2.4 Other perf rules

- Fonts loaded via `next/font/google` with `display: swap`. Subsetted to Latin only initially.
- No `<iframe>` for video — use `<video>` with WebM + MP4 sources.
- No 3rd-party JS in critical path (analytics + Sentry are deferred via `next/script strategy="lazyOnload"`).
- Server components for everything that can be — keep client bundle minimal.

---

## 3. DEPLOYMENT TOPOLOGY

### 3.1 Hosting matrix

| Component | Where | Why |
|---|---|---|
| Next.js + Payload admin | Vercel (Pro plan eventually) | Edge runtime for /api/releases/latest, ISR for marketing pages, native Payload support |
| Postgres | Neon (free tier → scale up at 1k customers) | Serverless, zero-cold-start branches for staging |
| Object storage (installers, media, screenshots) | Cloudflare R2 | Egress-free, S3-compatible, cheap at scale |
| DNS + CDN | Cloudflare | Already controlling the zone for `sokoos.co.ke` |
| Email | Resend | Best DX, fits with React Email templates |
| Analytics | PostHog Cloud (EU region) | Privacy-friendly, no extra cookie banner |
| Errors | Sentry | Industry standard, integrates with Vercel |
| Payments | Paystack | Already chosen — KE-native, M-Pesa support |

### 3.2 Domain plan

- `sokoos.co.ke` → Vercel (Next.js + Payload admin at `/admin`) — current domain, kept
- `r2.sokoos.co.ke` → Cloudflare R2 bucket `duka-releases` (custom domain via Cloudflare proxy)
- `media.sokoos.co.ke` → Cloudflare R2 bucket `duka-media` (Payload upload destination)
- Future rebrand swap: change DNS, update `BRAND_DOMAIN` constant, redeploy. Single edit per service.

### 3.3 Environment matrix

```
production:
  branch: main
  vercel project: duka-website-production
  database: Neon project main branch
  r2: duka-releases (live)
  resend: prod API key
  payload admin URL: https://sokoos.co.ke/admin

staging:
  branch: staging
  vercel project: duka-website-staging
  database: Neon branch 'staging' (created via neonctl)
  r2: duka-releases-staging (separate bucket — never share with prod)
  resend: test API key (sends to delivered@resend.dev only)
  payload admin URL: https://staging.sokoos.co.ke/admin

preview (per PR):
  branch: <PR branch>
  vercel preview deployment
  database: ephemeral Neon branch named after PR
  r2: shared with staging
  resend: test API key
```

### 3.4 Required Vercel env vars

```
DATABASE_URL                 (Neon connection string, pooled)
DATABASE_URL_DIRECT          (Neon direct, for migrations)
PAYLOAD_SECRET               (cookie signing, 32+ char random)
PAYLOAD_SYSTEM_TOKEN         (for CI to POST releases)
NEXT_PUBLIC_SITE_URL         (e.g. https://sokoos.co.ke)
NEXT_PUBLIC_BRAND_NAME       (Duka — single-source-of-truth fallback)
RESEND_API_KEY
RESEND_FROM_EMAIL            (e.g. notifications@sokoos.co.ke)
PAYSTACK_SECRET_KEY
PAYSTACK_PUBLIC_KEY
PAYSTACK_WEBHOOK_SECRET
R2_PAYLOAD_ACCESS_KEY_ID     (read-only on duka-releases for signed URLs)
R2_PAYLOAD_SECRET_ACCESS_KEY
R2_MEDIA_ACCESS_KEY_ID       (read-write on duka-media)
R2_MEDIA_SECRET_ACCESS_KEY
R2_MEDIA_ENDPOINT
R2_MEDIA_BUCKET
SENTRY_DSN
SENTRY_AUTH_TOKEN            (source map upload only)
POSTHOG_KEY
POSTHOG_HOST                 (https://eu.i.posthog.com)
NEXT_PUBLIC_POSTHOG_KEY
NEXT_PUBLIC_POSTHOG_HOST
GEOLOCATION_API_KEY          (IPinfo or MaxMind for machine IP→city)
```

### 3.5 Database migration policy

(Reinforces AGENTS.md §9a — must obey.)

- All schema changes → `pnpm payload migrate:create <name>` → review the generated SQL → commit → `pnpm payload migrate` (additive only) on production.
- **Never** `payload migrate:fresh` on production. Period.
- For destructive changes: create a Neon staging branch, test there, ship a migration that's a sequence of additive steps (add new column → backfill → flip reads → drop old column in a later release).
- Seed scripts must be idempotent (find by slug → upsert).

### 3.6 Backups

- Neon Point-in-Time Restore (24h on free tier; upgrade to 7-day on Pro after first paid customer).
- R2 has versioning enabled on `duka-releases` (only the metadata, not individual files — installers themselves are immutable artifacts).
- Daily logical backup via `pg_dump` to a separate Cloudflare R2 bucket `duka-backups` (encrypted with `age`).

---

## 4. ADMIN HANDOFF (the owner's runbook)

This section is targeted at the owner directly. Once the website launches, this is what they need to know.

### 4.1 Logging in

- Owner: `https://sokoos.co.ke/admin` → email + password (you set these on first launch).
- Forgot password: `/admin/forgot` — sends reset to your email.
- 2FA: Settings → Account → Security → Enable 2FA. Use an authenticator app (Aegis on Android). **Strongly recommended before launch.**

### 4.2 Daily/weekly tasks

| Task | Where | When |
|---|---|---|
| Check overnight error count | `/admin` dashboard, "Recent telemetry errors" card | Daily, first thing |
| Review new sign-ups | `/admin/collections/customers?status=trial` | Daily |
| Triage support tickets | `/admin/collections/support-tickets?status=new` | Daily |
| Confirm last night's payments | `/admin/collections/payments?status=success` | Daily |
| Review trial→pay conversion | `/admin/views/revenue` | Weekly |
| Publish new release | `/admin/collections/releases?status=draft` | When CI fires |
| Check installs map for unusual spread | `/admin/views/installs-map` | Weekly |
| Update marketing copy if needed | `/admin/globals/landing-page` | As needed |
| Check email deliverability | Resend dashboard | Weekly |

### 4.3 Common operations

**Issuing a license manually** (e.g. customer paid via direct M-Pesa):
1. `/admin/collections/licenses → New`
2. Pick the customer (or create one first)
3. Choose tier and modules
4. Set `status='active'`, `paidAt=today`, `maintenanceUntil=today+1y`
5. Save → license key auto-generated → email auto-sent to customer

**Refunding a payment**:
1. `/admin/collections/payments → find the payment`
2. Click "Refund" custom action
3. Enter refund reason
4. Confirm — Paystack API call fires, customer receives refund within 24h
5. Linked License is auto-set to `status='cancelled'`

**Banning a license**:
1. `/admin/collections/licenses → find license`
2. Set `status='suspended'`
3. Add reason in `internalNotes`
4. Next time the desktop app phones home, it gets a 403 and locks itself

**Adding a new module page**:
1. `/admin/collections/modules → New`
2. Fill name, tagline, features array, screenshots, compliance bullets
3. Set `available='live'`
4. `/modules` page now shows it; `/modules/[your-slug]` is a real route

**Publishing a new release**:
1. CI auto-creates a draft Release after a tag push
2. Click "Publish" — fills `publishedAt` + `publishedBy` automatically
3. If maintained customers should be emailed: leave `notify_customers=true` (default)
4. Marketing site auto-shows new version on /downloads + /changelog

### 4.4 Emergency procedures

**Telemetry indicates a critical bug in a release**:
1. `/admin/collections/releases → find release → status='rolled_back'`
2. Fill `rolledBackReason`
3. Optional: send broadcast email — Communication → Compose → audience: "users on v0.2.0"
4. Inform support team to expect tickets

**Service is down**:
1. Check Vercel dashboard for deployment failures
2. Check Neon dashboard for database connectivity
3. Check Sentry for spike in errors
4. Activate maintenance mode: `/admin/globals/settings → flags.maintenanceMode=true` → site shows static maintenance page (you keep editing in admin)

**A customer's data is at risk**:
1. Their machine logs would show the issue
2. Pull their machine in `/admin/collections/machines`
3. Click "Request diagnostic" — flips a flag the desktop app sees on next sync
4. Diagnostic dump arrives in TelemetryEvents within an hour
5. Coordinate with customer via WhatsApp

### 4.5 Who can do what

(Roles are defined in Payload Users collection. You start with one `owner` user — yourself.)

| Action | owner | support |
|---|---|---|
| Read all customers / licenses / payments | ✓ | ✓ |
| Issue / suspend licenses | ✓ | ✗ |
| Refund payments | ✓ | ✗ |
| Reply to tickets | ✓ | ✓ |
| Edit marketing copy | ✓ | ✗ |
| Edit pricing | ✓ | ✗ |
| Publish a release | ✓ | ✗ |
| Roll back a release | ✓ | ✗ |
| Create staff users | ✓ | ✗ |

To add a support staff member: `/admin/collections/users → New → role='support'`. They can read everything for context but can't modify revenue or releases.

---

## 5. ACCEPTANCE TEST SCENARIOS

These are end-to-end flows that must pass before launch. Owner runs them on staging, then again on production after launch.

### 5.1 Trial signup → desktop install → license activation

1. Visit `/`, click "Start free trial"
2. Sign up: name, email, password, business, county
3. Receive verification email; click link
4. Land on `/dashboard?welcome=1`. Should see trial license auto-created with 30-day countdown
5. Click "Download" — installer downloads from R2
6. Install on Windows VM
7. Open Duka app — first-launch consent modal appears
8. Allow telemetry → splash to dashboard
9. Within 60s, in Payload admin, this machine should appear under `/admin/collections/machines`
10. License countdown should match between web dashboard and desktop

### 5.2 Trial → paid conversion via M-Pesa

1. Logged-in customer with active trial visits `/dashboard/billing`
2. Click "Buy license" → routed to `/buy/[id]`
3. Order summary shows tier + total in KES
4. Click M-Pesa tab, enter phone
5. Click "Pay KES 30,000"
6. STK push received on phone, enter PIN
7. Polling state shows "Confirming…" then transitions to success
8. Redirected to `/buy/success`
9. License key visible, receipt PDF downloadable
10. License status in admin: `active`, `paidAt=today`, `maintenanceUntil=today+1y`
11. Email to customer: "Your Duka license is ready"
12. Desktop app on next launch validates license and unlocks paid features

### 5.3 Major version upgrade flow

1. Customer has license for v1.x; v2.0 stable releases
2. Desktop app's updater check returns `must_upgrade=true, requires_paid_license=true`
3. App shows in-app modal: "v2.0 is available — buy major upgrade?"
4. Click "Upgrade" → opens browser to `/dashboard/licenses/[id]/upgrade`
5. Pay 50% of v2 list price (per Pricing global's `majorUpgradeDiscount`)
6. License's `majorVersionCap` bumps from 1 to 2
7. Next desktop updater poll succeeds — v2.0 downloads
8. Customer can also stay on v1.x indefinitely (still gets v1.x bug-fix updates)

### 5.4 Owner publishes a new release end-to-end

1. Owner tags `v0.2.1` in desktop repo and pushes
2. CircleCI runs validate → build-windows → publish-release → upload-to-r2 → notify-payload
3. Within 10 minutes: draft Release in Payload admin
4. Owner reviews highlights, edits if needed, clicks "Publish"
5. `/changelog` and `/downloads` immediately show v0.2.1
6. Email goes out to all paid customers with active maintenance and `majorVersionCap >= 0`
7. Existing desktop installs with auto-update on get the update prompt within 4 hours

### 5.5 Customer raises a support ticket with attached diagnostic

1. Customer in app: Settings → Help → "Send diagnostic" → ref ID returned
2. Customer copies ref ID, opens dashboard, raises ticket: subject + category=bug + paste ref
3. Owner receives email notification
4. Owner clicks ticket link, sees customer's last 100 telemetry events linked
5. Owner replies in thread; customer gets email + sees in dashboard
6. Owner resolves; customer rates 5 stars; status='closed'

### 5.6 Lapsed trial → soft lock → recovery

1. Trial license `trialEndsAt` passes
2. Daily cron flips `status='lapsed'`
3. Customer email: "Your trial ended; pay to continue using Duka"
4. Desktop app on next start gets `lockoutMode='soft'` from validate endpoint
5. POS becomes view-only; no new sales possible
6. Customer pays via dashboard
7. License flips to `active`
8. Desktop app on next sync unlocks; toast says "License activated — happy selling!"

### 5.7 Customer adds extra branch

1. `/dashboard/billing → Add extra branch (KES 15,000)`
2. Pay via Paystack
3. License's `maxBranches` bumps by 1
4. Customer's desktop app on next sync allows branch creation up to new limit

### 5.8 Privacy: opt out of telemetry

1. Customer toggles off in desktop Settings → Privacy
2. Last batch of events sent (if queue had any)
3. From that moment, no further events sent
4. Customer in admin sees the machine's `lastSeenAt` stop updating
5. Customer toggles back on → events resume from new heartbeat

All 8 scenarios must pass on staging. Then re-run on production with throwaway test data.

---

## 6. THINGS TO NEVER DO

These are the bright lines. Reviewing PRs? Reject the PR if any are violated.

- ❌ Deploy without running migrations in additive mode (no `migrate:fresh` ever on prod)
- ❌ Send any business data in telemetry events (see Plan 05 §2.4 denylist)
- ❌ Hardcode `"Duka"` outside `src/lib/brand.ts` — must use `BRAND_NAME` import
- ❌ Use Tailwind defaults `bg-blue-500`, `from-purple-500 to-indigo-600`, etc.
- ❌ Add 🚀 ✨ ⚡ emoji to UI strings or marketing copy
- ❌ Auto-rotate carousels under 8s
- ❌ Build an MVP — build the production-grade product per the plan
- ❌ Add Paystack popup widget — use custom UI per Plan 03 §5
- ❌ Build a second admin route for owner dashboards — extend Payload's `/admin`
- ❌ Use a separate Next.js app — Payload scaffolds the Next.js app; live in it
- ❌ Skip the consent modal on first desktop launch
- ❌ Send marketing emails to customers who unsubscribed
- ❌ Charge customers' cards without their explicit "buy" action (no auto-renewals at launch)

---

## 7. DEFINITION OF DONE

The website project is "done" (v1.0 launched) when:

1. `https://sokoos.co.ke` resolves to the new Next.js + Payload site, dark theme, content from CMS.
2. `/admin` is accessible to the owner with 2FA enabled.
3. All 14 collections + 4 globals from Plan 02 exist with seed data.
4. All marketing pages from Plan 03 § 3 render with placeholder copy ready for swap.
5. Customer dashboard from Plan 03 § 6 works end-to-end (signup → trial → pay → manage).
6. Payload admin extensions from Plan 03 § 7 (custom dashboard + installs map + telemetry overview + revenue) are live.
7. CI pipeline from Plan 04 has been dry-run with `v0.0.0-test.1` and the artifacts appeared in R2 + a draft Release was created in Payload.
8. Tauri desktop app config switched to `productName="Duka"`, updater pointed at Payload endpoint, and a fresh Windows install activates against the website.
9. Telemetry SDK from Plan 05 ships in the next desktop release (v0.3.0 or later) with Phases A–G complete (manual diagnostic + owner-requested dump can be Phase 2).
10. Lighthouse scores hit the targets in Plan 06 § 2.1 on `/`, `/pricing`, `/modules/dawa`, `/downloads`.
11. All 8 acceptance scenarios in Plan 06 § 5 pass on staging; then 4 of them re-tested on production with throwaway data.
12. Day-1 content freeze checklist (Plan 03 § 12) populated by the owner.
13. Privacy policy and Terms reviewed.
14. Owner has done a paid transaction end-to-end with their own KES 100 to verify Paystack live mode works.

When 14/14 ticked, **the website launches**. Old GitHub-Releases-only download flow gets a 30-day deprecation banner ("This download method will retire on 2026-MM-DD; use sokoos.co.ke instead") then redirects.

---

## 8. PLAN SUITE COMPLETE

This was the final plan. Six documents now define the website + ops + integration:

1. `01-mission-stack.md` — mission, stack, brand rules, UI direction
2. `02-collections-data-model.md` — every collection, every field
3. `03-pages-and-dashboards.md` — every page, every section, every form
4. `04-cicd-release-pipeline.md` — CI from tag-push to live release
5. `05-telemetry-sdk.md` — Tauri Rust telemetry, opt-out, privacy
6. `06-acceptance-visual-bible.md` — this doc; closes out

**Total**: 6 plans, ~3500 lines of specification. Implementation can now begin per Phase 10 in the master ROADMAP.

The ROADMAP entry for Phase 9 (Website) flips from "deferred" to "planned" with these documents as its scope.
