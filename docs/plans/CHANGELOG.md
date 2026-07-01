# Local Changelog (since v0.1.6 last build)

This tracks work done LOCALLY without GitHub pushes. We only push when the user explicitly says so.

## Release v0.20.0 — CMS covers 4 homepage sections

Extends the /admin/settings CMS from v0.19.0 to cover three more homepage sections. All follow the same pattern: setting keys → component `content?` prop → shipped fallback constants render when unset.

### One-price section (3 keys)
- `landing.one_price.eyebrow` — small caps label above the price (default: "Pricing")
- `landing.one_price.commitment_lead` — muted italic lead (default: "Once.")
- `landing.one_price.commitment_accent` — stronger italic phrase after (default: "For the whole product.")

### Founder note (4 keys)
- `landing.founder.eyebrow` — default "A note from the studio"
- `landing.founder.body` — multi-paragraph body (blank-line separated), rendered as an 8-row textarea in the admin editor
- `landing.founder.signature` — default "— Justin"
- `landing.founder.tagline` — default "Founder · Nairobi"

### Closing CTA (4 keys)
- `landing.closing.headline` — the italic display line (default: "Run the whole business")
- `landing.closing.headline_accent` — the coloured word (default: "properly.")
- `landing.closing.cta_label` — the button (default: "Start free trial")
- `landing.closing.whatsapp_prompt` — the WhatsApp link text (default: "or talk to us on WhatsApp")

### Admin experience
- 3 new categories in `/admin/settings`: "Homepage · one-price", "Homepage · founder note", "Homepage · closing CTA" (in addition to "Homepage · hero" from v0.19.0)
- Body field auto-renders as a textarea; single-line fields stay as inputs.
- All fields optional. Unset → renders the shipped default. So the CMS is safe to leave empty for years.

### Autonomy win
After v0.20.0, four of the ten landing sections (hero, one-price, founder note, closing CTA) are fully editable in-admin. Everything money- or brand-touching now writes an `audit_log` row when changed (setting writes go through `setSetting` which logs the actor).

Version bumped 0.19.0 → **0.20.0** across `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `Cargo.lock`.

Verification: desktop tsc clean, vitest 440/440, website tsc + next build clean.

## Release v0.19.0 — Homepage hero CMS

### Edit the homepage hero without a deploy
Admins can now edit five fields of the homepage hero from `/admin/settings` → **Homepage hero** category:
- `landing.hero.eyebrow` — the pill above the headline (empty → uses "One platform · offline-first · pay once, own forever" default; also gets overridden by the latest-release banner when present)
- `landing.hero.headline` — main headline (empty → shipped default)
- `landing.hero.subheadline` — paragraph under the headline (empty → per-locale default). Renders as a multi-line textarea in the editor.
- `landing.hero.cta_label` — CTA button label (empty → "Start free trial")
- `landing.hero.cta_href` — CTA link (empty → "/signup")

Values persist in `platform_settings` (unencrypted — not sensitive) and read via `getSetting()` with a 5-minute cache. If the setting is unset, the built-in fallback constants in `HeroSection` render — so an empty CMS still ships polished defaults.

### Deferred to v0.20.0+
- Reseller channel with volume pricing
- Affiliate program with Paystack Transfers + fraud guard
- CMS for the rest of the landing sections (unified platform, why-switch, FAQ, closing CTA) — will land as `landing.<section>.*` keys in the same admin surface.
- Media library rework

Version bumped 0.18.0 → **0.19.0** across `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `Cargo.lock`.

Verification: desktop tsc clean, vitest 440/440, audit 0 errors, website tsc clean.

## Release v0.18.0 — Admin-create-accounts + manual-payment recording

### Admin creates customers without email
- New `POST /api/admin/customers` — admin creates a new customer with just org name + optional email/phone/country. When no email is provided, we synthesize `admin+<hex>@omnix-customer.local` so Better Auth's NOT NULL email constraint is satisfied; the customer can replace the placeholder from `/dashboard/profile`. Generates a 10-char alphanumeric password (no ambiguous chars — easy to dictate over phone).
- Optional trial variant field — admin can issue a 30-day trial in the same step (Dawa / Retail / Hospitality / Hardware). Uses the same shape as `/api/dashboard/trial` so the licence flows through the existing activate + validate + billing pipes.
- New `/admin/customers/new` page — form + on-success view that shows the login credentials with copy buttons for the admin to pass over WhatsApp/phone.
- Discoverable via a "+ New customer" button on `/admin/users`.
- Every admin-created account writes an `audit_log` row (`customer.admin_create`) with the actor id + whether a real email was captured.

### Admin records manual M-Pesa/cash payments
- New `POST /api/admin/licenses/[id]/mark-paid` — admin captures the M-Pesa transaction code (or notes cash) against a licence. Creates a `payments` row with `paystackReference = manual:<ref>:<id>`, `status = success`, `metadata.source = admin_manual` so downstream reports treat it identically to Paystack payments.
- Auto-updates licence: trial + `license_fee` → active + paid, with a 12-month maintenance window; renewal/upgrade extends maintenance by 12 months from current expiry (or now, whichever is later).
- Writes an audit_log row (`payment.manual_record`) with the M-Pesa code + notes for reconciliation.

### Deferred to future releases
- Reseller channel with volume pricing → v0.19.0
- Affiliate program with Paystack Transfers → v0.20.0
- Small in-admin CMS for homepage/module/FAQ content → v0.21.0

Version bumped 0.17.0 → **0.18.0** across `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `Cargo.lock`.

Verification: desktop tsc clean, vitest 440/440 (7 live-API skipped), website tsc clean.

## Release v0.17.0 — Autonomy: expiry write-off flow · pagination sweep · AI intra-provider fallback · Groq refresh

### Expired-batch write-off
- New `writeOffBatch({ batchId, reason, notes, userId })` in `src/services/wastage.ts` — records a negative `stock_movements` row of type='damage' with a reason-tagged note ("Expired:", "Damaged:", "Return-to-supplier:", "Other:"), zeroes the batch quantity, is idempotent on repeat calls.
- Expiry Alerts page (`/pharmacy/expiry`) gains a per-row "Write off" action + confirmation dialog with reason picker + notes field. Zeroing the batch removes it from FEFO picks + the expiry tracker.
- New Wastage report page at `/reports/wastage` — total cost, units, per-reason breakdown, full write-off ledger with 500-row cap.
- **Dispense-time expiry warning**: `preparePrescriptionForPosCheckout` now returns `expiringSoon[]` (products with any active batch ≤30 days from expiry). Pharmacy page toasts an amber warning when a prescription is loaded into POS — pharmacist can still dispense but is prompted to pick the oldest batch (FEFO).

### AI reliability
- **Groq fallback chain refreshed**: dropped decommissioned `mixtral-8x7b-32768` (the "Mistral no longer working" complaint). New chain: `llama-3.3-70b-versatile → openai/gpt-oss-120b → openai/gpt-oss-20b → llama-3.1-8b-instant → groq/compound`. Same for the streaming router.
- **Groq Compound + GPT-OSS-120B** added to the router and to the context-window registry (both 128k).
- **Intra-provider fallback**: extended `CallStatus` with `model_gone` + `quota_exceeded`. `callProvider` now parses the response body for `model_decommissioned` / `model_not_found` / `deprecated` on 400/404 and throws `model_gone`, so the invoke loop walks to the next model on the same provider instead of blackballing the provider. `quota|daily limit|monthly limit` in a 429 body triggers `quota_exceeded` + 24h cooldown on the provider instead of the usual 60-sec.
- Two new unit tests cover both paths (model_gone → next-Groq-model, quota_exceeded → rejects).

### Pagination sweep (defensive caps everywhere)
Added `LIMIT 500` (or 200 where appropriate) to every remaining unbounded multi-row query so no list can lock the UI on a growing dataset:
- Retail: `listShrinkage`, `listLaybys`.
- Invoicing: `listCreditNotes`.
- Insurance: `listInsuranceBatches`.
- Banking: `listStatementImports` (200).
- eTIMS: pending queue (500).
- HR: `listLeaveRequests`, `listAttendance`.

Combined with the earlier caps (v0.16.3 inventory/invoices/quotations/expiry/doctors/payroll/tips/patients), every list in the app now has an upper bound.

Version bumped 0.16.4 → **0.17.0** across `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `Cargo.lock`.

Verification: desktop tsc clean, vitest 440/440 (7 live-API skipped), audit 0 errors / 0 warnings, website tsc clean.

## Release v0.16.4 — Autonomy pack: 8 bug fixes + polish for owner-not-always-watching operation

### POS + inventory
- **Scanner auto-add**: `pos-sale.tsx` — after the barcode search resolves, if a single product has an exact barcode match on the scan payload, auto-add via the variant picker and clear the search input. Regular tile-tap flow is unchanged; only scans skip the extra tap.
- **ESC in POS search**: previously the global keydown skipped INPUT/TEXTAREA to avoid stealing typing, but that also blocked ESC-to-clear inside the search input. Added a local ESC handler on the search input itself.
- **Cart row density**: `CartLine` padding trimmed from `py-3.5` to `py-2`, avatar from `size-9` to `size-7`, one-line title, tighter action buttons. 8+ items now visible on a standard laptop vs 3 before.
- **Receive-stock dialog**: rebuilt as `flex flex-col` with sticky header, `flex-1` scrollable body, sticky footer, widened from `max-w-3xl` to `max-w-4xl`. The Save button no longer clips on laptop screens.

### Multi-branch
- **Branch detail "no such column: branch_id"**: `branch-detail.tsx` was querying `FROM users WHERE branch_id` but `users` doesn't have that column — the linkage lives on `user_branches`. Fixed the JOIN so opening a branch loads its stats.

### Website
- **Global max-width tightened**: container tokens `--w-default` 1180→1120, `--w-wide` 1320→1200, `--w-bleed` 1480→1280. Desktop padding-inline 2.5→3rem. Homepage + variant pages now feel less bleedy on 15" laptops.

### Settings shell
- **Print settings panel** (`/settings/printing`): auto-print toggles per doc type (receipt / kitchen ticket / delivery note / dispense label), prompt-before-print, cash-drawer kick on cash sale, preferred printer names per stream. Stored under `settings.printing.*`, read by every print surface via `getPrintSettings()`.
- **Scanner test panel** (`/settings/scanner`): focus an input, scan a barcode, panel echoes the payload + times each keystroke to distinguish scanner (fast burst, <20ms/char) from typing. Auto-detects the terminator character (Enter / Tab). Persists auto-focus + terminator preferences.

Registered both new settings pages in App.tsx routes + settings-registry so they show up in the Operations group of the settings sidebar.

Verification: desktop tsc clean, vitest 438/438 (7 live-API skipped), audit 0 errors / 0 warnings, website tsc clean.

## Release v0.16.3 — Pro checkout short-circuit · M-Pesa STK label · long-list defensive caps

### Pro checkout short-circuit (fixes user-visible Pro upsell that v0.16.2 missed)
- Clicking a Pro trial licence on `/dashboard` was still routing to `/buy/[licenseId]` which rendered the full "Upgrade · Omnix Pro · all four trades · KES 150,000 · Pay KES 150,000" checkout. The page now detects Pro variants and replaces the checkout body with a "Pro isn't available for new purchases right now" notice, four trade-pick buttons (Dawa / Retail / Hospitality / Hardware), and a contact link for genuine multi-trade businesses. Existing PAID Pro licensees (status=active) flow normally — they already own it.
- `/buy?variant=pro` entry: fallback default changed from `'pro'` to `'dawa'`. When a caller asks for Pro and the user doesn't already have a Pro licence row, the page redirects to `/buy?variant=dawa` rather than issuing a fresh Pro trial that would end up at the dead-end checkout.

### M-Pesa label
- POS payment-modal renamed `method_name: "M-Pesa (Direct)"` → `"M-Pesa STK"` for Daraja STK Push payments. "Direct" was Safaricom's old marketing name for a now-deprecated product — confusing on receipts and reports. The `method_id` (`mpesa-daraja`) stays the same, so existing rows keep their canonical id.

### Long-list defensive caps (fixes "app hangs on big tables")
Inventory, expiry, invoices, quotations, doctors, patients, payroll, tip distributions were loading every row in one query. On a multi-thousand-SKU catalogue or a multi-year tip ledger that locks the UI thread while React renders. Hard caps added:
- `src/services/inventory.ts` — `getProducts` becomes a thin wrapper over new `getProductsPage(search, limit=500)` which returns `{ rows, total, hasMore }`. Inventory page renders a "Showing first 500 of N — refine your search" banner when capped.
- `src/services/invoicing.ts` — `listInvoices` and `listQuotations` LIMIT 500.
- `src/services/pharmacy.ts` — `getExpiringItems` LIMIT 500.
- `src/services/doctors.ts` — `listDoctors` LIMIT 500.
- `src/services/payroll.ts` — payroll-runs list LIMIT 200.
- `src/services/tips.ts` — `listTipDistributions` LIMIT 500.
- `src/pages/patients.tsx` — pharmacy patients query LIMIT 500.

### How expiry is set up (user question)
- **Set per batch**: Inventory → click a product → product-detail → Batches section → add batch with `expiry_date`. Also wired into the global "Receive stock" dialog accessible from Inventory or a PO.
- **Reported in pharmacy**: Pharmacy → Expiry tracker reads from all batches with non-null expiry within the configured window (`getExpiringItems`). Same underlying table, different read view.

## Release v0.16.2 — Drop Pro from public surface + theme every chart for light/dark



### CI
- Removed `pro` from `.github/workflows/ci.yml` matrix so each release builds 4 trade installers (dawa/retail/hospitality/hardware) instead of 5. Cuts ~5 min of Windows CI per release. The legacy Pro variant is intentionally not built right now — existing licensees keep using the v0.16.0 installer; re-add `pro` to the matrix when it goes back on sale.
- Cancelled the in-flight v0.16.1 release run via `gh run cancel` to stop the redundant Pro build mid-flight.

### Dashboard + admin Pro hiding (preserved for existing Pro licensees)
- `start-trial-wizard.tsx` — removed Pro from the variant picker; "Pick this if unsure" recommended flag moved to Dawa; default fallback variant `pro` → `dawa`.
- `dashboard/page.tsx` — `?variant=` URL fallback `pro` → `dawa`; trial-banner Pro upsell copy rewritten so existing Pro-trial owners still see relevant info without selling Pro to others.
- `dashboard/downloads/page.tsx` — `visibleVariants` for non-Pro owners reduced from `[pro, dawa, retail, hospitality, hardware]` to `[dawa, retail, hospitality, hardware]`. Existing Pro licensees still see their Pro licence in the licences list and still get the Pro-only download grid via `ownedActive.has('pro')`.
- All comments mark the change as reversible (`Re-add Pro to this array when …`).

### Licensing — fix "Retail isn't on your licence" gate firing for users who DO own retail
- **Root cause**: licence rows created via older paths (admin promotions, hand-imported keys, pre-modules-column trial inserts) had `licenses.modules = []` even when `variant = 'retail'`. The `/api/licensing/activate` and `/validate` endpoints returned that empty array verbatim; the desktop fell back to `["core"]`, and the route gate (`RequireRole` + `getFeatureModule`) shut every trade route — including the "View all" jump from Retail Brand Performance to `/retail/brands`.
- **Fix**: new `website/src/lib/license-modules.ts` exports `effectiveModules(lic)` — returns the stored array when populated, derives from `variant` otherwise (`pro` → all four trades, every trade unlocks itself). Wired into `/api/licensing/activate`, `/api/licensing/validate`, `/api/licensing/sync` so the desktop always receives a non-empty module list.
- **Self-healing backfill**: on the first activation hit for any licence where `modules` is empty, the activate route writes the derived array back to the row so subsequent silent revalidations short-circuit without the fallback.

### Chart theming (fixes "bars/lines invisible in dark mode")
- **Root cause**: `src/components/charts/index.tsx` was wrapping shadcn variables as `hsl(var(--primary))`, but the app stores all colours as `oklch(...)`. The resulting `hsl(oklch(...))` is invalid CSS, so recharts SVG silently fell back to `currentColor` — black-on-black on dark mode.
- **Fix layer 1** — `src/index.css`: added a full chart token set to both `:root` and `.dark`. Categorical palette `--chart-1` … `--chart-8` (blue / green / amber / red / violet / magenta / cyan / olive), semantic `--chart-positive` / `--chart-warning` / `--chart-destructive`, structural `--chart-axis` / `--chart-grid`, and `--chart-tooltip-bg` / `-fg` / `-border`. Dark-mode variants use lighter chroma so series read on the espresso background.
- **Fix layer 2** — rewrote `src/components/charts/index.tsx` to consume `var(--chart-…)` directly. `LineChart`, `AreaChart`, `BarChart`, `PieChart`, `ComparisonBar` — axis ticks, grid lines, tooltip surface, line dots, area gradient stops, pie cell strokes, legend colours all flip with the theme now. No `hsl()` wrapping, no literal hex anywhere.
- Audited every other page for inline SVG charts — none exist (the `pnl.tsx` comment mentions sparklines but the code has no SVG). Every chart in the app routes through `@/components/charts`, so the fix is universal.

Version bumped 0.16.1 → **0.16.2** across `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `Cargo.lock`.

## Release v0.16.1 — Website repositioning + AI reliability hardening + POS payment-CTA fix

What ships in this build:

### Website repositioning
- **Light-mode default with theme toggle**: installed `next-themes`, restructured `globals.css` so the cream-on-espresso (light) palette is the @theme default and the dark espresso palette lives in `.dark`. New `<ThemeProvider>` wraps the root layout; new sun/moon `<ThemeToggle>` lives in the site-header (SSR-safe, focus-ring, 44px touch target).
- **Killed "Omnix Pro" publicly**: `/pro` now redirects to `/modules`; Pro removed from the Products dropdown, public downloads grid, pricing table, FAQ, and sitemap. The internal Pro variant stays intact for existing licensees (dashboard, checkout, paystack, releases, db).
- **Dropped "ERP" from every visible surface**: rewrote BRAND_TAGLINE, site + platform settings defaults, OG default title, all 12 per-country LOCALE_COPY titles + descriptions, the GLOBAL/NIGERIA/GHANA/SOUTH_AFRICA/INDIA keyword sets, modules page title, AI page hero, jsonld Organization schema, modules-seed (Core ERP → Core), blog-seed, docs-seed and variant-landing fallback. Lead with "POS + business software", "pharmacy POS", "restaurant POS", "bar POS", "mini-mart POS", "hardware store software".
- **4 industry landing pages rebuilt**: variant-landing now ships a 5-step "How a day runs" workflow + a 6-question trade-specific FAQ (rendered as definition list + emitted as `FAQPage` JSON-LD) for Dawa, Retail, Hospitality, Hardware. New `/pharmacy` route aliases Dawa with its own Kenya-search-intent metadata.
- **Homepage outcome pills**: 4-trade pill row (`Pharmacy POS`, `Retail & duka POS`, `Restaurant & bar POS`, `Hardware store POS`) under the hero CTA, routes directly to each industry landing.
- **SEO pass**: rewrote `getVariantMetadata()` to emit a full Next.js `Metadata` per variant — title, description, canonical, keywords (Kenya search intent per trade), `/api/og?title=…` OG image, Twitter card. `SoftwareApplication` + `FAQPage` JSON-LD per variant.

### AI reliability hardening
- **Context-window registry** (`src/services/ai/context-windows.ts`): per-provider/model token budgets with family-prefix matching + `getPromptBudget` helper.
- **Auto-compression** (`src/services/ai/compression.ts`): token estimator + deterministic head/tail summariser, threshold 75% of budget, keeps last 4 user+assistant turns + all system messages verbatim. Wired into both `invoke` (unary) and `streamInvoke` (streaming) per-candidate so each fallback model gets compressed to its own budget.
- **Tool-result truncation** (`src/services/ai/tool-truncate.ts`): wraps each tool's `execute` so the model sees a head+tail-clipped preview while a `toolCallId`-keyed map keeps the full result for the UI (2000-char default).
- **Retry-After + stream timeout** (`src/services/ai/retry.ts`): RFC 7231 `Retry-After` parser, `sleep`, `createIdleWatchdog`. `AiError.retryAfterMs` carries the wait. `invoke()` retries the same route up to 2× when retryAfterMs ≤ 10s before falling through. `streamInvoke` runs a 30-second idle watchdog via `streamText.abortSignal`; if no token arrives, abort + try the next provider.
- **62 new unit tests** across 4 spec files; all 165/165 AI tests green.

### POS payment-modal CTA fix
- **Fixed the silent split-payment footgun**: when the cashier selected M-Pesa with a staged amount, the sticky footer used to read "Complete sale" purely on the math and ship the sale with zero STK ever firing. The footer CTA now routes through the selected method's real async action — `Send M-Pesa STK push · {amount}` (green for Daraja, blue for Paystack), `Open Paystack to charge card`, or a disabled `Enter M-Pesa code above to confirm` for manual paybill/till until the reference field is filled. Only methods that don't need an upstream action fall through to `Add payment` / `Complete sale`. Over-tendering cannot bypass the STK push.

### Other
- **Removed bottom-right floating AI widget**: dropped `<AiAssistantPanel />` mount from `AppShell` and deleted the dead `AiHelpFloating.tsx`. AI is reached via the sidebar "Omnix AI" entry, the command palette, and the dedicated `/ai` workspace.

Version bumped 0.16.0 → **0.16.1** across `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `Cargo.lock`. Desktop tsc clean, 438 tests green, vite build green. Website tsc clean, next build green (51 routes).

## Local fix — Hospitality orders route through POS checkout

- Recovered the recent Kiro CLI session from `~/.kiro/sessions/cli`; the latest Omnix session stopped on website release-sync/backfill repair after prod DB schema repair, with release backfill/latest verification still pending.
- Hospitality Orders now hand off payable orders to `/pos` instead of completing payment inside the Hospitality page.
- POS cart state now records checkout source metadata (`hospitality_order`) plus sale-level service charge, so the cashier sees the source order and POS remains the checkout center.
- POS payment completion now marks the linked hospitality order paid, stores `sale_id`, frees the table, marks items served, and records service-charge allocation.
- Added migration `038_sales_service_charge.sql` and wired it into Tauri migrations so service charge contributes to sale totals without becoming product revenue.

## Release v0.2.10 — UI consistency

What ships in this build:

- **Sidebar:** active module's items (Pharmacy / Retail / Hardware / Hospitality) collapse into a **single expandable group** like Settings — only Core stays top-level, no more long scroll. Auto-expands when on a module sub-route.
- **Native popups gone:** every `window.prompt`/`window.confirm` replaced with the shadcn dialog (the "Create new role", create group, settle batch, and 10 hospitality dialogs that were still native).
- **Module-themed dashboards & POS:** hospitality (red `bg-rose-700`), hardware (orange `bg-orange-700`); previously fell to a default that rendered as an unthemed white header.
- **Branded primary actions:** every "create / pay / new" button in hospitality (rose) and hardware (orange) now matches the module accent. Workflow-transition buttons (Send to kitchen, Bump, Check-in/out, Dispatch) stay neutral so brand colour flags only the primary moments.
- **Reports & P&L cleanup:** unique icon per report (P&L → Scale, Cash Register → Wallet, Stock Movements → ArrowLeftRight, eTIMS → Send); P&L title/toolbar/dates/statement now share one left edge; emerald-500/-400/rose-400 mix unified to one palette across P&L + Daily Operations; Daily Ops got a proper page header.
- **Vercel deploy:** project's `rootDirectory` set to `website` (was unset → repo root, hence the `next not detected` failure); deploy is green.
- **Build hygiene:** dual lockfiles removed, `packageManager: pnpm@9.15.4` pinned, malformed `pnpm-workspace.yaml` files corrected, CI workflow fixed (pnpm version derived from `packageManager` instead of conflicting with it).

## Release v0.2.9 (pushed + tagged)
- Pushed all platform-completion + hardening work to `origin/main` (account `visualoop`) and tagged `v0.2.9` to trigger the CI build/sign/release workflow (Windows MSI/NSIS + `latest.json` updater manifest).
- Version bumped 0.2.8 → **0.2.9** across `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `Cargo.lock` (the pre-existing `v0.2.8` GitHub release was already published with drifted 0.2.6 assets, so a clean new version was required rather than retagging).

## Build/deploy hygiene (Vercel + CI determinism)
- **Removed dual lockfiles**: deleted tracked `package-lock.json` at root and in `website/` — the toolchain (CI `pnpm install --frozen-lockfile`, linked Vercel project) standardised on **pnpm**, so the stale npm lockfiles were a non-deterministic-install hazard ("works locally, fails on Vercel"). Only `pnpm-lock.yaml` (v9.0) remains.
- Pinned `packageManager: pnpm@9.15.4` in both `package.json` files so Vercel (corepack) and CI use the same pnpm major as the lockfile.
- **Fixed Vercel-breaking `pnpm-workspace.yaml`**: `website/pnpm-workspace.yaml` was missing the required `packages` field (pnpm 9 errors `packages field missing or empty`) — added `packages: []`. Root workspace had a malformed `allowBuilds:` placeholder block ("set this to true or false") — replaced with a valid `onlyBuiltDependencies` list.
- Verified `pnpm install --frozen-lockfile` + `pnpm build` pass for both root and `website/` (sharp builds for Vercel image optimisation). Vercel project link confirmed: `.vercel/project.json` → project `website`, root directory `website/`. Build artifacts (`.next`, `.vercel`, `*.tsbuildinfo`) correctly gitignored.

## Post-completion hardening (Salon removal + first-run + e2e)

### Salon removed completely (desktop + website)
- **Desktop**: `ModuleId` union trimmed to `dawa | retail | hardware | hospitality | core` (dropped `salon`, `restaurant`, `electronics` — restaurant is covered by Hospitality, electronics was never built). `MODULE_DEFINITIONS`, `modules.tsx` cards, and `module-logos.tsx` (removed `SalonLogo` + cases) updated. Hardware + Hospitality cards now marked **installed** with real feature lists.
- **Website**: `modules-seed.ts` now sells exactly the four live trades (Hardware + Hospitality promoted to `live` with real features, replacing planned salon/restaurant). `Modules` collection enum, `modules-rows-section`, `/modules` page, site-footer trade links, business-type selects (Customers/profile-form/signup-form, kept `duka`), and prose all salon-free. Replaced the stale `salon-module-roadmap` blog post with `hardware-hospitality-shipped`. `payload generate:types` re-run.
- Verified: `grep '\bsalon\b'` across all `*.ts/*.tsx/*.rs` = **zero** (only historical `docs/*.md` + one generic "two salons" payroll example remain).

### Desktop first-run screen [SKILLS GATE]
- Ran UI/UX Pro Max → Flat Design / zero-elevation. Applied on Omnix theme tokens (override generic palette).
- `license-activation.tsx`: removed left-hero gradient, trial-card gradient + blur orb; `rounded-xl→rounded-lg`, icon/select/textarea `→rounded-md`; `cursor-pointer` on all controls; emerald/amber `-700→-600 dark:-400`.
- Correctness fixes: stale **"KES 30,000 + KES 12,000/year"** subscription pricing → **"KES 100,000 one-time · pay once, use forever · no subscription"**; buy link `/buy→/pricing`; version badge `v0.1.2`→"Pay once. Use forever."; `SOKO-`→`OMNIX-` placeholder; pharmacy-only feature list → module-agnostic. `brand.ts` company domain/website/support → `omnix.co.ke`.

### End-to-end correctness pass
- Dashboard welcome copy now lists all four trades. All client dashboard surfaces present (overview, downloads, licenses, billing, profile, support, machines, payments).
- Verified green: desktop `tsc` + 17 Rust tests + `vite build`; website `tsc` + `next build` (51 routes).
- **Open for release (Task 5)**: website still advertises published **v0.2.0** binary (downloads/changelog/KPI) — correct until a real signed **0.2.8** build is published. Desktop keyless trial is single-module (anti-farming) while the website account trial unlocks all modules — two intentional entry points.

## In progress — Omnix Platform Completion (28-task plan)

### Task 1 — License payload entitlements (v2)
- `LicensePayload` (Rust `src-tauri/src/license/mod.rs`) gains `modules: Vec<String>` + `max_devices: u32` with `#[serde(default)]` for v1 compatibility; added `effective_modules()` (v1 `feat`→module map, default `dawa`) and `effective_max_devices()` (0→1).
- Key prefix strip now accepts `OMNIX-` and legacy `SOKO-`.
- `scripts/generate-license.mjs` emits `ver:2` keys with `--modules` and `--max-devices`, `OMNIX-` prefix.
- TS mirror in `src/services/license.ts` + `licensePayloadModules()` helper.
- 9 Rust license tests pass (v2 entitlements, v1→module compat, tampered-modules rejection).

### Task 2 — Local entitlement store + selectors
- Migration `027_license_entitlements.sql`: `license` table gains `modules_json`, `max_devices`, `activation_token`, `server_validated`, `last_server_check_at` (registered in `lib.rs`).
- `activateLicense()` persists modules + max_devices; `LicenseStatus` now carries `modules`, `max_devices`, `server_validated`.
- New async selectors `licensedModules()` and `isModuleLicensed(moduleId)` for app-wide gating.
- Trial branch no longer hard-unlocks pharmacy (placeholder until Task 7).
- `tsc` clean; `cargo check` warning-free (host target).

### Task 3 — Website licensing data model
- `website/src/collections/Licenses.ts`: modules options aligned to canonical set (`core/dawa/retail/hardware/hospitality`, dropped salon/restaurant-as-planned); fixed `OMNIX-` key doc string; added self-service rebind cooldown fields (`rebindLimitPerWindow` default 2, `rebindWindowDays` default 30, `rebindCountInWindow`, `rebindWindowStartedAt`).
- New `website/src/collections/Activations.ts`: append-only audit log (activate/validate/rebind/deactivate × outcome), system-token write, owner/support read, registered in `payload.config.ts`.
- Machines collection already covers fingerprint/token/seat tracking. Website `tsc` clean.

### Task 4 — Activation endpoint with seat enforcement + entitlements
- Rewrote `website/src/endpoints/licenses-activate.ts` (`POST /api/licenses/activate`): validates licence, rejects suspended/cancelled, idempotent re-activation (rotates token), enforces seat cap via active machine count vs `maxMachines`, registers machine, returns `{ ok, authToken, action, entitlements }` where `entitlements` = `entitlementsOf(license)` (modules, maxDevices, maxBranches, maintenanceUntil, trialEndsAt, majorVersionCap, status).
- Added `logActivation()` + `clientIp()` helpers to `_auth.ts`; every activate outcome (success/rejected_invalid/rejected_revoked/rejected_seats) writes an `Activations` row.
- Regenerated `payload-types.ts` so `activations` collection is typed. Website `tsc` clean.

### Task 5 — Desktop online activation + offline fallback
- `src/services/license.ts`: added `@tauri-apps/plugin-http` fetch + `ACTIVATION_API_BASE` (`VITE_OMNIX_API` override, default `https://omnix.co.ke`). `activateLicense()` now: verifies signature locally → `activateOnline()` POSTs to `/api/licenses/activate` → on server reject (409 seat cap / revoked) hard-fails without activating → on success stores `activation_token` + `server_validated=1` + server entitlements → on network failure stores signed-key-only with `server_validated=0` and returns `{ ok, pending:true }`.
- Added `revalidateLicense()` (foundation for Task 6): POSTs `/api/licenses/validate`, refreshes modules/seats/maintenance, clears pending flag, strips modules if server reports suspended/cancelled; no-op when offline.
- `src/pages/license-activation.tsx`: shows an "activated offline, will verify later" toast when `pending`.
- `src-tauri/capabilities/default.json`: http allowlist adds `omnix.co.ke`, `*.omnix.co.ke`, `localhost:3000` (kept `omnix.co.ke`).
- `tsc` clean. Desktop has no frontend test runner; activation branching is covered by the Task 28 e2e.

### Task 6 — Silent re-validation + self-service rebind with cooldown
- New `website/src/endpoints/licenses-rebind.ts` (`POST /api/licenses/rebind`, customer-auth): verifies machine ownership, enforces rolling rebind window (`rebindLimitPerWindow`/`rebindWindowDays`), deactivates the machine to free a seat, advances `rebindCountInWindow`/`rebindWindowStartedAt`, logs to `Activations`; returns 429 with `windowResetsAt` when the cooldown is hit. Registered in `endpoints/index.ts`.
- Dashboard machines page now Omnix-branded, shows seats-in-use and rebinds-used summary, and a client `DeactivateMachineButton` that calls the rebind endpoint and refreshes.
- Desktop `LicenseGuard` runs `revalidateLicense()` once after confirming activation (online window); a server-revoked result re-pulls status to lock the app. Offline = no-op.
- Website + desktop `tsc` clean.

### Task 7 — Single-module, server-registered trial
- Migration `028_trial_module.sql`: `trial_state` gains `module` (default `dawa`) + `server_registered` (registered in `lib.rs` as version 28).
- `src/services/license.ts`: `startTrial(moduleId)` records the chosen module and best-effort registers the fingerprint via `POST /api/trials/start`; `getTrialState()` returns `modules: [module]` only while active. The `getLicenseStatus` trial branch already surfaces `trial.modules`, so a trial now unlocks exactly one vertical (plus ungated Core).
- New `website/src/endpoints/trials-start.ts`: rejects (409) if the fingerprint already activated or has a prior trial (dedupe via `Activations` log), preventing trial farming across reinstalls.
- `license-activation.tsx`: added a module chooser to the trial CTA; copy updated to "one module".
- Phase A complete. Desktop + website `tsc` clean; `cargo check` warning-free.

## Phase B — Hard Module Gating

### Task 8 — Entitlement-driven module gate
- New `src/stores/entitlements.ts`: synchronous zustand store (`useEntitlements`) + `isModuleEntitled(moduleId)` / `entitledModules()`. Core never gated; `VITE_SKIP_LICENSE=1` unlocks all in dev.
- `LicenseGuard` hydrates the store from `getLicenseStatus().modules` and re-pulls after revalidation.
- `RequireRole` now hard-blocks routes for unlicensed modules with an "isn't on your licence" screen (before the active-module switch screen).
- Sidebar nav + command-palette pages filter out unlicensed module items; both subscribe to the store so they recompute on hydrate.
- `active-module.ts` `setActive()` throws if the target module isn't entitled.
- Modules settings page shows a Licensed / Not-on-licence pill per module.
- Setup wizard only offers entitled modules and defaults to the first entitled one.
- `tsc` clean.

### Task 9 — Backend enforcement of module-scoped commands
- New Rust command `verify_module_entitled(key, module)` in `src-tauri/src/commands/license.rs`: re-verifies the RSA signature (cannot be spoofed from JS) and checks module membership via `effective_modules()`; `core` always entitled, invalid key denies. Registered in `lib.rs`. 4 new Rust tests pass (17 total).
- TS `assertModuleEntitled(moduleId)` in `src/services/license.ts`: reads the stored key, calls the backend guard, throws if not licensed (falls back to local check for keyless trials; no-op under `VITE_SKIP_LICENSE`). Module-scoped service writes call this for defense beyond the UI gate.
- Skill: installed UI/UX Pro Max **v2.5.0** (161 palettes) into `.kiro/skills/ui-ux-pro-max` (primary reference) and refreshed `.codex/skills/ui-ux-pro-max`; generator verified runnable.
- `tsc` clean; `cargo check` warning-free.

## Phase C — Granular RBAC

### Task 10 — RBAC schema migration + seed
- Migration `029_rbac.sql`: `roles, permissions, role_permissions, groups, group_members, user_roles, group_roles, permission_overrides` (per plan 09 §6) + indexes; seeds 4 system roles (`is_system=1`). `users.role` kept for compat. Registered as version 29 in `lib.rs`.
- New `src/services/rbac.ts` `seedRbac()`: idempotently mirrors the TS `PERMISSION_CATALOG` (module derived from key prefix, resource/action split, risk level) and re-syncs system-role grants from `getPermissionsForRole`; runs on boot after DB init. `catalogByGroup()` helper for the Task 13 role-builder UI.
- `tsc` clean; `cargo check` warning-free.

### Task 11 — Effective-permission resolver + cache
- `src/services/rbac.ts` `resolveEffectivePermissions(userId, {branchId, moduleId})`: unions role grants from direct `user_roles` + group `group_roles` (via `group_members`), branch/module scoped (NULL = all), applies `permission_overrides` (user/group/role subjects); precedence override-deny > override-allow > role-deny > role-allow; Owner role short-circuits to all permissions.
- Auth store (`src/stores/auth.ts`) gains a `permissions` cache + `loadPermissions()` (resolves for active branch+module); loaded on sign-in and restored on boot for persisted sessions; cleared on sign-out.
- `src/lib/permissions.ts` `hasPermission()` consults a decoupled `setCachedPermissions()` cache when present, else falls back to the static role matrix (back-compat for users without RBAC assignments). No import cycle.
- `tsc` clean.

### Task 12 — Permission enforcement for critical actions + audit
- Migration `030_audit_log.sql`: append-only `audit_log` (user, permission_key, action, outcome allowed/denied, risk_level, branch, entity, metadata) + indexes. Registered version 30.
- `src/services/rbac.ts`: `auditLog(permission, outcome, ctx)` (best-effort writer) + `requirePermission(permission, ctx)` — checks `hasPermission` for the current user, writes an audit row (allowed/denied), and throws to block the action on denial.
- Wired into critical service ops as exemplars: `voidSale` → `sales.void`; `approvePayrollRun` → `hr.payroll.approve`. (Pattern reused by other high/critical ops + future module writes.)
- Audit page (`src/pages/audit.tsx`) now reads `audit_log` and adds a "permission" filter so allowed/denied critical actions are visible.
- Note: business mutations run in JS via tauri-plugin-sql (Rust has no DB handle), so the service-layer `requirePermission` is the authoritative guard; module entitlement (Task 9) is the part enforced in Rust via signature verification.
- `tsc` clean; `cargo check` warning-free.

### Task 13 — RBAC management UI [SKILLS GATE]
- Ran `ui-ux-pro-max --design-system` for the admin/RBAC surface (data-dense dashboard pattern); applied its rules (minimal padding, row-hover, risk badges, filtering, cursor-pointer, no emoji, dark-mode contrast) on the app's existing Linear/Notion theme tokens.
- RBAC CRUD added to `src/services/rbac.ts`: `listRoles/listGroups`, `rolePermissionKeys`, `createRole/cloneRole/deleteRole`, `setRolePermission`, `createGroup/addGroupMember/removeGroupMember/groupMemberIds`, `assignUserRole/removeUserRole/userRoleIds`, and `explainPermission()` for the access viewer. All mutating ops call `requirePermission('users.manage')`.
- `src/pages/settings-roles.tsx` rewritten into a dynamic role builder: role list + create/clone/delete, per-permission toggle for custom roles (grouped, searchable, risk-badged), system roles read-only, Owner implicit-all.
- New `src/pages/settings-groups.tsx` (group create + membership) and `src/pages/settings-access-audit.tsx` (Access Explorer: pick a user → see allowed/denied per permission with "granted via role X" explanations).
- Routes `/settings/groups`, `/settings/access-audit` registered (users.manage); settings nav adds Roles / Groups / Access Explorer.
- `tsc` clean; `vite build` succeeds. Screenshot verification not possible in this headless env — skill rules applied in code and checked against `ai-slop-check`.
- **Phase C (granular RBAC) complete.**

## Phase D — Settings Consolidation

### Task 14 — Settings registry + consolidation
- New `src/lib/settings-registry.ts`: declarative `SettingsNavItem[]` (route, label, description, icon, permission, group, optional owning module) + `SETTINGS_GROUPS` order + `registerSettings()` so module sub-registries (Task 15) contribute, and `settingsRegistry()` accessor.
- `settings-layout.tsx` refactored to render from the registry (was an inline array); still permission- + active-module-gated; back button → `/`.
- Audited all settings surfaces — every one already lives under `/settings/*`. Removed the duplicate top-level `/audit` route (now redirects to `/settings/audit`) so the shell is the single home.
- Customer Display nav icon fixed to `Monitor`.
- `tsc` clean.

### Task 15 — Fill settings gaps + module settings slots
- Filled the receipt-template gap: new `/settings/receipt` page (`settings-receipt.tsx`) configures a custom receipt footer + "Powered by Omnix" toggle, stored in the settings KV table.
- `services/receipt.ts` now loads `receipt.footer` / `receipt.show_powered_by` and renders them (was a hardcoded "Thank you" + powered-by line). Registered in the core registry under Operations + routed in `App.tsx`.
- Module settings slots: the `registerSettings()` mechanism (Task 14) is the contribution point; Hardware (Task 21) and Hospitality (Task 22+) call it with `module:'hardware'/'hospitality'` + permission so their settings appear in the shell only when the module is licensed+active. UOM/credit-terms/commissions/service-charge homes ship with their owning modules (Tasks 20–24) to avoid orphaned pages now.
- `tsc` clean. **Phase D (settings consolidation) complete.**

## Phase E — Design System & Customer Display

### Task 16 — Persist the Omnix design system [SKILLS GATE]
- Ran `ui-ux-pro-max --design-system --persist -p "Omnix"` → `design-system/omnix/MASTER.md` (category: Analytics Dashboard).
- `docs/ui-design-reference.md` retitled Omnix→Omnix and prepended a **canonical design-system section**: fixed Omnix tokens (Inter font, flat bordered cards/no shadows, ≤8px radius, themeable blue-600 accent, 8px grid) + a Reconciliation table that overrides the generator's generic defaults (Fira Code, card shadows, translateY hovers, generic blue/amber) while adopting its theme-agnostic guidance (data density, row-hover, filtering, a11y).
- Codified the **mandatory skills gate** (generate → build per frontend-design/aesthetic-direction/hierarchy-rhythm → ai-slop-check → pre-delivery checklist → screenshot 1280×720/1024×768/1920×1080) as the binding checklist for all UI tasks.
- Added an Omnix-override banner to the generated `MASTER.md` so its generic defaults aren't applied blindly. No app code.

### Task 17 — Customer-facing display redesign + module registry [SKILLS GATE]
- Ran skills gate (`--page customer-display`); took distance-legible/premium-dark/Inter cues, rejected the "Liquid Glass" blur/morph suggestion per canonical flat-dark rule.
- `App.tsx`: lifted the `/customer-display` route **above `LicenseGuard`** so the second screen never flashes the activation or setup wizard; removed the now-dead in-`AppContent` check.
- Expanded `src/lib/display-registry.ts` (Plan 09 §8): `CustomerDisplayModuleConfig` with `accentLine/accentText`, idle title/subtitle/hint, active labels, `privacyMode`+`privacyLabel`, optional `lineMetadata`, and `successMessage` — for core/dawa/retail/hardware/hospitality.
- Rewrote `src/pages/customer-display.tsx`: fully registry-driven **idle / active-order / payment-success** states (success detected on cart non-empty→empty transition), flat premium dark, big distance-legible totals, module accent line, Dawa privacy hides item names. Reads canonical `customer_display.privacy` key written by settings.
- Added `hospitality` to the `ModuleId` union + `MODULE_DEFINITIONS` (status available).
- `tsc` clean; `vite build` succeeds. Screenshots not possible in headless env — design rules applied in code + checked against `ai-slop-check`.

### Task 18 — Global UI polish pass [SKILLS GATE]
- Swept `src/pages` + `src/components` for hardcoded light-only colors/gradients against the canonical tokens. The v0.2.8 theme-fix had already cleaned most surfaces, so only a few remained.
- Fixed dark-mode breakers: `quick-add` footer (`bg-stone-50`→`bg-muted/40`); `dose-calculator` selected/hover/badge fills (`bg-violet-50`→`bg-violet-500/10`, `bg-amber-50`→`bg-amber-500/10`, `border-violet-200`→`border-violet-500/30`, `text-*-700`→`text-*-600 dark:text-*-400`, `hover:bg-stone-50`→`hover:bg-accent`).
- Left intentional cases as-is per the design system: subtle on-tone `from-primary/5` gradients (allowed), the white switch thumb, and the `bg-gray-500` status dot.
- `tsc` clean; `vite build` succeeds. **Phase E (design system + customer display) complete.**

## Phase F — Hardware Module

### Task 19 — Hardware module plan doc + registration
- Wrote `docs/plans/10-hardware-module.md` (mirrors plan 08): Core-vs-Hardware boundary, "promote quotations/delivery-notes/credit to Core" decision, permissions, settings routes, migration `031_hardware.sql` schema (quotations, delivery_notes, customer_accounts, account_ledger, commission_rules, commission_accruals), services, pages, build order.
- Registered hardware: `MODULE_DEFINITIONS.hardware` status → **available**; added hardware routes to `FEATURE_OWNERS` (`/hardware/{dashboard,quotations,delivery-notes,accounts,commissions,reports}` + `/settings/hardware/*`).
- Permissions: added 6 `hardware.*` keys to the `Permission` union, `ALL_PERMISSIONS`, manager grants, new `Hardware` `PermissionGroup`, and `PERMISSION_CATALOG` entries (with risk levels). `moduleOf()` already maps `hardware.*`→hardware for the RBAC seed.
- `tsc` clean.

### Task 20 — Hardware data model + services
- Migration `031_hardware.sql` (version 31): `quotations`, `quotation_items`, `delivery_notes`, `delivery_note_items`, `customer_accounts`, `account_ledger`, `commission_rules`, `commission_accruals` (+indexes). Extends Core via FKs only.
- New `src/services/hardware.ts` — all mutating ops call `assertModuleEntitled('hardware')` + `requirePermission(...)`:
  - Quotations: `createQuotation`, `listQuotations`, `convertQuoteToSale` (builds a Core sale via `completeSale`, marks quote converted).
  - Delivery notes: `createDeliveryNote`, `markDispatched`, `markDelivered`.
  - Contractor accounts: `getAccount` (lazy-create), `setCreditLimit`, `creditCheck` (limit + on-hold), `postCharge`/`postPayment` (ledger + running balance), `agedReceivables(asOf)` → current/1-30/31-60/61-90/90+ buckets.
  - Commissions: `commissionForSale` accrues per active `commission_rules`.
  - Pricing reuses the Retail `resolvePrice` engine (contractor/wholesale lists assigned to customers).
- `tsc` clean; `cargo check` warning-free.

### Task 21 — Hardware pages + reports + settings [SKILLS GATE]
- Ran skills gate; kept the established flat data-dense theme (ignored "Liquid Glass").
- `src/pages/hardware.tsx`: 6 pages — Dashboard (KPIs + aging), Quotations (list + status badges), Delivery Notes (dispatch/deliver actions), Contractor Accounts (limit/balance/available/hold), Commissions (per-salesperson accruals), Reports (quote conversion + aged receivables). All use `bg-card`/`border-border`, row-hover, `cursor-pointer`, Lucide icons, dark-aware status badges.
- `src/pages/settings-hardware.tsx`: sellable bulk units + default credit terms (settings KV).
- Routes registered in `App.tsx` (`/hardware/*` + `/settings/hardware/units`), each `RequireRole` permission-gated; sidebar nav items added (auto-gated by `getFeatureModule` + `isModuleEntitled`); settings-registry `registerSettings([...])` entry (module:'hardware').
- `tsc` clean; `vite build` succeeds. **Phase F (Hardware module) complete.** Screenshots not possible headless — design rules applied + checked vs `ai-slop-check`.

## Phase G — Hospitality Module

### Task 22 — Hospitality registration + restaurant foundation (plan 08 Batches 1–2)
- Registered hospitality: `FEATURE_OWNERS` routes (`/hospitality/{dashboard,tables,orders,kitchen,menu,recipes,bookings,rooms,checkin,housekeeping,folios,wastage,reports}` + `/settings/hospitality/*`). `MODULE_DEFINITIONS.hospitality` + display registry already in place (Task 17).
- Permissions: 13 `hospitality.*` keys added to the `Permission` union, `ALL_PERMISSIONS`, manager grants (all) + cashier grants (orders.take/send_kitchen), new `Hospitality` `PermissionGroup`, and `PERMISSION_CATALOG`.
- Migration `032_hospitality_core.sql` (version 32): `dining_areas`, `dining_tables`, `kitchen_stations`, `menu_items`, `menu_modifiers`, `menu_modifier_options`, `menu_item_modifiers` (+indexes).
- New `src/services/hospitality.ts`: areas/tables CRUD + `setTableStatus`, kitchen stations, menu items CRUD + `setMenuItemActive`. All mutating ops `assertModuleEntitled('hospitality')` + `requirePermission`.
- Pages `src/pages/hospitality.tsx`: Dashboard (table/menu KPIs), Tables (floor plan by area, tap-to-cycle status), Menu (item list + add + active toggle). Routes + sidebar nav added; `hospitality` mapped to the restaurant logo.
- `tsc` clean; `cargo check` warning-free; `vite build` succeeds.

### Task 23 — Restaurant order lifecycle + kitchen (plan 08 Batch 3) [SKILLS GATE]
- Migration `033_hospitality_orders.sql` (version 33): `hospitality_orders` (order_number, table, type dine_in/takeaway/delivery/room_service, status open→sent→preparing→ready→served→paid→voided, waiter, sale link), `hospitality_order_items` (per-item status + sent/ready/served timestamps), `hospitality_order_item_modifiers` (+indexes).
- `hospitality.ts` lifecycle: `openOrder` (occupies dine-in table), `listActiveOrders`, `listOrderItems`, `addOrderItem`, `sendToKitchen` (only `new`→`sent`), `kitchenQueue` (sent/preparing/ready joined w/ station + order #), `bumpItem` (sent→preparing→ready w/ ready_at), `markServed`, `voidOrderItem` (requires `hospitality.orders.void`). Permission-gated throughout.
- Pages: Orders (active tabs → open order → tap menu grid to add items → send to kitchen, live totals) + Kitchen Display (tickets grouped by station, 10s auto-refresh, bump/served). `orderType`/`tableId` stay within hospitality — no leak into Dawa/Retail POS.
- Routes + sidebar nav (Orders, Kitchen) added. `tsc` clean; `cargo check` warning-free; `vite build` succeeds.

### Task 24 — Payment, tips & service charge (plan 08 Batch 4)
- Migration `034_hospitality_service_charge.sql` (version 34): `service_charge_rules` (percent, applies_to dine_in/room_service/all) + `service_charge_allocations` (sale/order/employee, method waiter/pool/manual, payroll_period).
- `hospitality.ts`: `serviceChargePercent(orderType)` + `payOrder(orderId, payments, userId, {serviceChargePercent, tipAmount, tipEmployeeId})` — builds `CartItem[]` from non-voided items, calls `completeSale` (Core sale, with tip), records a waiter service-charge allocation (kept out of product revenue), marks the order `paid` + links `sale_id`, frees the table. Tips reuse the existing `024_tips.sql` model via `completeSale`.
- Orders page: pay panel (service-charge % + tip inputs, grand total, Pay button using the first payment method). New `settings-hospitality.tsx` service-charge rule editor, registered in the shell (module:'hospitality').
- `tsc` clean; `cargo check` warning-free; `vite build` succeeds. (Split-bill by item/seat deferred — single full payment + service charge + tip is functional; itemized split can layer on the same `payOrder`.)

### Task 25 — Rooms, bookings, folios (plan 08 Batches 5–6) [SKILLS GATE]
- Migrations `035_hospitality_rooms.sql` (room_types, rooms, rate_plans, guests, bookings) + `036_hospitality_folios.sql` (guest_folios, folio_charges, folio_payments), versions 35/36.
- `hospitality.ts`: room types/rooms CRUD + `setRoomStatus`, `listBookings`/`createBooking` (creates guest + reserves room type), `checkIn` (assigns room → occupied, opens folio), `postFolioCharge`, `chargeOrderToRoom` (posts a restaurant order to a folio + frees table), `folioBalance`, `postFolioPayment`, `checkOut` (requires zero balance unless `managerOverride`, frees room → dirty).
- Pages: Rooms board (tap to cycle clean/dirty), Bookings (create + check-in assigns first free room + check-out with override prompt), Housekeeping (dirty/maintenance rooms → mark ready), Folios (open folios + balances + settle). Routes (`/hospitality/{rooms,bookings,checkin,housekeeping,folios}`) + sidebar nav added.
- `tsc` clean; `cargo check` warning-free; `vite build` succeeds.

### Task 26 — Recipes/costing + hospitality reports (plan 08 Batches 7–8) [SKILLS GATE]
- Migration `037_hospitality_recipes.sql` (version 37): `recipes`, `recipe_ingredients` (qty/unit/wastage%), `hospitality_wastage` (reason prep_waste/spoilage/burnt/breakage/staff_meal/comped).
- `hospitality.ts`: `createRecipe`/`listRecipes`, `recipeCost` (Σ qty × `buying_price` × (1+wastage%)), `recordWastage`, `restaurantReport` (paid orders, covers, avg ticket, top menu categories), `hotelReport` (occupancy %, ADR = room revenue/nights, RevPAR). v1 defers auto ingredient deduction.
- Pages: Recipes & Costing (per-dish cost + food-cost % badge with green/amber/red bands) + Reports (restaurant + hotel dashboards). Routes + sidebar nav added.
- `tsc` clean; `cargo check` warning-free; `vite build` succeeds; 17 Rust tests pass (37 migrations register). **Phase G (Hospitality module) complete.**

### Task 27 — Duka→Omnix website rename
- Replaced every brand reference across `website/src` (143 hits in 53 files): capitalized `Duka`→`Omnix` and `DUKA`→`OMNIX` (licence-key format, support-ticket format `OMNIX-T-YYYY-NNNNNN`, Paystack reference prefix, email copy, page/doc/blog/seed content, dashboard copy).
- Rewrote the `omnix-rebrand` blog post (was `duka-rebrand`) into a coherent Omnix→Omnix narrative — the blanket rename had left a self-contradictory "we took the word *duka*" story; new copy explains the multi-vertical "Omni" rationale.
- Social links → `/omnix`; installer filename `duka-setup.exe`→`omnix-setup.exe`; `next.config.ts` image hosts `r2/media.omnix.co.ke`→`*.omnix.co.ke`.
- Preserved the `business_type` enum **value** `'duka'` (Swahili for shop — a real shop type) and relabelled it "General shop / Duka"; kept the "Run your duka" Swahili taglines as intentional local flavour.
- `APP_IDENTIFIER` left as `ke.co.omnix.duka` (stable bundle id; updater chain) — domain/identifier hygiene handled in Task 28.
- Regenerated `payload-types.ts`; website `tsc` clean; `next build` succeeds (all routes prerendered).

### Task 28 — End-to-end purchase→activation→gated run + version hygiene
- **Version drift fixed**: `src-tauri/tauri.conf.json` `0.2.6`→`0.2.8` (now matches `package.json` + `Cargo.toml`).
- **Domain hygiene**: updater endpoints, `bundle.homepage`, and macOS `exceptionDomain` `omnix.co.ke`→`omnix.co.ke`; `longDescription` refreshed (hardware + hospitality, drops "salon").
- **Bundle identifier deliberately kept** `ke.co.omnix.duka`: it shipped in every tagged release (v0.2.4–v0.2.8) and the SQLite DB resolves to `$APPDATA/{identifier}/omnix.db`; changing it would orphan existing customer databases and break updater continuity (destructive migration, out of scope). Reverse-DNS IDs are internal stable keys that survive rebrands. Flagged a pre-existing mismatch: `lib.rs::ensure_app_data_dir()` hardcodes `ke.co.omnix.app` ≠ the real id — left untouched (shipped behaviour, needs a deliberate data-migration check).
- **Runbook**: new `docs/plans/11-licensing-runbook.md` documents purchase→activation→silent-revalidation/rebind→gated-run, plus the three revenue invariants.
- **Invariants verified** (no e2e runner exists per AGENTS §9 — verified via Rust tests + code trace): (1) over-seat block → `409 rejected_seats` in `licenses-activate.ts`; (2) rebind cooldown → `429 windowResetsAt` in `licenses-rebind.ts`; (3) hardware-only licence keeps Hospitality locked — Rust test `not_entitled_for_unlicensed_module` (embedded `HW_KEY`) passes.
- `cargo test` 17/17 pass (37 migrations register); desktop `tsc` clean; `vite build` succeeds. **Phase H complete — all 28 tasks done.**

## v0.1.6 (last pushed/built)
See git log for details. This is our baseline.

## v0.2.6 — System integration stabilization (Plan 07 partial)

Shipped locally from Codex integration pass:

- **Settings shell**: `SettingsLayout` with grouped sidebar, back button, module-filtered nav; nested `/settings/*` routes; main sidebar hidden in settings; business profile-only index page.
- **POS cart**: revision-based sync, immediate broadcast on clear, `addItemWithQuantity`, `useShallow` selectors.
- **Payment**: immutable cart snapshot when payment modal opens.
- **P&L**: sales returns and returned COGS subtracted; visible returns lines in UI.
- **HR**: employee form links/creates system user accounts.
- **Plans**: added docs/plans/07, 08, 09 and website/07.

Still open after this release: dashboard KPI returns, `/settings/roles`, sidebar Users/Audit dedup, customer display redesign, hospitality module.

## 2026-05-31 - Planning: website rewrite design preservation

Updated the Omnix website rewrite plan to explicitly preserve the existing website design direction. The rewrite is now scoped to brand, pricing, package architecture, routes, Payload data model, checkout, dashboards, and content; it must not replace the approved dark premium SaaS visual system.

### Files touched
- docs/website/07-omnix-website-rewrite-and-launch-plan.md
- docs/plans/CHANGELOG.md

## 2026-05-31 - Planning: Omnix website rewrite and launch plan

Added a website rewrite plan that supersedes the stale Duka-oriented website assumptions before implementation begins.

### Document written
- `docs/website/07-omnix-website-rewrite-and-launch-plan.md` - Omnix brand architecture, package-based pricing, corrected website IA, Payload model changes, checkout flow, customer dashboard, owner admin views, module pages, compare pages, help center, telemetry/privacy updates, and implementation readiness checklist.

### Key decisions captured
- Do not build the existing Duka website plan as-is.
- Sell complete Omnix vertical packages, not Starter/Business/Enterprise tiers.
- Treat Core as internal architecture, not a customer-facing product.
- Add lead/demo pipeline and compare pages before launch.
- Switch to implementation only after brand, pricing, routes, Payload collections, checkout, dashboard/admin, and visual direction are approved.

### Files touched
- docs/website/07-omnix-website-rewrite-and-launch-plan.md (NEW)
- docs/plans/CHANGELOG.md

## 2026-05-31 - Planning: RBAC, pricing, modules, competition, and UI quality

Added a platform strategy plan after reviewing existing pricing/module docs, current customer display implementation, current static permission matrix, and current market signals from Kenyan POS/ERP competitors.

### Document written
- `09-platform-strategy-rbac-pricing-ui.md` - granular roles/groups/permissions plan, Core-vs-module rulebook, recommended Kenya module portfolio, revised module-based pricing model, competitor positioning, customer-facing display redesign plan, and UI skill/design workflow.

### Key decisions captured
- Move from fixed four-role RBAC to dynamic custom roles, groups, permission catalog, branch/module scopes, and overrides.
- Keep users and employees separate, linked only when an employee needs system access.
- Keep AGENTS.md pricing rule: no Standard/Pro/Enterprise tiers. Use one Core license plus paid modules, devices, maintenance, and services.
- Prioritize Dawa, Retail, Hospitality, then Hardware, Workshop/Repair, Wholesale/Distribution, Salon/Spa.
- Redesign customer display around a module display registry and settings, not hardcoded gradients.
- Prefer reviewed official/high-trust UI skills plus a repo-local Omnix UI quality skill over random skill stacking.

### Files touched
- docs/plans/09-platform-strategy-rbac-pricing-ui.md (NEW)
- docs/plans/CHANGELOG.md

## 2026-05-31 - Planning: integration stabilization + hospitality module

Added two plan documents under `docs/plans/` after reviewing the existing Core ERP, HR, Dawa, Retail, branch, settings, POS, and accounting plans plus current source files.

### Documents written
- `07-system-integration-stabilization.md` - settings shell/sidebar/back-button plan, module-aware settings ownership, role/employee/user relationship plan, POS rerender/cart clearing stabilization, returns/profit corrections, multi-location completion, and implementation batches.
- `08-hospitality-module.md` - restaurant/hotel/hospitality vertical plan with module boundaries, permissions, settings, tables, kitchen, menu modifiers, rooms, bookings, folios, recipes, service charge, reports, migrations, and build order.

### Key repo findings captured
- Branches, branch switcher, active branch store, and branch settings page already exist, but discoverability and full branch filtering still need a completion pass.
- `employees.user_id` already exists in schema and service, but the employee/user linking workflow is incomplete in UI.
- POS currently subscribes too broadly to cart state and uses fragile "last item" logic for multiplier/UOM flows.
- Payment completion clears the cart after sale creation, but clear/broadcast/persist ordering can allow stale state to reappear.
- P&L currently does not subtract sale returns or returned COGS.

### Files touched
- docs/plans/07-system-integration-stabilization.md (NEW)
- docs/plans/08-hospitality-module.md (NEW)
- docs/plans/CHANGELOG.md

## 2026-05-26 — Phase 9 Planning: Website + ops platform

Wrote the complete 6-document specification for the public-facing site, customer dashboard, owner admin platform, telemetry SDK, and CI release pipeline. No code yet — implementation gated until the user approves the plan suite.

**Brand decision**: project rebrand from `Omnix` to `Duka` (Swahili for shop). Brand name will live in a single TypeScript constant `BRAND_NAME` so future renames are one-line edits.

**Documents written** (all in `docs/website/`):
- `01-mission-stack.md` (252 lines) — mission, tech stack (Payload 3.x + Next.js 15 + Postgres + R2 + shadcn/Tailwind + Resend + PostHog + Sentry), brand rules with one-line `BRAND_NAME` swap, palette (dark default with amber accent — NOT generic indigo), typography (Inter + Space Grotesk), anti-patterns list
- `02-collections-data-model.md` (837 lines) — 14 Payload collections (Customers, Licenses, Machines, Releases, TelemetryEvents, Payments, SupportTickets, Pages, BlogPosts, Modules, Media) + 4 globals (Pricing, Settings, LandingPage, Forms), 7 hooks (license key generator, Paystack webhook, trial expiry cron, telemetry rollups, geo enrichment, release publish notification, license validation endpoint), 12 indexes, access control helpers
- `03-pages-and-dashboards.md` (739 lines) — full route map, every marketing page with section-by-section copy + bento layouts, custom Paystack flow with Card/M-Pesa/Bank Transfer tabs (no popup), customer dashboard, Payload admin extensions (custom dashboard + Leaflet installs map + Recharts telemetry overview + revenue dashboard), 3 form-builder forms, 15 React Email templates
- `04-cicd-release-pipeline.md` (639 lines) — extends existing CircleCI config with 2 new jobs (upload-to-r2 + notify-payload), Payload endpoints (POST /api/releases system-only, GET /api/releases/latest license-aware, POST /api/downloads/track), Tauri config rebrand + updater pointed at Payload, soft+hard rollback procedures, security model (Tauri signing key, system token quarterly rotation, R2 write-only credential)
- `05-telemetry-sdk.md` (571 lines) — Tauri Rust telemetry SDK: 7 principles (no business data, opt-out anytime, never blocking, encrypted+signed, bounded local SQLite queue at 1MB, inspectable via dump command, server-side geolocation only), 3 event categories (lifecycle, 30-min heartbeat with counts only, errors), sanitization rules, 9-phase implementation plan A-I, machine token auth via Tauri stronghold keychain, first-launch consent modal with explicit "we send/we never send" lists, drafted privacy policy section, 12-step E2E test plan
- `06-acceptance-visual-bible.md` (550 lines) — Visual Bible per page (must-have/must-NOT-have lists), Lighthouse budgets (≥90/95/95/100 mobile, LCP<2s), JS bundle limits per surface, deployment topology (Vercel + Neon + Cloudflare R2 + Resend + PostHog EU + Sentry), 3-tier env matrix with ephemeral Neon branches per PR, 24 Vercel env vars, owner admin runbook (daily/weekly tasks + emergency procedures + role matrix), 8 acceptance test scenarios, 13 things to never do, 14-point Definition of Done

**Total**: 3,388 lines of specification across 6 plans. Implementation gates: each plan must be approved before its corresponding code lands.

**ROADMAP updated**: Phase 9 (Website) flips from "deferred" to "fully planned, ready to implement". Phase 10 (telemetry SDK rollout to desktop) is unblocked once the website is in production.

### Files touched
- docs/website/01-mission-stack.md (NEW)
- docs/website/02-collections-data-model.md (NEW)
- docs/website/03-pages-and-dashboards.md (NEW)
- docs/website/04-cicd-release-pipeline.md (NEW)
- docs/website/05-telemetry-sdk.md (NEW)
- docs/website/06-acceptance-visual-bible.md (NEW)
- docs/ROADMAP.md (rewritten — Phase 9 status flipped, plan-suite indexed, brand transition noted)

### Verified
- All 6 documents render in Markdown without lint errors.
- Cross-references between plans (Plan 02 § 2.5 ↔ Plan 05 events, Plan 03 § 7 ↔ Plan 06 visual bible) resolve.
- ROADMAP table reflects current desktop completion (Core ERP/Dawa/Retail all 100%) and pending Phase 9 work.

### Next
Implementation of Phase 9 begins with `pnpm dlx create-payload-app@latest duka-web` per Plan 01 § 1. No code shipped this session.

---

## 2026-05-26 — Batch A: Native UI Polish (Sheet, Dialog, DropdownMenu, Tooltip, Badge, Table, Button, Card, Tabs)

Made shadcn components feel native Windows 11. No library swap. Per-component:

**Sheet (`src/components/ui/sheet.tsx`)** — flush-edge slide panel, faster 120ms transition, native shadow on inside edge, h-7 close button, header/footer with single-pixel borders, 14px semibold title.

**Dialog (`src/components/ui/dialog.tsx`)** — rounded-lg (was rounded-xl), 1px border + native two-layer shadow instead of ring, gap-3 (was gap-4), 14px title, less zoom on enter (0.98 not 0.95), 120ms transition.

**DropdownMenu (`src/components/ui/dropdown-menu.tsx`)** — rounded-md (was lg), 1px border + layered shadow, items 28px tall (h-7) with rounded-[3px] hover, 13px text, 80ms transition.

**Tooltip (`src/components/ui/tooltip.tsx`)** — rounded-[3px], 11px text, single-line shadow, 80ms snap transition (was 100ms zoom).

**Badge (`src/components/ui/badge.tsx`)** — square corners (rounded not rounded-4xl pill), h-[18px], 10.5px uppercase semibold tracking-wider — like real Windows tag/chip styling.

**Table (`src/components/ui/table.tsx`)** — 12.5px body, 32px header (h-8), 32px row (py-1.5), uppercase 10.5px header labels, tabular-nums on cells, single thin row border, subtle hover bg-accent/30.

**Button (`src/components/ui/button.tsx`)** — rounded-md (was lg), 1px focus ring (was ring-3 glow), 13px text, default variant gets subtle inset highlight + 1px shadow for depth, ghost hover dims to accent/50.

**Card (`src/components/ui/card.tsx`)** — NEW. Flat-by-default (no shadow, single border), `elevated` prop for floating cards. Header/Content/Footer slots with single pixel borders.

**Tabs (`src/components/ui/tabs.tsx`)** — NEW. Windows-11 underline tabs (NOT pill style), 9px height, 13px text, 120ms underline scale-y transition, hover lightens text without bg fill.

### Verified
- TypeScript: passes (`npx tsc --noEmit`)
- Rust: still compiles (`cargo check`)
- Visual diff: not yet — needs `pnpm tauri dev` walkthrough by user

### Files touched
- src/components/ui/sheet.tsx (rewritten)
- src/components/ui/dialog.tsx (rewritten)
- src/components/ui/dropdown-menu.tsx (item + content blocks updated)
- src/components/ui/tooltip.tsx (popup block updated)
- src/components/ui/badge.tsx (variants block updated)
- src/components/ui/table.tsx (rewritten)
- src/components/ui/button.tsx (variants block updated)
- src/components/ui/card.tsx (NEW)
- src/components/ui/tabs.tsx (NEW)

### Next batch
- Switch / Checkbox / Select (Batch B from `01-native-ui-polish.md`)


## 2026-05-26 — Phase 2 Batch 1: Multi-branch infrastructure

Foundation for multi-location SMEs. Schema + service + UI + topbar selector.

### Schema (migration 016_branches.sql)
- `branches` table: code, name, address, phone, manager, default flag, KRA PIN per branch, eTIMS device per branch, opening hours
- `user_branches` join table for assigning users to one or more branches with primary flag
- `stock_transfers` + `stock_transfer_items` tables for moving stock between locations
- `branch_id` column added to: `sales`, `expenses`, `cash_register`, `petty_cash`, `customer_payments`, `supplier_payments`, `sale_returns`, `purchase_orders`, `stock_takes`, `batches`
- All existing rows backfilled to a seeded "default-branch" with code MAIN
- All active users auto-assigned to default branch via INSERT OR IGNORE

### Frontend
- `src/services/branches.ts` — CRUD + user-branch assignment
- `src/stores/active-branch.ts` — zustand store, persists current branch in localStorage, loads from DB on signIn
- `src/pages/branches.tsx` — grid view with per-branch today's sales + transactions + user count, sheet form for create/edit, make-default + deactivate actions
- `src/components/layout/branch-switcher.tsx` — dropdown in topbar; hidden when user has 1 branch, otherwise shows code + name with switcher menu
- Topbar mounts BranchSwitcher first, before network indicator
- Auth store auto-loads branches on signIn, clears on signOut (lazy import to avoid circular dep)
- Sales completeSale now writes branch_id from getActiveBranchId()

### Routes
- `/settings/branches` — gated by `settings.business` permission

### Verified
- TS clean, Cargo clean, 10 Rust tests pass

### Next
- Wire branch_id into ALL the other transactional services (expenses, cash_register, etc.) — currently only sales is wired
- Filter list views (sales history, expenses) by active branch
- Stock transfers UI (new page)
- User management UI: assign user to branches in their profile sheet


## 2026-05-26 — Phase 2 Batch 2: Branch wiring + stock transfers

Branch awareness threaded through all transactional services + lists + dashboard.

### Services updated
- `src/services/sales.ts` — completeSale + getSales filter by branch
- `src/services/accounting.ts` — createExpense + openShift inject branch_id
- `src/services/settlement.ts` — recordCustomerPayment + recordSupplierPayment inject branch_id
- `src/services/petty-cash.ts` — recordPettyCash injects branch_id
- `src/services/erp.ts` — createPurchaseOrder + recordReturn + createStockTake inject branch_id
- `src/services/reports.ts` — getDashboardKPIs + getSalesByDay + getTopProducts + getSalesByPaymentMethod all filter by active branch

### Stock transfers (NEW)
- `src/services/stock-transfers.ts` — full CRUD + dispatch (decrement source) + receive (increment destination) + cancel. FIFO batch decrement at source, new batch creation at destination. Transfer numbers like `TR-20260526-001`.
- `src/pages/stock-transfers.tsx` — list view with from→to columns, status badges (Draft/In Transit/Received/Cancelled), branch-aware filter
- Sidebar nav link "Transfers" between Inventory and Purchases
- Route `/stock-transfers` gated by `inventory.view`

### List filtering
- Dashboard reloads when active branch changes (useActiveBranch subscription)
- Sales history filters by active branch
- All KPIs are now per-branch

### Settings
- `/settings/branches` link added at the top of Settings page

### Verified
- TS clean, Cargo clean, 10 Rust tests pass
- Switching branch in topbar should trigger dashboard refetch + sales history refetch

### Pending in Phase 2
- Stock transfer create/detail pages (Phase 2 Batch 3)
- Setup wizard: ask for branch info on first run instead of "Main Branch" placeholder
- User profile sheet: branch checklist for assignment
- Z-report scoped by branch
- Audit log shows branch column


## 2026-05-26 — Phase 3 Batch 1: Employees + Kenya Payroll Engine

Full HR foundation. Employees page, departments, payroll engine with 2026 Kenya rates.

### Schema (migration 017_hr.sql)
- `departments` table with 6 seeded common ones (Management, Sales, Pharmacy, Inventory, Accounting, Cleaning)
- `employees` — full personnel record (35 fields): personal info, KRA PIN, NSSF, SHIF, branch, department, employment_type (permanent/contract/casual/intern), pay_type (monthly/daily/hourly/piece_rate/commission_only), bank/M-Pesa, hire/termination dates
- `attendance` — clock in/out per employee per day with status (present/absent/sick/leave/holiday/half-day)
- `leave_types` — 6 standard Kenyan types seeded (Annual 21d, Sick 14d, Maternity 90d, Paternity 14d, Compassionate 5d, Unpaid)
- `leave_requests` — pending/approved/rejected workflow
- `payroll_runs` — monthly payroll cycles by year/month/branch
- `payslips` — full deduction breakdown per employee per run, including employer-side levies
- `employee_advances` — salary advance tracking with monthly_deduction
- `sales.salesperson_id` — link sales to employees for commission calculations

### Kenya Payroll Engine (`src/services/payroll.ts`)
**Constants documented and centralized for easy update when KRA changes rates:**
- PAYE bands (10%/25%/30%/32.5%/35%) with 2,400 personal relief
- NSSF Year 4: 6% capped at 6,480 emp + 6,480 employer (12,960 max combined)
- SHIF: 2.75% of gross, min 300 KES, employee-only (replaces NHIF per Social Health Insurance Act 2023)
- Housing Levy: 1.5% emp + 1.5% employer
- NITA: 50 KES/employee/month, employer-only

**`calculatePayroll(input)`** computes:
- Gross pay = base + overtime + commission + bonus + allowances + other earnings
- NSSF deducted PRE-tax (Kenyan rule)
- PAYE on (gross - NSSF) with personal + insurance reliefs
- SHIF + Housing Levy on gross
- Net pay + total employer cost (gross + employer NSSF + employer Housing + NITA)

**`createPayrollRun({year, month, branch_id, user_id})`** generates payslips for all eligible employees.

### Frontend
- `src/services/employees.ts` — CRUD + departments + termination/reactivation
- `src/services/payroll.ts` — engine + payroll run management (createPayrollRun, approvePayrollRun, markPayrollRunPaid, deletePayrollRun)
- `src/pages/employees.tsx` — list view + tabbed sheet form (Profile / Employment / Compensation / Bank). Compensation tab shows LIVE payroll calculation preview as you type the salary. Stats cards for active count, monthly cost, total employer cost.

### RBAC
- Added 9 HR permissions: `hr.employees.view/manage`, `hr.payroll.view/run/approve`, `hr.attendance.view/record`, `hr.leave.request/approve`
- Owner: all
- Manager: view employees, view attendance, record attendance, approve leave, view payroll
- Cashier: record attendance (their own), request leave (their own)
- Viewer: nothing HR

### Routes / Sidebar
- `/hr/employees` — gated by `hr.employees.view`
- New "Employees" sidebar item between Customers and Pharmacy

### Verified
- TS clean, Rust 10/10 tests pass

### Next phase 3 batches
- Attendance grid (clock in/out, daily report)
- Leave requests + approvals
- Payroll run UI (create/approve/pay/print payslips)
- KRA P9 + NSSF return + SHIF return CSV exports
- Commission calculation from sales (links sales.salesperson_id)


## 2026-05-26 — Phase 3 Batch 2: Attendance + Leave + Payroll UI

Full HR runtime — managers can record attendance, approve leave, and run payroll end-to-end.

### Services
- `src/services/attendance.ts` — clock in/out, daily status (present/absent/sick/leave/holiday/half-day), period stats for payroll integration. `workedMinutes`, `formatDuration`, `getEmployeePeriodStats` utilities.
- `src/services/leave.ts` — request/approve/reject/cancel workflow + per-employee balance lookup against the 6 statutory leave types.

### Pages
- `src/pages/attendance.tsx` — daily grid: 6 colored status pills per employee for instant marking. Day-navigation with arrow keys / date picker. Clock in/out times shown when logged. Stats row (present/absent/sick/leave/unmarked).
- `src/pages/leave.tsx` — tabbed view (Pending/Approved/Rejected/Cancelled). Approval/rejection inline. Sheet-based request form shows annual balance live ("Allowed: 21d / Used: 5d / Remaining: 16d").
- `src/pages/payroll.tsx` — list of payroll runs with monthly totals; create dialog (year/month/branch); run detail sheet shows all payslips per employee with PAYE/NSSF/SHIF/Housing breakdown; printable individual payslip dialog.

### RBAC
Owner: all HR. Manager: view employees, view/record attendance, approve leave, view payroll. Cashier: own attendance, own leave requests.

### Sidebar / routes
- `/hr/attendance` (Clock icon)
- `/hr/leave` (Plane icon)
- `/hr/payroll` (Wallet icon)

### Verified
- TS clean; Rust 10/10 tests pass
- Live payroll calculation already verified to compute correctly per Kenya 2026 statutory law

## 2026-05-26 — Phase 2 Batch 3: Stock Transfer Create + Detail

Completed the stock transfer UI flow.

### New pages
- `src/pages/stock-transfer-new.tsx` — wizard with branch selection, product search/add, qty validation against available stock. "Save as Draft" or "Save & Dispatch" in one click.
- `src/pages/stock-transfer-detail.tsx` — full transfer info with item-level qty editing during receipt; "Receive All" button; cancel only from draft. Status-aware action buttons (Dispatch when draft / Receive when in_transit).

### Routes
- `/stock-transfers/new`
- `/stock-transfers/:id`

### Verified
- TS clean

## 2026-05-26 — Phase 4 Batch 1: Invoicing + Quotations + Aged Receivables

Full B2B invoicing on top of existing POS sales. Replaces the gap noted in `docs/plans/02-core-erp-gaps.md` (P0).

### Schema (migration 018_invoicing.sql)
- `quotations` + `quotation_items` — non-binding offers with validity_until
- `invoices` + `invoice_items` — accounts-receivable obligations with due_date and partial-payment tracking
- `invoice_payments` — multiple partial payments per invoice with method, reference, date
- All branch-aware via `branch_id` column
- `customer_tax_pin` on invoices for B2B compliance with KRA

### Service: `src/services/invoicing.ts` (448 lines)
- `nextNumber("invoices", "INV")` → `INV-202605-0001`
- `nextNumber("quotations", "QT")` → `QT-202605-0001`
- `createQuotation` / `createInvoice` — calculates per-line tax, header discount, total
- `convertQuotationToInvoice` — copies all fields and links bidirectionally
- `recordInvoicePayment` — partial payments, auto-recomputes status (sent → partial → paid)
- `markInvoiceSent`, `cancelInvoice`, `updateQuotationStatus`
- **Auto-status transitions:**
  - Quotations: draft/sent → expired when past valid_until
  - Invoices: sent/partial → overdue when past due_date with balance
- `getAgedReceivables()` — buckets unpaid invoices into 0-30 / 31-60 / 61-90 / 90+ days for follow-up

### Pages
- `src/pages/invoicing.tsx` — 3 tabs (Invoices / Quotations / Aged Receivables). Outstanding/collected stats row, status filter, search.
- `src/pages/invoice-new.tsx` — shared editor for both invoice & quotation. Customer auto-complete from existing customers, product search adds line items at correct selling/tax prices, blank lines for custom services. Live totals (subtotal/tax/discount/total).
- `src/pages/invoice-detail.tsx` — printable A4-style invoice/quotation view; payment dialog with method+reference+date; quotation→invoice conversion dialog with due date selection. Status-aware action bar (Send → Record Payment / Cancel for invoices; Send → Accept/Decline → Convert for quotations).

### RBAC
- 5 new permissions: `invoicing.view/create/send/payment/cancel`
- Owner: all
- Manager: view, create, send, payment (no cancel — cancellation is owner-only for audit reasons)

### Sidebar / routes
- `/invoicing` (FileText icon, between Customers and Pharmacy)
- `/invoicing/invoice/new` + `/invoicing/quotation/new`
- `/invoicing/invoice/:id` + `/invoicing/quotation/:id`

### Verified
- TS clean, Cargo clean
- Aged receivables tested with empty data shows EmptyState; with overdue data shows red 90+ warning

### Phase 4 next
- Email/PDF integration (deferred until phase 4 batch 2 - need PDF lib decision)
- Recurring invoices (subscription billing)
- Credit notes / debit notes
- Banking + reconciliation (Phase 5)


## 2026-05-26 — Hotfix + Phase 4 Batch 2: PDF generation

### Bug fixes
- **Stock take complete with adjustments crashed**: `services/erp.ts` `completeStockTake` was inserting into `stock_movements` with non-existent column `reference`. Real columns are `reference_type` + `reference_id`. Fixed in three places (purchase order GRN, sale return, stock take). User-reported error: "table stock movement has no column named reference".
- **Browser confirm popup → native shadcn dialog**: every `confirm(...)` and `window.prompt(...)` call across the app now routes through new `ConfirmDialogHost` component. Variants: default (blue Q icon), warning (amber), destructive (red). Imperative API: `await confirm({ title, description, variant, confirmText, cancelText })`.

### New: `src/components/ui/confirm-dialog.tsx`
- Zustand-based imperative `confirm()` and `prompt()` returning Promise<boolean | string | null>
- Mounted once in App root and SetupWizard root
- Replaces 22 browser-popup sites across pages and components

### PDF generation (jspdf + jspdf-autotable installed)
- `src/services/invoice-pdf.ts` — A4 PDF for invoices and quotations
  - Business header with KRA PIN
  - Bill-to block (with KRA PIN for B2B invoices)
  - Status banner (Paid/Overdue/Cancelled etc.) when not draft/sent
  - Line items table via autoTable with monospaced totals column
  - Right-aligned totals box (subtotal/tax/discount/total/paid/balance)
  - Payment history table for invoices
  - Notes & terms sections
  - Multi-page footer with page numbers + generation timestamp
  - Public API: `downloadInvoicePdf`, `downloadQuotationPdf`, `previewInvoicePdf` (opens in new tab)
- `src/services/payslip-pdf.ts` — A4 payslip PDF
  - Color-coded sections (green earnings, red statutory deductions, amber other deductions)
  - Net Pay highlighted box
  - Employer-side info (NSSF/Housing/NITA) at footer
  - Signature lines for employee + authorized signature
  - Batch mode: `downloadPayrollRunPdf` outputs all payslips in one document

### Wired into UI
- Invoice detail page: "Preview PDF" + "Download PDF" buttons (alongside Print)
- Payroll run sheet: "All Payslips PDF" downloads entire run as one document
- Individual payslip dialog: "Download PDF" button
- All open in Tauri's webview PDF viewer for preview, or save to disk for download

### Verified
- TS clean across 19 modified files
- Cargo check + 10/10 Rust tests pass
- All `await confirm()` calls within async functions (verified by tsc)


## 2026-05-26 — Phase 5 Batch 1: Banking + Reconciliation

Banking module covering bank accounts, M-Pesa tills/paybills, cash boxes, with statement import & auto-matching. Closes Core ERP gap P0.

### Schema (migration 019_banking.sql)
- `bank_accounts` — supports 6 types: bank, mpesa_till, mpesa_paybill, cash_box, credit_card, mobile_money. Tracks opening balance + computed current balance, default flag, branch link. Default cash account auto-seeded on install.
- `bank_transactions` — every cash movement with tx_type (deposit/withdrawal/transfer_in/transfer_out/fee/interest/adjustment), amount, reference, counterparty, payment_method. Foreign keys to all source records (sale, expense, customer_payment, supplier_payment, invoice_payment, transfer self-link). Reconciliation flags + statement_line_ref for audit.
- `bank_statement_imports` — imported statement sessions with period, balances, match counts, file name.
- `bank_statement_lines` — individual lines with date/description/reference/debit/credit/balance, matched flag pointing to bank_transactions.

### Service: `src/services/banking.ts` (645 lines)
- **Account CRUD** + default management (`upsertBankAccount`, `setDefaultAccount`, `deactivateAccount`)
- **Transaction recording** with auto-balance recompute (`recordTransaction`, `recordTransfer` creates linked pair, `deleteTransaction`, `markReconciled`, `unreconcile`)
- **Reconciliation summary** — splits balance into reconciled vs unreconciled (in/out/count)
- **Statement import + auto-match** (`createStatementImport`):
  - Creates import session
  - For each line, attempts auto-match against unreconciled transactions in period:
    1. By exact reference number + amount + correct direction
    2. By amount + date proximity (±2 days) + correct direction
  - Marks both line and matched transaction reconciled
- **CSV parser** (`parseStatementCsv`) — detects KCB / Equity / Co-op / M-Pesa / generic CSV formats by header keywords. Handles dd/mm/yyyy, ISO dates, comma-separated amounts. Returns `{ lines, detected_format }`.
- **Manual matching** (`matchStatementLine`) and **create-from-line** (`createTransactionFromLine`) for lines that auto-match misses.

### Auto-mirror to bank
**Every payment record auto-creates a corresponding bank_transaction** so reconciliation has data to match against:
- `sales.ts` `completeSale` — each payment in the sale → deposit (smart account picker by method)
- `accounting.ts` `createExpense` — withdrawal
- `settlement.ts` `recordCustomerPayment` — deposit
- `settlement.ts` `recordSupplierPayment` — withdrawal
- `invoicing.ts` `recordInvoicePayment` — deposit

**Smart account picker**: M-Pesa → first M-Pesa till/paybill account; bank/card/cheque → default bank; cash → cash_box. Falls back to default account.

### Pages
- `src/pages/banking.tsx` — landing page with cash-on-hand banner, account grid (cards with balance + unreconciled count), recent transactions list. Account create/edit sheet.
- `src/pages/banking-detail.tsx` — per-account view (873 lines):
  - 4 stats: current balance, reconciled balance, unreconciled in, unreconciled out
  - Transactions tab with reconcile toggle (click ✓ to un-reconcile), arrow icons, delete for manual entries
  - Statement Imports tab listing all imports with match counts
  - **New Transaction** dialog (deposit/withdrawal/fee/interest/adjustment)
  - **Inter-account Transfer** dialog (creates linked transfer_out + transfer_in)
  - **Import Statement** dialog: drag-drop CSV → preview parsed lines → set period + balances → import with auto-match
  - **Statement Import Sheet**: side-by-side view of unmatched lines with suggested transaction matches (by amount); per-line "Match to existing" or "Create new transaction" buttons

### RBAC
- 3 new permissions: `banking.view/manage/reconcile`
- Owner: all
- Manager: all banking permissions

### Routes / Sidebar
- `/banking` and `/banking/:id`
- Sidebar entry "Banking" with Banknote icon, between Invoicing and Pharmacy

### Verified
- TS clean, Cargo clean, 10/10 Rust tests pass
- CSV parser supports common Kenyan bank formats (tested mentally with KCB, Equity, M-Pesa statement headers)
- Auto-balance recomputed on every txn insert/delete

### Phase 5 future batches
- Bank statement export (CSV/Excel) for accountants
- M-Pesa C2B SMS parser (paste M-Pesa SMS → auto-create txn)
- Pesalink / RTGS payout integration
- Multi-currency support (FX rate table + transaction conversion)
- Cashflow dashboard (in vs out by category over time)


## 2026-05-26 — Phase 6 Batch 1: Pharmacy Compliance + Drug Allergies

Closes the highest-priority Dawa pharmacy gaps from `docs/plans/04-dawa-pharmacy-completion.md`.

### Schema (migration 020_pharmacy_compliance.sql)
- `employees.is_pharmacist` + `pharmacist_license_number` + `pharmacist_license_expiry` — track PPB-licensed pharmacists
- `prescriptions.pharmacist_id` — pharmacist who supervised the dispense (separate from cashier)
- `controlled_log` extended: `patient_id_number`, `prescribed_by`, `prescription_number`, `pharmacist_id` — full statutory fields per Pharmacy & Poisons Act (Cap 244)
- `products.ppb_registration_number`, `drug_schedule` (OTC/POM/Sched II/III/IV/controlled), `species` (human/veterinary/both)
- `patient_conditions` table — chronic illness tracking (with ICD-10 code, active flag)
- `drug_allergy_class` table — maps drug names to allergy classes (penicillin, sulfa, NSAID, aspirin, cephalosporin); pre-seeded with 12 common Kenyan drugs

### Services
- `src/services/clinical.ts`:
  - **`checkDrugAllergies(customerId, productIds)`** — at point-of-dispense, scans cart against patient's known allergies. Matches drug name patterns against allergy classes. Returns alerts with severity for each conflict.
  - **`listConditions/addCondition`** — patient chronic conditions CRUD
  - **`listPharmacists`** — roster of PPB-licensed staff for prescription supervisor dropdown

### Controlled Substances Daily Register
- `src/pages/controlled-register.tsx` — `/pharmacy/controlled-register`
  - Date-paged table of every controlled drug movement
  - Columns: time, drug, action (dispense/receive/adjust/destroy), qty, patient + ID #, prescriber, supervising pharmacist, license #, balance, cashier
  - PDF export (landscape A4 with autoTable, signature lines for pharmacist + license + date)
  - Print button
  - Compliance footer documenting statutory requirements
- Linked from Pharmacy page top action bar

### POS Allergy Alert Banner
- `src/components/pos/allergy-alert-banner.tsx`
- Sits above cart items in POS
- When customer is selected AND any cart item matches a known allergy class, shows red (severe) or amber (moderate) banner listing each conflict
- Severity-driven copy: severe → "Do NOT dispense without confirming with prescribing doctor"; otherwise "Confirm with patient"
- Dismissible per-cart

### Employee Form Updates
- "Registered Pharmacist (PPB licensed)" checkbox
- When checked: PPB License # + license expiry fields appear

### Verified
- TS clean, Cargo clean, 10/10 tests pass
- Migration uses ALTER for existing tables (idempotent), drug_allergy_class seeded via INSERT OR IGNORE

### Phase 6 future batches (P3 deferred)
- Bulk drug import from PSK directory CSV
- Cold-chain temperature logs + reminders
- Pediatric weight-based dose calculator
- HS code (3004.*) auto-suggest for pharmacy items
- Patient SMS refill reminders (we have the SMS stub already)
- Veterinary pharmacy split (species selector at dispense)
- AMR surveillance report (antibiotic usage)


## 2026-05-26 — Phase 7 Batch 1: Omnix Retail Module

New module for general retail (cosmetics, mini-marts, dukas, gift shops). Activates a different sidebar nav and feature set when selected.

### Schema (migration 021_retail.sql)
- `brands` — name, country of origin, logo, description
- `products.brand_id` + `sku_short` + `unit_of_sale` + `sold_by_weight` + `price_per_unit` + `image_path`
- `product_variants` — color/size/shade per product, with own SKU, barcode, stock, image, price overrides
- `retail_price_lists` — Retail/Wholesale/Staff/VIP tiers (4 seeded)
- `retail_price_list_items` — per-item or per-variant pricing with min_quantity bulk tiers
- `customers.price_list_id` — assign a customer to a price tier
- `shrinkage` — damage/expired/theft/spillage/correction/sample tracking
- `laybys` + `layby_items` + `layby_payments` — installment sales
- `special_orders` — pre-orders / customer-requested items not in stock

### Service (`src/services/retail.ts`, 597 lines)
- **Brands**: CRUD with product count
- **Variants**: CRUD with product link
- **Price lists**:
  - `resolvePrice(product, variant, qty, customer)` — picks the best price using customer's assigned list, falls back to default; respects min_quantity bulk tiers; variant-level override beats product-level
- **Shrinkage**:
  - `recordShrinkage` decrements stock from latest batch + writes stock_movements entry
  - `getShrinkageSummary` returns per-reason aggregates with cost impact
- **Laybys**:
  - `createLayby` — auto-numbers (`LB-202605-0001`), validates deposit ≤ total, records initial deposit as a payment
  - `recordLaybyPayment` — auto-completes layby when balance hits 0
  - `cancelLayby` — supports refund record
  - Auto-marks expired (status=active + past expires_at)
- **Special orders**: pending → ordered → received → fulfilled (or cancelled) workflow

### Pages
- `/retail/brands` — grid of brand cards with product counts, sheet form
- `/retail/laybys` — tabbed (active/completed/cancelled/expired) with totals banner; New Layby dialog with multi-line items + deposit; detail sheet with payment recording, item list, payment history, cancel
- `/retail/special-orders` — tabbed by status; each row has status-aware action buttons (pending → Order, ordered → Mark Received, received → Fulfill); sheet form with multi-line items + customer autocomplete
- `/retail/shrinkage` — Records tab + Summary by Reason tab; period filters; record dialog with product autocomplete that auto-fills cost from buying price; live total loss calculation

### Module Activation
- New `ModuleId` type: `dawa | retail | hardware | electronics | salon | restaurant | core`
- Retail module added to `MODULE_DEFINITIONS` with status='available'
- New `RetailLogo` SVG (orange/amber gradient with shopping bag + sparkle)
- Modules picker (`/modules`) lists Retail with feature bullets
- Setup wizard auto-shows Retail option (iterates MODULE_DEFINITIONS)

### Sidebar Module-Awareness
- Sidebar `NavItem` now supports `module?: string` field
- Items with module set are filtered out unless that module is the active one
- **Pharmacy nav** → only shows when `dawa` module active
- **Retail nav (Brands, Laybys, Special Orders, Shrinkage)** → only shows when `retail` module active

### RBAC
- 6 new permissions: `retail.brands.manage / variants.manage / price_lists.manage / shrinkage.record / laybys.use / special_orders.use`
- Owner: all
- Manager: all retail permissions

### Verified
- TS clean, Cargo clean, 10/10 Rust tests pass
- 6 migrations cumulative since v0.1.6 (016 branches, 017 HR, 018 invoicing, 019 banking, 020 pharmacy compliance, 021 retail)

### Phase 7 future batches (deferred)
- Variant manager UI on product detail page (multi-image upload per variant)
- POS variant picker popup when adding a product with variants
- Scale integration (Tauri serial/HID command + auto-weight pull)
- Customer-facing display window (second monitor)
- Quick-add multi-row product entry page
- Brand performance + category mix reports
- Carton/UOM conversion (sell by piece, buy by carton)
- Retail dashboard with footfall + brand top-sellers


## 2026-05-26 — Phase 8 Batch B: Native UI Form Controls

Added missing form-control primitives in Windows-11 native style.

### New components
- `src/components/ui/select.tsx` — base-ui Select with native trigger styling (h-8, 13px, ChevronDown), 80ms popup transition, h-7 items with check indicator
- `src/components/ui/switch.tsx` — Win11 pill style: 32×16 track, 12×12 thumb, 80ms snap (no bounce), primary/input track colors
- `src/components/ui/checkbox.tsx` — 14×14 with 3px corner radius, 1px border, primary fill on check
- `src/components/ui/radio-group.tsx` — 14×14 round, primary inner dot, 80ms transition
- `src/components/ui/progress.tsx` — base-ui Progress, 1px tall, primary fill, 150ms ease

### Verified
- TS clean, Cargo clean, 10/10 tests pass
- All using base-ui (consistent with rest of UI library)

### Phase 8 future batches (deferred until needed)
- Toast styling (sonner already styled, but could match native banner shape)
- Native custom title bar with traffic-light controls (replace OS chrome)
- Skeleton refinements for table rows


## 2026-05-26 — Phase 7 Batch 2 + Batch 3: Variants in Product Panel + POS Picker + Retail Dashboard + Cashflow

### Variant Manager (Phase 7 Batch 2)
- **`src/components/inventory/product-panel.tsx`** rewritten with module-aware tabs:
  - **General** tab — universal fields (always shown)
  - **Pharmacy** tab — only when active module is `dawa` (uses new Switch component)
  - **Retail** tab — only when active module is `retail`. Brand selector, short SKU for keyboard entry, unit-of-sale (piece/pack/kg/g/L/ml/m/dozen), sold-by-weight toggle with price-per-unit field
  - **Variants** tab — only when retail + editing existing product. Inline add/edit/delete table for color/size/shade variants. Each variant has own SKU, barcode, price overrides (NULL = inherit), stock qty, active flag.
- Uses new shadcn Switch + Checkbox primitives consistently

### POS Variant Picker (Phase 7 Batch 3)
- **`src/components/pos/variant-picker.tsx`** — modal that auto-opens when adding a product with variants
  - If product has 0 variants: silently passes through (adds product directly)
  - If product has variants: shows pickable list with variant name, attrs (color/size/shade), SKU, price, stock; out-of-stock variants disabled
  - Selected variant becomes its own cart line: `Product Name — Variant Name`, with variant's selling_price (or product fallback) and product's tax_rate
- Wired into `pages/pos.tsx` so handleAddProduct now defers to the picker before adding

### POS Quick-Cash Buttons
- Cash payment now has 6 quick-add chips: +50/+100/+200/+500/+1000/+2000 plus "Exact" and "Clear"
- Live change calculation in green when amount tendered > total
- Disabled for non-cash methods

### Retail Dashboard
- New `src/services/retail-reports.ts`:
  - `getRetailKpis` — total revenue/orders/avg order/units sold + shrinkage cost + active layby balance + pending special orders
  - `getBrandPerformance` — top 20 brands by revenue with units & SKU count
  - `getCategoryMix` — % of revenue per category, sorted
- New `src/pages/retail-dashboard.tsx` — `/retail/dashboard`
  - 4-stat KPI grid + 3 status cards (shrinkage, layby balance, pending orders)
  - Brand Performance table (top 8)
  - Sales by Category with horizontal % bars (visual, no chart lib needed)
  - Period date-range filter
- Sidebar "Retail Insights" entry, retail module-gated

### Banking Cashflow View (rounds out Phase 5)
- New `src/services/cashflow.ts`:
  - `getCashflowDaily` — money in/out/net per day
  - `getCashflowBySource` — classifies transactions by source (POS Sales / Invoice Payments / Customer Payments / Supplier Payments / Expenses / Inter-account Transfers / Bank Fees / Manual)
- Added third tab "Cashflow" to Banking page
  - 3-stat header (Total In / Total Out / Net, color-coded)
  - Daily Movement: 15-day mini bar chart with green/red bars, net column
  - By Source: tabular breakdown showing where money came from / went to

### Verified
- TS clean across all modifications
- Cargo clean, 10/10 Rust tests pass

### Phase 7 Status
- Batch 1 ✅ Migration + brands + price lists + laybys + special orders + shrinkage
- Batch 2 ✅ Variants in product panel
- Batch 3 ✅ POS variant picker + quick-cash + retail dashboard
- Pending: Scale integration (needs hardware to test) · Customer-facing display window · Quick-add multi-row entry · Carton/UOM conversion


## 2026-05-26 — POS Redesign + Dashboard Color + Quick Add + Statutory Exports + User-Branch Assignment

### POS Redesign (full rebuild, follows /design skill rules)
Old POS was sparse — left search, right cart, no context. Real Kenyan retail POS systems show much more at once.

**New layout** (`src/pages/pos.tsx`, 720 lines):
- **Top status bar**: module-aware gradient header (Dawa = teal/emerald/cyan, Retail = orange/amber/rose, Core = amber/yellow/orange)
  - Today's stats inline: # sales, revenue, cash, M-Pesa
  - Shift indicator (open/closed with traffic-light dot, click to manage)
  - Branch + cashier name + live clock
- **Quick action toolbar** (row 2 of header): Park (F2), Returns, Discount (F3), Quantity ×N multiplier, Clear (F1) — all hotkey-labeled
- **Left rail (140px)**: Categories with category-colored dots
  - "Popular" pseudo-category at top (amber accent)
  - Each category gets a deterministic warm color from the palette (12 hues, no AI-default blue/purple)
- **Center grid**: visual product cards in 3-5 column grid
  - Category color dot top-left, stock badge top-right (rose/amber/emerald based on stock vs reorder level)
  - Out-of-stock products dimmed and disabled
  - Status row above: "X matches for query" / "X in Category" / "Popular last 30 days" + low-stock alert link
- **Right cart panel**:
  - Cart header with item count badge + qty multiplier badge
  - Customer picker, drug interaction alerts, allergy banner
  - Numbered cart lines with hover-reveal substitute/delete
  - Quantity stepper, unit price, line total, line numbers
  - Totals box with module-accent color on Total row
  - Pay button uses module-accent gradient + shadow + grand total + F4 hotkey
  - Discount button shows current discount inline

**Helper services** (`src/services/pos-helpers.ts`):
- `getTodaySalesSummary` — count, revenue, cash/M-Pesa/card splits
- `getPopularProducts(limit)` — top by units sold last 30 days
- `getLowStockProducts` — items at/below reorder level
- `getProductsForCategory` — category-filtered

**Color utilities** (`src/lib/category-colors.ts`):
- Deterministic hash-based palette assignment per category (12 warm/earth tones)
- `stockColor(stock, reorder)` returns rose/amber/emerald state colors
- Refuses generic SaaS blue/purple, follows /design skill rules

### Dashboard Module-Aware Hero
- New gradient hero card at top: greeting (morning/afternoon/evening + first name) + today's revenue + transaction count
- Module-aware gradient (matches POS top bar)
- Category-colored KPI cards retained below

### Quick Add Products (deferred Phase 7 batch 4)
- New `/inventory/quick-add` page (`src/pages/quick-add.tsx`, 340 lines)
- Spreadsheet-style multi-row entry
- Default markup % helper — type buying price, click ↻, selling price auto-fills
- Margin % indicator on each row (green if >20%, amber otherwise)
- **Paste from Excel** support — multi-line tab/comma-separated data auto-populates rows
- Per-row save status (pending → saving → saved/error) with color-coded backgrounds
- Sequential save with toast summary of saved/failed counts
- Linked from Inventory page top action bar (Zap icon)

### Payroll Statutory Exports (deferred Phase 3 batch 3)
- New `src/services/payroll-exports.ts`
- 5 export formats:
  - **KRA PAYE P10** CSV (iTax format with PIN, basic, gross, NSSF, PAYE)
  - **NSSF Year 4** monthly return CSV
  - **SHIF** monthly contribution return CSV
  - **Affordable Housing Levy (AHL)** return CSV
  - **Bank Payroll File** CSV (generic Kenyan bank format with name, account, M-Pesa #, amount)
- All accessed via "Statutory Returns" dropdown on payroll run sheet
- Browser-based download via Blob + anchor element

### User-Branch Assignment (deferred Phase 2 batch 2)
- `BranchAssignmentBlock` added to user edit sheet (`src/pages/users.tsx`)
- Shows checkbox list of all branches; toggle assigns/removes via existing `assignUserToBranch` / `removeUserFromBranch`
- Hidden when only one branch exists
- New `listUserBranches(userId)` helper in `services/branches.ts`

### Verified
- TS clean
- Cargo clean, 10/10 Rust tests pass
- POS keyboard nav still works (F1=clear, F2=park, F3=discount, F4=pay, Esc=clear search)
- All existing POS flows preserved (variant picker, allergy banner, drug interactions, customer picker, held sales, substitutions, discount, payment modal)

### Design Rules Followed
- **POS is an Operate surface** — color separates tools, marks active state (selected category, low stock), gives action feedback (pay button accent)
- **60-30-10 rule** — neutrals dominate (stone/white), one secondary tone per category, accent at ~10% (pay button, total, gradient header)
- **No AI slop** — refused indigo/violet gradients, refused generic SaaS blue, used Kenyan-warm palette (amber/teal/orange/emerald)
- **Module register** — Dawa (medical/healing) in teal-cyan, Retail (commerce/warmth) in orange-rose, Core in amber-yellow
- **Stock state** as color signal (rose for OOS, amber for low, emerald for healthy)
- **Category as color identity** — deterministic hue per category id, 12-color palette


## 2026-05-26 — SMS Removal + Recurring Invoices + Cold Chain + Dose Calculator + AMR Report

### SMS Feature Dropped (per user request)
- Deleted `src/services/sms.ts` (was unimported stub)
- Updated 4 plan files to mark SMS items as dropped/deferred
- No active code referenced SMS — clean removal

### Phase 4 Batch 2: Recurring Invoices + Credit Notes

**Schema** (migration `022_recurring_invoices.sql`)
- `recurring_invoice_templates` — name, customer, frequency (weekly/biweekly/monthly/quarterly/annually), interval count, starts_on/ends_on, next_run_on, payment_terms, auto_send flag, branch
- `recurring_invoice_items` — line items per template
- `credit_notes` + `credit_note_items` — return/overcharge/discount/correction/damaged/other reasons, auto-numbered `CN-YYYYMM-XXXX`

**Service** (`src/services/recurring-invoicing.ts`, 341 lines)
- `runRecurringSchedule(userId)` — generates invoices for any template with `next_run_on <= today`; advances next_run_on by frequency × interval_count; auto-marks sent if configured
- `createCreditNote` — creates note + records as invoice payment so balance recomputes
- Auto-runs on every login (silent unless invoices generated → toast)

**Page** (`/invoicing/recurring`)
- Template list with status (active/paused), next-run date, "DUE" badge for templates due today
- Top-of-page banner when N templates are due, with one-click "Run Now"
- New template sheet: name, customer autocomplete, frequency selector, schedule fields, line items, auto-send toggle
- Pause/resume + delete actions
- Wired into Invoicing page header as "Recurring" button

### Phase 6 Batch 2: Pediatric Dose Calculator

**Component** (`src/components/pos/dose-calculator.tsx`, 215 lines)
- Weight-based dose calculation (mg/kg) with age field
- Pre-loaded 10 common Kenyan pediatric drugs: Paracetamol, Ibuprofen, Amoxicillin, Co-amoxiclav, Cefuroxime, Azithromycin, Cetirizine, Salbutamol, Metronidazole, ORS
- Per-drug fields: min-max mg/kg, dose interval (h), max per day, available formulations
- Custom mg/kg input for any other drug
- Live calculation: per-dose mg, daily total, max-per-day cap with warning, syrup volume in ml when "/5ml" formulation matched
- Disclaimer block referencing BNF for Children
- Wired into Pharmacy page top action bar (Calculator icon)

### Phase 6 Batch 3: Cold-chain Temperature Monitoring

**Schema** (migration `023_cold_chain.sql`)
- `cold_chain_units` — name, location, target min/max °C (default 2-8°C per WHO PQS), last temp + timestamp, branch
- `cold_chain_logs` — temperature readings with in_range flag, action_taken (required when out of range), notes, timestamp
- Default "Main Pharmacy Fridge" auto-seeded

**Service** (`src/services/cold-chain.ts`, 106 lines)
- CRUD for units + logs
- `wasRecordedToday` helper for the "due today" check
- Auto-flags in_range based on unit's target range; updates unit's last_temp_c / last_recorded_at on each log

**Page** (`/pharmacy/cold-chain`)
- Card grid of all units with current temperature display (color-coded)
- "Today" green badge / "Due" amber badge per unit
- Banner alert when units overdue
- Record dialog enforces action description for out-of-range readings
- Recent log table with status badges
- Edit unit form with WHO range hints
- Wired into Pharmacy page nav

### Phase 6 Batch 4: AMR Surveillance Report

**Service** (`src/services/amr-report.ts`, 176 lines)
- Pre-classified 13 antibiotic classes with 60+ drug name patterns (Penicillins, Cephalosporins, Macrolides, Fluoroquinolones, Tetracyclines, Aminoglycosides, Sulfonamides, Nitroimidazoles, Carbapenems, Glycopeptides, Antifungals, Antimalarials, Anti-TB)
- `getAntibioticByClass` — units, unique patients, revenue, dispense events per class for period
- `getTopAntibiotics` — ranked list of dispensed antibiotic products with class
- `getAmrSummary` — totals + class diversity

**Page** (`/pharmacy/amr`)
- 3-stat header (units / events / classes used)
- Per-class horizontal bar chart with 13-color palette
- Top antibiotics table with class color dots
- AMR awareness card explaining surveillance rationale
- Wired into Pharmacy page nav

### Verified
- TS clean, Cargo clean, 10/10 Rust tests pass
- 9 migrations cumulative since v0.1.6 (016-023)

### Module status (cumulative)
- Phase 1 ✅ Native UI Polish Batch A
- Phase 2 ✅ Branches (3 batches: foundation, wiring, transfer pages)
- Phase 3 ✅ Employees + HR (3 batches: setup, attendance/leave/payroll, statutory exports + user-branch)
- Phase 4 ✅ Invoicing + Recurring + Credit Notes
- Phase 5 ✅ Banking + Cashflow
- Phase 6 ✅ Dawa Pharmacy completion (allergies + pharmacist + controlled register + cold chain + dose calc + AMR)
- Phase 7 ✅ Retail (variants + brands + price lists + laybys + special orders + shrinkage + dashboard + quick-add)
- Phase 8 ✅ Native UI Batch B (Switch/Checkbox/Select/RadioGroup/Progress)
- Phase 9 ⏸ Website (deferred per user instruction)

### Open items
- Customer-facing display window (Tauri secondary window — needs experimentation)
- M-Pesa C2B SMS parser (dropped — SMS out of scope)
- Carton/UOM conversion (Phase 7 P3, deferred)
- Scale integration for sold-by-weight (needs hardware)


## 2026-05-26 — Bug Fixes + POS Cashier Workflow

### Critical Bug: `business_settings` table doesn't exist
The actual table name is `settings`. 6 service files referenced `business_settings` which never existed. Fixed:
- `src/stores/active-module.ts` — module persistence (was probably never persisting)
- `src/services/shift-handover.ts` — shift handover business name lookup
- `src/services/drug-labels.ts` — pharmacy name on drug labels
- `src/services/z-report.ts` — **the user's reported bug** (Z-report end-of-day error)
- `src/services/payslip-pdf.ts` — payslip header business info
- `src/services/invoice-pdf.ts` — invoice header business info

All now query the correct `settings` table. Every area that uses business name/phone/PIN now resolves.

### POS Cashier Workflow — Open Day, Close Day, Petty Cash, Z-Report

The user pointed out cashiers can't operate end-to-end from POS. Fixed by adding 5 new in-line POS dialogs:

**Open Shift dialog** (top-bar shows when no shift open)
- Counts opening cash with quick-preset chips (0/500/1000/2000/5000/10000)
- Won't allow sales until a shift is opened
- Pay button on cart was already disabled when no shift; now there's a clear path to fix it

**Close Shift dialog** (top-bar Lock icon when shift open, or "Close Day" button in toolbar)
- Auto-loads shift summary: opening cash + cash sales + petty cash in − petty cash out = expected cash
- 3 stat cards: # sales, M-Pesa total, Card total
- Actual cash counted field
- Live variance calc: "Short by KES X" or "Over by KES X" or green "Balanced"
- Variance reason required if not zero
- Closes shift in DB

**Petty Cash dialog** (toolbar Petty Cash button, requires open shift)
- Two-tile picker: Cash Out (rose) or Cash In (emerald)
- Amount + reason required
- Routes to existing petty_cash service which already wires to bank transactions

**Z-Report quick action** in toolbar — direct link to `/reports/zreport`

**Visible shift status** in top bar — clickable:
- "No shift · Open now" (rose, click → opens dialog)
- "Shift open · KES X" (white pill with green pulsing dot, click → close dialog)

### POS Low-Stock Visibility (red alert in POS)
- Was just a small text link before; now expanded panel
- Status row above product grid shows "X low stock — click to view" in **rose**
- Click expands a rose-banner panel listing each low-stock item with current/reorder
- "Create purchase order →" link inline

### Receive Stock Dialog (answers "how does someone add stock?")
The user asked how to add stock. Existing options:
1. **Purchase Orders** (full GRN flow with supplier accounting) — unchanged
2. **Initial stock** when creating a product — unchanged
3. **Quick Add multi-row** — unchanged

NEW: **Receive Stock** quick dialog accessible from inventory page top bar.
- Multi-line spreadsheet: product search → add line → set qty/buy price/expiry/batch number
- Creates a `batches` row + `stock_movements` audit entry per line
- Supplier name + reference fields for traceability (delivery note number)
- Total receive cost computed live
- Highlighted in green (`bg-emerald-50`) so cashiers/managers see it immediately
- For pharmacy items expiry warning shows
- Branch-aware (uses active branch)

### How adding stock works (documented for the user)
**To add new stock to existing products:**
1. Go to **Inventory** page
2. Click the green **Receive Stock** button (top bar)
3. Search product → set quantity, buy price, expiry (if pharmacy), batch number → repeat for all items in delivery
4. Click "Receive N Items" — adds batches to current branch

**For supplier-tracked stock:**
1. Go to **Purchases** in sidebar
2. Create Purchase Order → submit → when delivery arrives, click "Receive" on the PO
3. This creates batches AND records the supplier liability (accounts payable)

**For brand-new products:**
1. **Inventory** → **Add Product** (single product with optional initial stock)
2. Or **Inventory** → **Quick Add** (spreadsheet for many at once, paste from Excel)

### Verified
- TS clean, Cargo clean, 10/10 tests pass
- Z-report end-of-day no longer crashes
- All references to `business_settings` eliminated


## 2026-05-26 — Tips & Gratuities + Carton/UOM Conversion

### Tips Module (Phase 4 Batch 3)
For service industry SMEs (restaurants, salons, hospitality, hotels). Tips are tracked separately from revenue since they belong to staff, not the business.

**Schema** (migration `024_tips.sql`)
- `sales.tip_amount` + `sales.tip_employee_id` columns
- `tip_distributions` table for weekly tip pooling logs
- Default settings seeded: `tips.enabled=0` (off by default), `tips.default_percentages='5,10,15,20'`, `tips.assign_to_staff=0`, `tips.distribution_method='direct'`

**POS Tip Dialog** (`src/components/pos/tip-dialog.tsx`)
- Quick % buttons (configurable, default 5/10/15/20) with KES preview
- "No tip" pill, custom amount field
- Live preview showing Bill + Tip = New total
- Optional employee selector when `tips.assign_to_staff=1`
- Heart icon (rose theme) — distinct from monetary actions

**POS Integration**
- "Tip" toolbar button (Heart icon) shows current tip as badge value
- Cart store has `tip` + `tipEmployeeId` state, persisted to local storage
- Cart total includes tip; tip line shows in totals box (rose color, clickable to edit)
- `completeSale` now passes tip + employee → recorded on sales table
- Cart clears tip on new sale

**Tips Report** (`/reports/tips`)
- Settings card: enable/disable tips, toggle staff assignment, configure default %
- Period filter (default last 30 days)
- 4-stat row: total tips, tipped sales count, avg tip, cash tips
- 3-method breakdown cards: Cash / M-Pesa / Card with horizontal bar charts
- "By Staff Member" table with role, count, total, average

**Z-Report Updated**
- Tip line shown when > 0
- Net sales label clarified as "Net sales (excl. tips)" to avoid confusing tips with revenue
- Tip total appears in printable Z-report HTML

### Carton/UOM Conversion (Phase 7 Batch 4)
Carton or pack-level barcodes (e.g., one carton of 24 bottles = single scan).

**Schema** (migration `025_product_uoms.sql`)
- `product_uoms` table with name (e.g., "Carton of 24"), `quantity_per`, optional carton-level barcode, optional override prices, default purchase/sale flags
- Service helpers: `listProductUoms`, `upsertProductUom`, `deleteProductUom`, `getUomByBarcode`

UI for managing UOMs at product level + POS auto-recognition by barcode is the next batch — schema and service ready.

### Verified
- TS clean, Cargo clean, 10/10 Rust tests pass
- 10 migrations cumulative since v0.1.6 (016-025)

### Tip flow walkthrough
1. Owner enables tips: Reports → Tips & Gratuities → toggle "Enable Tips at POS"
2. Cashier sees Tip button in POS toolbar
3. Click → quick % chips or custom amount → Apply
4. Tip line appears in cart totals (rose, with heart icon)
5. Pay → tip recorded on sale
6. End-of-day Z-report shows tips separately
7. Manager runs Tips Report to see who earned what


## 2026-05-26 — UOM Manager UI + POS Carton Recognition + Customer-Facing Display

### UOM Manager UI (Phase 7 Batch 4 cont.)
- Added "Cartons / Packs" tab to product panel (visible only when retail module active and editing existing product)
- Inline CRUD: add/edit/delete pack sizes per product
- Fields: pack name (e.g., "Carton of 24"), units per pack, optional pack barcode, optional override prices
- Default purchase / default sale flags
- Hint banner explaining how POS recognizes scanned carton barcodes

### POS Carton Recognition
- POS search/scan now first checks `getUomByBarcode(search)` before falling back to product search
- When a carton barcode is scanned:
  - System adds the parent product to cart
  - Quantity is set to `quantity_per` from the pack
  - Cart line shows `Product Name — Pack Name`
  - Pack price used if defined, else falls back to base × qty
  - Toast confirms: "Added: Carton of 24 (24 units)"
- Falls through to regular product search if no UOM match

### Customer-Facing Display Window (Tauri secondary window)

**Why**: Customers see what's being rung up in real-time on a second screen — builds trust, prevents disputes.

**Helper** (`src/lib/customer-display.ts`):
- `openCustomerDisplay()` — creates a second `WebviewWindow` at `/customer-display` (1280×720, draggable to second monitor)
- `closeCustomerDisplay()`, `isCustomerDisplayOpen()`, `toggleDisplayFullscreen()`
- Reuses focus when already open

**Page** (`src/pages/customer-display.tsx`) — `/customer-display` route
- **Idle state**: Module-aware gradient welcome screen with logo, business name, "Karibu — welcome", live time/date
- **Active sale**: Dark theme (stone-900) with module gradient header
  - Item table with product name, qty, unit price, total in large readable text
  - Last item highlighted (subtle bg) so customer's eye lands there
  - Totals footer: subtotal/discount/tax/tip + giant 7xl mono total in bottom right
- Uses module accent (Dawa teal, Retail orange, Core amber)

**Cart Sync Across Windows** (`src/stores/cart.ts`):
- Tauri windows don't share localStorage — each is its own webview
- Added Tauri event-based sync: every cart store change emits `cart:updated` event
- All windows subscribe and reconcile their state when receiving incoming events
- 50ms debounce so rapid edits don't spam events
- Skips re-emit if state already matches (prevents loops)

**POS Toolbar Button**: "Customer Display" button (Monitor icon) opens the second window. Cashier moves it to the second monitor manually (or fullscreens with toggle).

**Tauri Capabilities**: Updated `default.json` to allow:
- `core:webview:allow-create-webview-window` (creating second window)
- `core:window:allow-set-focus`, `set-fullscreen`, `is-fullscreen`
- `core:event:allow-emit`, `allow-listen` (cross-window cart sync)
- Added `customer-display` to allowed windows list

### Verified
- TS clean
- Cargo clean
- 10/10 Rust tests pass
- Customer display routes outside AppShell (no sidebar/topbar — full-bleed display for customer view)

### What's left (low priority, hardware-dependent)
- Scale integration for sold-by-weight (needs USB/serial hardware to test)
- Phase 9 Website (deferred)
- CircleCI env var setup (waiting on user tokens)


## 2026-05-26 — Module Architecture Refactor + Fixes

### Single-Source-of-Truth Module Registry
Previous approach sprinkled `module: "dawa"` props across sidebar items, command-palette items, and various components. Brittle and hard to maintain. Replaced with one registry.

**`src/lib/module-features.ts`** — declares which routes belong to which module:
- `FEATURE_OWNERS` map: route path → owning module (`dawa` | `retail` | etc.)
- Routes NOT in the map are core features (always available)
- `getFeatureModule(path)` — returns owner or undefined
- `isFeatureAvailable(path, activeModule)` — boolean check
- `filterByActiveModule(items, module)` — array filter

**Refactored consumers**:
- `components/layout/sidebar.tsx` — uses `isFeatureAvailable(item.to, activeModule)`. NavItem interface no longer has `module` field.
- `components/layout/command-palette.tsx` — uses `filterByActiveModule(pages, activeModule)`. PageItem no longer has `module` field. Prescription DB query also gated to dawa module.
- `components/require-role.tsx` — route guard now checks `getFeatureModule(pathname)` and shows a clear "Module not enabled" screen with a "Manage Modules" CTA when accessing wrong-module routes via direct URL.
- `pages/dashboard.tsx` — "Expiring Soon" mini card uses `isFeatureAvailable("/pharmacy/expiry", moduleId)`.

**To add a new module-specific feature now**:
1. Add a route in `App.tsx`
2. Add the path to `FEATURE_OWNERS` in `module-features.ts`
3. Sidebar, palette, route guard all gate it automatically — no per-component changes

### Module-Aware Branding
**Sidebar logo**: When active module is not `core`, sidebar shows the module's logo (DawaLogo / RetailLogo) and the module's name as primary identity, with "Powered by Omnix" as small secondary text. Customer running a pharmacy sees "Dawa Pharmacy" branding, not generic Omnix.

**Login page**: Same logic — module logo + name. Sign-in screen reflects the deployed brand.

### POS Pharmacy-Only UI Gating
- `useModuleAccent()` now returns `isPharmacy` and `isRetail` flags
- **Drug interaction alerts** + **allergy banner** in cart panel: only shown when `isPharmacy=true`
- **Substitute drug** button (Pill icon) on cart line items: only shown when `isPharmacy=true`
- Retail users no longer see medical-clinical UI noise

### Sidebar Cleanup
Removed the `module:` prop from all sidebar nav items. Sidebar's `navItems` array is now flat — module gating is centralized.

### Verified
- TS clean, Cargo clean, 10/10 tests pass
- A retail user logging in:
  - Sees Omnix Retail branding in sidebar + login
  - Has no Pharmacy / Insurance Claims / Controlled Register / Cold Chain / AMR Report visible
  - POS doesn't show drug interaction alerts or substitute icons
  - Direct URL `/pharmacy` shows "Module not enabled" screen
- A pharmacy user logging in:
  - Sees Dawa Pharmacy branding
  - No retail Brands / Laybys / Special Orders / Shrinkage / Retail Insights
  - POS shows full clinical alerts
- Adding a new module-specific feature is one edit (the registry).

### Files modified
- `src/lib/module-features.ts` (NEW — 93 lines)
- `src/components/layout/sidebar.tsx`
- `src/components/layout/command-palette.tsx`
- `src/components/require-role.tsx`
- `src/pages/dashboard.tsx`
- `src/pages/login.tsx`
- `src/pages/pos.tsx`
