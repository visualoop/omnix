# Omnix — Product Report

Written 2026-07-01. Comprehensive report on Omnix, its four modules, and the surrounding commercial platform. Reads like an internal strategic document — the kind you'd give to a serious investor, distributor partner, or key hire on their first day.

---

## Executive summary

Omnix is an **offline-first Windows desktop POS and business management platform for Kenyan SMEs**, sold as four vertical modules (Dawa · Retail · Hospitality · Hardware) plus a shared commercial platform (reseller channel, affiliate program, admin-created customer accounts, in-app licensing, auto-updater signed at KRA-compliant releases).

It ships as a native Tauri v2 app (Rust backend + React frontend), stores everything on a local encrypted SQLite database, syncs across a shop's LAN, submits eTIMS to KRA automatically, and accepts payment via M-Pesa (Daraja + Paystack), card, cash, or business credit. One-time perpetual licence: KES 30,000 per module, no monthly fees.

The product is production-ready across all four modules. As of v0.28.8, ~500 vitest tests lock the money-critical paths (tax, returns, dashboard aggregates, trial lifecycle, licensing, SQL smoke tests against real schema). The commercial platform (Paystack live keys wired, M-Pesa flows working, licensing self-heal, auto-updater signature persistence) is verified end-to-end. Zero paying customers as of this document's date — the sales machine goes live this week.

---

## Market position

### What Omnix competes against

| Competitor | Type | Where they win | Where Omnix wins |
|---|---|---|---|
| **Loyverse** | SaaS POS, free tier | Frictionless signup, iPad-first UI | Free tier has no eTIMS, no offline sync, no SHA claims. Paid tier is KES 1,700/month = KES 20,400/year vs Omnix's one-time KES 30,000. |
| **Sokoni** | Kenyan SaaS POS | Local support, M-Pesa integration | Sokoni is subscription-based (KES 3,500/month), less offline-hardened, weaker inventory. Omnix owns the data locally. |
| **Vend / Lightspeed** | Global SaaS POS | Enterprise polish, integrations | 10× the price. Not built for Kenyan compliance (KRA eTIMS, SHA insurance). |
| **QuickBooks POS** | Legacy on-prem | Accounting is deeper | Discontinued in 2023 in Kenya. No M-Pesa. No mobile support. |
| **Custom Excel + paper** | The default | Free | The problem Omnix solves. Owners lose 5-10 hours/week and miss KRA filings. |
| **Homegrown Access DB solutions** | 15-year-old .NET builds | Owner already trained | No updates in 5+ years. No mobile. No cloud backup. The market is aging out. |

### Where Omnix uniquely fits

Kenyan SME with **4-15 staff**, **KES 500k-5M monthly revenue**, **needs KRA eTIMS**, **runs on Windows**, **wants to own their data locally**, **wants to pay once not monthly**. There are ~50,000-80,000 such businesses in Kenya. Omnix is competitive for all of them.

The pricing anchor — KES 30k one-time vs Loyverse's KES 20k/year — pays back in year 2 and compounds thereafter. This is Omnix's most defensible commercial edge.

---

## The core platform (shared across all modules)

Cross-cutting capabilities every module inherits automatically. This is the ~70% of the codebase that isn't module-specific.

### Point of Sale
- Fast checkout: barcode scan → add to cart → keyboard shortcuts (F2 = pay cash, F3 = M-Pesa, F4 = save cart) → receipt prints in <1 second
- Held sales (park cart, recall later)
- Split payments (cash + M-Pesa + card on one bill)
- Customer selection + credit sale
- Sale returns with reason codes, refund method routing (cash / M-Pesa / store credit), automatic KRA credit note filed
- Void, refund, receipt reprint
- Customer display (second monitor showing the cart as it builds — legally required in some verticals)
- Cash drawer kick (USB or Ethernet)
- Auto-print on sale completion (configurable)

### Inventory management
- Products, categories, brands, SKUs, barcodes (EAN-13, Code-128, QR)
- Batch tracking (batch number, buying price, expiry date, quantity)
- Stock movements (audit trail — every quantity change logged)
- Purchase orders (draft → sent → received → invoice matching)
- Goods received notes (partial receipts, over-receipts, variance tracking)
- Suppliers with credit terms, history, lead times
- Stock takes (physical count → automatic variance report)
- Stock transfers between branches (with dispatch confirmation)
- Low-stock alerts (per-product reorder level)
- Expiry alerts (30-day, 90-day, expired)
- Wastage / write-offs with reason categories
- Reorder suggestions based on velocity + lead time

### Customer relationship
- Customer profiles: name, phone, email, address, KRA PIN, credit limit, current balance
- Customer groups + price lists (contractor pricing, wholesale, retail)
- Sales history per customer
- Credit tracking + aging (0-30 / 31-60 / 61-90 / 90+)
- Lifetime value (net of returns)
- Statements + receivables aging
- Optional: automatic WhatsApp receipt on sale completion

### Suppliers + procurement
- Supplier accounts with credit terms
- Purchase order lifecycle
- 3-way match on receipt (PO ↔ invoice ↔ GRN)
- Reverse GRN with audit trail
- Supplier statement aging

### Banking + reconciliation
- Bank accounts, M-Pesa Tills, Paybills, cash boxes, credit cards, mobile money
- Bank transactions (deposits, withdrawals, transfers)
- Statement imports (CSV parse)
- Bank reconciliation UI (match, unmatch, mark as reconciled)
- Petty cash management (cash in/out with expected-cash formula)

### Accounting
- Expense tracking with categories + supplier + receipts
- Profit & Loss (revenue net of returns, COGS with FIFO, gross margin)
- Cash register open/close with variance
- Daily Z-report (KRA-compliant format)
- VAT return export (VAT3 CSV)
- Aged receivables + payables

### Tax & compliance (KRA-specific)
- eTIMS integration (KRA VSCU protocol)
- Auto-signing of every sale invoice + credit note
- Retry queue for offline scenarios (submits when online)
- HS code mapping per product
- VAT rate per product (0% / 8% / 16% supported)
- Automatic tax mode: inclusive vs exclusive vs off (per business preference)
- 15 pinned tests locking the three tax modes forever

### Insurance (Dawa-relevant, but generic backend)
- SHA (Social Health Authority) claim workflow
- Private insurer support (Jubilee, Old Mutual, Britam, etc.)
- Preauth requests
- Claim batches with settlement tracking
- Member verification API integration

### Payments
- M-Pesa STK Push (Daraja API)
- Paystack integration (M-Pesa + card + bank)
- Cash
- Business credit (customer owes)
- Bank transfer
- Cheque (recorded, doesn't clear the sale until reconciled)

### Reports
- Sales by day / week / month
- Top products
- Payment method breakdown
- Cash position
- Inventory valuation (at cost or at retail)
- Wastage by reason
- Reorder list
- Shrinkage detection (Retail module — variance between expected and actual)
- Cost-of-goods-sold with per-batch buying price
- Gross margin analysis
- Custom date-range on every report

### PDF engine (unified across app)
- Every printable document (receipt, invoice, quote, GRN, PO, P&L, Z-report, VAT3, patient card, quotation) uses the same PDF renderer
- 12 branded templates
- Consistent header, footer, watermark, terms
- Silent thermal printing (for POS receipts) + full A4 PDF (for invoices)

### Multi-device / LAN
- One "master" PC hosts the SQLite DB
- Multiple "client" PCs on the same LAN pair with master
- All read/write happens over LAN (sub-second latency)
- If a client loses LAN, it falls back to a local read-only cache
- No cloud dependency for multi-device — works entirely on the shop's Wi-Fi

### Auto-updater
- Signed releases from GitHub → checked by every Omnix install every ~8 seconds after launch
- Silent background download when a non-major update is available
- Install on graceful app close (VS Code / Electron pattern) — no interruption to trading
- Major versions (0.x → 1.x) surface a dismissible notice — never auto-applied (they're a paid upgrade)
- Signature verification (minisign) — can't install a tampered update

### Licensing
- One-time perpetual license per module (KES 30,000)
- Optional maintenance renewal (KES 12,000/year for updates + compliance changes)
- Machine binding (fingerprint = CPU + motherboard + install)
- 30-day trial with graceful expiry (7-day grace period → 23-day read-only mode → hard lock at day 60)
- Multi-machine licenses (up to 3 by default) with seat management from dashboard
- Server + client sides both self-heal against schema drift

### Backup + data safety
- Automatic local backup every 24 hours + on shift close
- Backup restore UI
- Optional encrypted cloud backup (Cloudflare R2, KES 500/month add-on)
- Point-in-time restore
- Export to CSV / Excel / JSON

### Audit log
- Every user login
- Every void, refund, price change, permission change
- Every payment (with actor + timestamp + IP)
- Every setting change
- Immutable append-only log (protects against local edit)

### Roles + permissions
- Owner / Manager / Cashier / Viewer role hierarchy
- Fine-grained permission set (~80 permissions across the app)
- Custom roles with permission checkboxes
- Groups for bulk assignment (e.g. "Nairobi Cashiers" group with retail-cashier role)
- Access explorer: "why can/can't this user do X" (traces role → permission → deny)

### Settings & configuration
- Business profile (name, contact, KRA PIN, logo)
- Branches (multiple physical locations, per-branch reports)
- Payment methods (enable/disable, custom methods)
- Tax rates (per-product override + global fallback)
- Categories (hierarchical, unlimited depth)
- Price lists (customer-group discounts, contractor pricing)
- Printer setup (auto-print, drawer kick, preferred printer)
- Barcode scanner test panel (verify terminator + speed)
- Customer display setup (second monitor + layout)
- AI integration (Groq / OpenRouter / OpenAI / DeepSeek / Gemini — configurable per feature)

### AI assistant (opt-in, per-machine license enables)
- Natural language queries: "What did I sell today?" / "Which products are running low?"
- Setup wizard (AI reads your business profile and configures categories, tax rates)
- Product enrichment (AI cleans up product names, adds descriptions, categorizes)
- eTIMS explanation (AI decodes KRA rejection messages into plain English)
- Draft response templates
- Runs on FREE tier by default (Groq / Gemini / OpenRouter free) — cost only if user brings paid keys

---

## Module 1 · Dawa (Pharmacy management)

**Status**: Production. First module built. Deepest feature set.

### The buyer
- Pharmacist-owner, age 30-55, PPB-licensed
- 1-3 branches
- KES 500k-3M monthly revenue
- Sells to walk-in customers + regular refill customers + SHA/insurance members
- Terrified of KRA eTIMS fines (KES 10,000/day potential penalty from March 2026)

### The hook
**"Pharmacy software that KRA compliance is already handled in, SHA claims file themselves, batch expiry never surprises you again."**

### Signature features (Dawa-specific, on top of core)
- **Prescriptions** — issued by doctor with prescriber info, drug + dose + duration + refills allowed
- **Doctor register** — every prescribing doctor tracked with reg number
- **Drug interaction check** — active-ingredient database, warnings on dispense
- **Controlled substance register** — schedule I-IV drugs tracked separately (KES + KRA + PPB compliance)
- **Cold chain monitoring** — batches flagged if temperature-sensitive (vaccines, insulin)
- **AMR (Anti-microbial resistance) awareness** — antibiotics flagged, over-prescription patterns surfaced
- **Refill tracking** — patient's chronic medications automatically nudged for refill
- **Patient profiles** — allergies, chronic conditions, insurer, prior prescriptions
- **SHA insurance claims** — end-to-end from preauth → claim → settlement
- **Private insurance workflow** — Jubilee, Old Mutual, Britam, CIC, Sanlam member verification + claim submission
- **Batch expiry write-off** — expired stock removed from inventory with reason (Expired / Damaged / Return-to-supplier), audited, feeds the wastage report
- **Dispense-time expiry warning** — amber toast when dispensing a batch <30 days from expiry
- **Wastage report** — per-reason breakdown, total cost, drives supplier claims for expired stock returns

### Complements the core with
- Every patient card + prescription is PDF-printable
- KRA VSCU submission on every dispense (eTIMS)
- SHA claim files as separate line items, batched by month for insurer settlement
- Expiry alerts embedded in POS: cashier sees a warning before ringing up an expiring item

### Sweet-spot customer profile
- Independent pharmacy (not a chain outlet — those buy centrally)
- 1-2 branches
- KES 500k-2M/month revenue
- 200-800 SKUs
- Owner-operated, owner sits at the counter part of the day
- Currently doing paperwork after 6pm to close the day

### Nairobi neighborhoods where Dawa density is highest
- Kilimani + Karen (upmarket, 100+ pharmacies)
- Westlands + Riverside
- CBD (dozens of small pharmacy corner shops)
- Eastlands (Kariobangi, Mathare, Buruburu — high volume, low margin)
- Kikuyu, Kiambu, Ruaka (peri-urban suburbs, growing)
- Coastal (Mombasa Old Town, Nyali) — different pace, worth a trip for demos
- Kisumu, Nakuru — 2nd-tier cities, expansion Phase 2

---

## Module 2 · Retail (Mini-marts, dukas, salons, spa, general retail)

**Status**: Production.

### The buyer
- Shop owner, age 25-60, often the till operator herself
- Bought stock this morning from a distributor, selling it all week
- 200-800 SKUs (mostly FMCG + basic groceries + toiletries)
- Struggles with M-Pesa reconciliation, shoplifting, "why doesn't the till match the shelf"

### The hook
**"Software that reconciles your M-Pesa Till with your cash drawer at 6pm, tells you exactly what you made, flags shrinkage."**

### Signature features (Retail-specific)
- **Brand tracking** — most retail shops sell 50-100 brands (Bidco, Kabras, Cadbury, etc.); brand-level reports show which brands sell fastest
- **Layby (installment sales)** — customer pays 30% now, takes goods later, rest in 2 installments; full audit trail
- **Special orders** — customer requests something you don't stock; you order it in, notify them when arrived
- **Shrinkage detection** — physical count vs system count = variance; flags who was on shift when it happened
- **Bulk import products** — CSV upload for 500+ SKUs at once (with barcode + price + supplier)
- **Quick-add product** — barcode scan of a new item → 3 fields → done (for cashier speed)
- **Customer-facing display** — second monitor showing what's being rung up (theft deterrent + trust builder)
- **Retail dashboard** — daily KPIs (revenue, margin, top brand, shrinkage flag)
- **Optional AI**: setup wizard reads a stock spreadsheet + auto-categorizes 500 products

### Complements the core with
- Multi-supplier per product (buy same SKU from two distributors)
- Volume discount pricing (per-quantity price break)
- Weekend / holiday hour tracking (staff shifts)
- Petty cash reconciliation at close of day

### Sweet-spot customer profile
- Mini-mart / duka with 200-800 SKUs
- KES 200k-1M/month revenue
- 2-5 staff on shift
- Owner does the books manually right now
- Located in a residential area (Kikuyu, Ruaka, Kilimani, Eastlands, Ngong)

### Retail-specific pitch
- The killer moment: cash drawer close-of-shift. Physical KES 12,340 in the drawer, system says KES 12,600 expected → variance of KES 260. Show them where it came from (M-Pesa deposit for a sale, cash withdrawal for petty cash, wrong change given). Owner nods, understands the app is smarter than their head.

---

## Module 3 · Hospitality (Restaurants, bars, hotels, lodges)

**Status**: Production. Newest module (built Phase 3).

### The buyer
- Restaurant manager or chef-owner, age 30-50, comfortable with technology
- Has been burned by cheap POS before (they crashed, staff lost orders, chef couldn't read the ticket)
- Wants: reliability, split-bill support, kitchen order tickets, table management

### The hook
**"POS that doesn't lose the order between the waiter and the kitchen, and split-bills between four M-Pesa numbers on one table without breaking."**

### Signature features (Hospitality-specific)
- **Table management** — layout editor (drag tables to match your floor plan), status: free / occupied / paying / cleaning
- **Order at table** — waiter takes order on iPad or POS terminal; syncs across all shifts
- **KOT (Kitchen Order Tickets)** — kitchen printer receives the food items only, bar printer receives drinks separately
- **Split payments** — one table's bill split by 4 customers, each with different M-Pesa/cash
- **Recipe costing** — every menu item mapped to raw ingredients + quantities; recipe changes flow to COGS
- **Menu engineering** — flag high-margin low-volume items (stars) vs low-margin high-volume (workhorses) vs low-margin low-volume (dogs — drop them)
- **Room bookings** (hotels) — reservation, check-in, check-out, room service linked to folio
- **Folios** — running tab per room, itemized by category (food, drinks, laundry, sundries)
- **Housekeeping** — room status (clean / dirty / in-service / out-of-order)
- **Service charge** — auto-applied 10% (configurable)
- **Tipping** — allocated per-server, appears on payroll
- **KOT wastage** — pending orders that didn't make it to a bill (chef made a mistake, sent food back)
- **Menu categories** — starters, mains, drinks, desserts, specials

### Complements the core with
- POS integrates with reservation system
- Automatic 16% VAT + optional TCA (Tourism Catering Association levy)
- SHIF (Social Health Insurance Fund) claims where applicable (rare in hospitality but supported)

### Sweet-spot customer profile
- Single-location restaurant, 20-60 seats, 4-8 staff
- KES 500k-3M/month
- Currently uses paper KOT + Excel for reservations
- Beach lodges in Diani, Watamu, Malindi — underserved by Nairobi-based sales
- Nairobi restaurants in Westlands, Karen, Kilimani

### Hospitality-specific pitch
- Restaurants have been burned by cheap POS. They pay more for reliability. The killer demo: "Send an order to the kitchen while offline. Reconnect. Watch the print job flow through." Restaurant owners' eyes light up.
- Killer feature: split-bill screen. Owner sees "$400 bill, 4 people, 2 pay cash, 2 pay M-Pesa" — done in 30 seconds.

---

## Module 4 · Hardware (Hardware stores, building materials, contractor accounts)

**Status**: Production. Deliberately the last-launched module.

### The buyer
- Hardware store owner, age 40-70, sceptical of software (has resisted for 10 years)
- Bought their shop 15 years ago, knows every regular customer's name
- Sells 500-2000 SKUs (cement, iron sheets, pipes, paints, tools, screws)
- Contractors buy on credit; keeps a paper credit ledger; loses track

### The hook
**"Software that gives your contractors accurate quotes in 40 seconds, prints delivery notes with signature blocks, and shows you which contractors owe how much."**

### Signature features (Hardware-specific)
- **Bulk pricing tiers** — per customer group (retail / trade / contractor / distributor)
- **Contractor accounts** — customer with credit limit, per-order limit, aging report
- **Delivery notes** — signed by receiver, converts to invoice on demand
- **Quotations** — customer-facing PDF quote, valid for X days, one-click convert to invoice
- **Quotation-to-invoice conversion** — quote accepted → converts to invoice + reserves stock + adjusts contractor credit
- **Bulk material handling** — pieces + weight + volume (cement in bags + kg + cubic-meters)
- **Custom units** — sold by piece, meter, kg, roll, bundle, pack
- **Reports** — margin per contractor, credit exposure, delivery note aging
- **Hardware commission tracking** — sales reps commissioned per invoice (adjustable %)
- **Hardware account settings** — credit terms, discount tiers, payment schedules

### Complements the core with
- Weight-based pricing (some items priced per kg not per piece)
- Multi-unit conversion (buy in kg, sell in pieces, track in both)
- Bulk pack tracking (sold in packs of 10, priced per pack)
- Optional VAT-inclusive pricing (hardware trade often prices net of VAT)

### Sweet-spot customer profile
- Physical hardware store on Enterprise Road, Landhies Road, Kariokor, Kariobangi, Ruaraka, Industrial Area
- 500-2000 SKUs
- KES 1M-5M/month
- 3-8 regular contractor accounts
- Owner + son + 2-3 staff
- Currently uses paper quote book + Excel + paper ledger for contractor accounts

### Hardware-specific pitch
- Longer sales cycle — hardware owners buy face-to-face, not on WhatsApp. Prospector generates lead list, but you visit in person.
- Killer moment: contractor walks in for cement → search "50kg cement" → contractor pricing auto-applies → quote → convert to invoice → print delivery note. All in 40 seconds. Owner watches their son do it and understands.
- Under-served market: no Kenyan-specific hardware POS exists. Loyverse doesn't handle bulk pricing. Hardware store owners have been ignored by tech.

---

## Business model

### Revenue streams

| Stream | Model | Est. year-1 contribution |
|---|---|---|
| **Module license** | KES 30,000 one-time (KES 15k launch) | 90% |
| **Maintenance renewal** | KES 12,000/year (year 2+) | 10% (kicks in year 2) |
| **Add-ons** (optional) | Cloud backup KES 500/month; extra machine seat KES 5,000/one-time; extra branch KES 3,000/one-time | 5% |
| **AI premium** (BYOK) | User brings their own API keys — no revenue to Omnix, but keeps churn low | 0% |
| **Reseller channel** | 20-30% commission to partners on their sales | Cost, not revenue — but drives volume |
| **Affiliate program** | 33% one-time referral commission | Cost, not revenue — but drives virality |
| **Enterprise / custom** | KES 200,000+ development fee for custom modules or migrations | Rare in year 1, larger in year 2+ |

### Unit economics (per customer)

| Line | Amount |
|---|---|
| Gross revenue (launch price) | KES 15,000 |
| Gross revenue (standard price) | KES 30,000 |
| Reseller commission (if via reseller) | -KES 3,000 to -KES 9,000 |
| Affiliate commission (if via affiliate) | -KES 5,000 to -KES 10,000 |
| Payment processing (Paystack 2.9%) | -KES 400 to -KES 900 |
| Petrol / travel for install | -KES 500 |
| Support cost (avg. 2 hrs × KES 500/hr) | -KES 1,000 |
| **Net margin per customer** | KES 3,000-15,000 |
| **Renewal revenue year 2+** | KES 12,000/customer/year (~KES 10,000 net after processing) |

At 100 customers: KES 300,000-1,500,000 year-1 net, KES 1,000,000/year recurring year 2+.
At 500 customers: KES 1.5M-7.5M year-1 net, KES 5M/year recurring year 2+.

### Ideal customer acquisition mix (year 1)

| Channel | Target % | Notes |
|---|---|---|
| Direct outreach (WhatsApp + walk-in) | 40% | Founder does 100% of these month 1-3 |
| Reseller channel | 30% | Ramp from 0% month 1 to 40%+ by month 6 |
| Affiliate program | 15% | Compounds — starts month 3, dominant by month 12 |
| Inbound (WhatsApp Status + Facebook + word of mouth) | 15% | Depends on founder marketing consistency |

---

## Technical architecture (short)

- **Shell**: Tauri v2 (Rust backend + WebView frontend)
- **Frontend**: React 19 + Vite v5 + TypeScript strict
- **UI**: shadcn/ui + Radix (theme-customized) + Tailwind v3 + Phosphor icons + Framer Motion
- **State**: Zustand
- **Router**: react-router-dom v6
- **Local DB**: SQLite via `tauri-plugin-sql` + SQLCipher encryption
- **Auth**: local Argon2 password hash + optional PIN
- **LAN networking**: Axum HTTP server on master, clients pair via QR
- **Payments**: Daraja (M-Pesa STK direct) + Paystack (M-Pesa + card fallback)
- **Tax**: KRA VSCU protocol (eTIMS)
- **Backup**: local SQLite dump + optional Cloudflare R2 encrypted
- **Updater**: `tauri-plugin-updater` with minisign-signed releases from GitHub
- **AI**: multi-provider gateway (Groq / OpenRouter / OpenAI / DeepSeek / Gemini / Anthropic) with automatic failover on rate-limit / model-decommissioned / quota-exceeded
- **Website**: Next.js 15 (App Router) on Vercel + Neon Postgres via Drizzle + Better Auth + R2 for media
- **Auth on website**: Better Auth with Google OAuth + magic link + email/password
- **Admin**: `/admin` in Next.js with role-based access (platform_admin, support_agent, sales_rep)

---

## What's shipped (as of v0.28.8)

### Core platform
✅ Auth (login, roles, permissions, groups, access explorer)
✅ POS (barcode, held sales, split payments, customer display, thermal print)
✅ Inventory (products, batches, suppliers, POs, stock takes, transfers)
✅ Customers (profiles, credit, aging, statements)
✅ Accounting (expenses, P&L, VAT return, Z-report, cash register)
✅ Banking (accounts, reconciliation, statement imports, petty cash)
✅ eTIMS (VSCU integration, auto-sign, credit notes, retry queue)
✅ M-Pesa (Daraja STK + Paystack)
✅ Auto-updater (signed, background download, install-on-close)
✅ Licensing (activation, deactivation, machine binding, seat management, trial with 4-stage graceful expiry, self-heal on schema drift)
✅ Multi-device LAN (master + clients)
✅ Backup (local + cloud R2)
✅ Audit log (immutable, exportable)
✅ Roles + permissions
✅ Reports (12+ standard reports + PDF exports)
✅ AI assistant (multi-provider gateway with failover)
✅ Branches (multi-location with per-branch reports)

### Dawa module
✅ Prescriptions + doctor register
✅ Drug interaction check
✅ Controlled substance register
✅ Batch expiry tracking + write-off flow + wastage report
✅ SHA + private insurance claims
✅ Patient profiles + allergies
✅ Dispense-time expiry warnings

### Retail module
✅ Brands
✅ Layby (installment sales)
✅ Special orders
✅ Shrinkage detection
✅ Retail dashboard
✅ Quick-add product for cashier speed
✅ Bulk product import

### Hospitality module
✅ Tables + layout
✅ KOT (kitchen order tickets)
✅ Split payments
✅ Recipe costing
✅ Menu categories + menu engineering
✅ Room bookings + folios (hotels)
✅ Housekeeping status
✅ Service charge + tips
✅ Wastage tracking

### Hardware module
✅ Contractor accounts + credit limits
✅ Bulk pricing tiers
✅ Quotations + quote-to-invoice
✅ Delivery notes with signatures
✅ Hardware-specific reports

### Commercial platform (this year's session's work)
✅ Admin creates customer accounts without email
✅ Manual M-Pesa payment recording
✅ Reseller channel with volume tiers + commission tracking + dashboard
✅ Reseller wholesale checkout with automatic commission credit on paid
✅ Affiliate program with anti-fraud (self-referral detection, repeat-purchase cap, cookie attribution)
✅ Homepage hero + module + one-price + closing CTA all admin-editable via /admin/settings CMS
✅ Sticky mini-CTA on every landing page
✅ Editorial mobile sheet (proper Radix Dialog, focus trap, portal to body)
✅ SQL smoke test infrastructure (513 tests including real-SQL execution against in-memory SQLite)
✅ Ruthless removal of native window.confirm/alert/prompt across both codebases + audit rule preventing reintroduction

---

## What's NOT shipped (honest gaps)

### Marketing website
- ❌ Real customer testimonials (need 5-10 named paying customers first)
- ❌ Case studies (same)
- ❌ Video hero (schema ready, CMS-editable, but no videos recorded yet)
- ❌ Blog / SEO content (long-term; not blocking month-1 sales)
- ❌ Full Kenyan-locale internationalization (English is fine for now)

### Product
- ❌ Mobile companion app (Owner-on-Android to view sales from anywhere — planned Year 2)
- ❌ eCommerce integration (WooCommerce / Shopify sync — no demand yet)
- ❌ Bulk SMS marketing to customers (Africa's Talking integration — future)
- ❌ Full payroll module (basic P9/P10 exports work; SHIF/NSSF/Housing Levy CSVs work; full salary run is minimal)
- ❌ HR + leave management (basic scaffolding; not production-grade)
- ❌ Loyalty points / rewards (built in shell; no marketing yet)

### Commercial
- ❌ Reseller payout via Paystack Transfers (Kenya Transfer support pending; will add when merchant enables)
- ❌ Automated affiliate payout (same)
- ❌ In-app in-product upsell (once trial expires, prompt to buy — currently only via dashboard link)
- ❌ Referral compound tracking beyond first level (affiliate of affiliate — deliberately not built to prevent MLM feel)

### Testing
- ❌ Rust unit tests are sparse (mostly TS coverage)
- ❌ No E2E tests via Playwright / WebDriver (tauri is hard to E2E; not blocking)

---

## Strengths

1. **Offline-first architecture** — every competitor is SaaS. Omnix works with the electricity + internet flickering that's the daily reality of Kenyan trade. This is not a nice-to-have; this is table-stakes.

2. **KRA compliance built into the receipt engine** — competitors treat eTIMS as an afterthought. Omnix builds every sale for KRA out of the box. No plugins, no upgrades required.

3. **One-time perpetual licensing** — anchored against a subscription-fatigued market. Owners don't want another KES 2,000/month bill. They want to buy something once.

4. **Native desktop performance** — Tauri = smaller than Electron, faster than a web app. Opens in <2s, POS scan-to-cart in <50ms. This is a shop-floor product; performance matters.

5. **Four verticals from one codebase** — 70% of code is shared. When Loyverse ships a feature, it ships to all customers; same for Omnix. Very efficient.

6. **Kenyan-specific from day one** — M-Pesa STK Push (not "we integrate with mobile money"; direct Daraja API), KRA eTIMS (VSCU protocol), SHA insurance workflow, KES currency default, Africa/Nairobi timezone default. Zero "coming soon for Africa" caveats.

7. **The commercial platform is real** — reseller channel is not a landing page; the schema + commission math + audit trail is all shipped. Affiliate program has anti-fraud built in. Admin can create customers without email (walk-in owner-controlled).

8. **Auto-updater works** — cannot be understated. Every install of Omnix is fixable remotely. When the CTO ships a bug fix at 3pm, every Omnix in Kenya has it by 6pm without a technician visit.

9. **Test coverage on the money paths** — tax modes, returns, trial expiry, licensing, dashboard aggregates all locked with vitest invariants. The v0.28.6 SQL smoke tests catch schema drift before it ships.

10. **Founder is a working engineer + shop-floor observer** — this is rarer than it should be. The founder has watched real Kenyan chemists dispense drugs, real retail owners close shift, real hardware owners write quotes. That empathy is in the product.

## Weaknesses (honest, unsparing)

1. **Zero paying customers as of this document's date.** All the tech works. The market hasn't confirmed it will buy. The single biggest risk.

2. **No customer testimonials.** Every landing page section talks about the product's features; no owner has said "this changed my life." First customer solves this.

3. **Solo founder + solo everything.** No sales rep. No support person. No junior installer. Every failure mode is a single-person failure mode.

4. **Sales channel is nascent.** Reseller schema exists; no reseller has been signed. Affiliate program shipped; no affiliate has referred anyone. Both are potentials, not realities.

5. **Payment is one-time-heavy** — great for closing sale #1 but no MRR safety net. If growth stalls at 100 customers, revenue is 100 × KES 15-30k = KES 1.5-3M year-1 non-recurring. Renewals (year 2) are the safety net; if renewal % is low, this becomes a subscription business without the subscription price.

6. **Kenya market is competitive.** Loyverse has ~2000 Kenyan customers already. Not overwhelming, but real. Omnix must be materially better for those customers to switch, not just competitive.

7. **KRA eTIMS is a moving target.** KRA changes protocol details every 6-12 months. Every change requires an Omnix release. Not hard, but if the founder is busy selling, someone still has to code the KRA update.

8. **Windows-only.** No macOS or Linux desktop version. Some businesses (design agencies, coffee shops with MacBooks) can't install. Rare in target segment but limits ceiling.

9. **No mobile companion.** Owner on the road wanting to check today's sales must open Omnix on their PC. Loyverse has an Owner app for iPhone. Omnix's future roadmap; not month-1.

10. **The onboarding funnel isn't tuned.** Someone lands on omnix.co.ke and downloads — how many complete install + trial + activate + pay? Nobody knows because sample size is 0. First 20 conversions will reveal where the funnel leaks.

---

## Competitive analysis (deeper)

### Loyverse
**What they do well**: seamless iPad-first POS, generous free tier, decent M-Pesa integration, ~2000 Kenyan customers.

**What Omnix wins on**:
- Loyverse free tier has no eTIMS. If a Kenyan pharmacy uses Loyverse, they can't file KRA — they'd need a separate tool.
- Loyverse paid tier is KES 1,700/month × 12 = KES 20,400/year. Omnix's KES 30k one-time pays back in year 2.
- Loyverse doesn't do SHA insurance claims. That kills them for pharmacy.
- Loyverse is iPad-first. Kenya is Windows-first for SMEs.

### Sokoni (Kenyan startup)
**What they do well**: Kenyan founders, local support, M-Pesa integration, some KRA eTIMS.

**What Omnix wins on**:
- Sokoni is subscription (KES 3,500/month = KES 42,000/year). Omnix's one-time forever is 60% cheaper over 5 years.
- Sokoni is browser-based (SaaS). No offline. If internet drops mid-sale, they can't ring up.
- Sokoni's hospitality module doesn't handle split-bill or KOT to separate printers.
- Sokoni doesn't offer a reseller commission ladder or affiliate program.

### Vend / Lightspeed / QuickBooks POS
**What they do well**: enterprise polish, cloud sync, integrations.

**What Omnix wins on**:
- 10× the price. Enterprise product for enterprise budget.
- Not built for Kenyan compliance (KRA / SHA / M-Pesa).
- QuickBooks Kenya discontinued 2023 — the market is retiring these.

### Custom Excel + paper
**What they do well**: free, familiar.

**What Omnix wins on**: Everything the product does. But: switching cost is real. A 60-year-old shop owner using Excel for 15 years won't switch unless the pain is immediate + acute. This is the "no trigger" segment. Skip them in year 1.

### The gap Omnix uniquely fills

Kenyan SME, KES 500k-5M/month revenue, wants KRA compliance done for them, wants to own data locally, wants to pay once. Combined that's a segment of 50,000-80,000 businesses in Kenya. At even 1% penetration = 500-800 customers = KES 15-24M year-1 revenue.

---

## Strategic roadmap (next 12 months)

### Phase 1 — First 10 paying customers (Days 1-30)
- CEO does 100% of outreach + demos + installs
- Land 5 Dawa + 3 Retail + 2 Hospitality
- Every customer gets a photo + testimonial captured
- Refine the pitch per module based on real objections
- Fix everything that breaks in the wild (I ship same-day for anything that hits a paid customer)

### Phase 2 — First reseller + affiliate (Days 30-60)
- Sign 1-2 resellers (pharmacy distributor rep + one other)
- Enable affiliate program on public site + WhatsApp status
- 15 more paying customers
- First affiliate compound (a referral of a referral) — signals virality kicking in
- Deprecate landing sections that don't convert

### Phase 3 — Compounding (Days 60-90)
- 3-5 resellers active
- 30-50 paying customers total
- Take-home KES 300k+/month
- First "we love this app" testimonial captured on video
- Prep first hire: part-time installer + support person

### Phase 4 — Sales infrastructure (Days 90-180)
- First hire onboards (installer/support)
- CEO shifts to 50/50 sales + product
- First real month-2 renewal rate visible — this is the leading indicator of long-term viability
- 100 paying customers total
- Expand to Mombasa + Kisumu in-person (weekend trips)

### Phase 5 — Growth mode (Days 180-365)
- 5-10 active resellers
- Affiliate compounding dominant channel
- First B2B partnership (a distributor or association endorses Omnix)
- 300-500 paying customers
- ARR KES 3.6M-6M/year (from renewals of year-1 customers)
- Hire #2: full-time customer success

### Phase 6 — Consolidation (Year 2)
- 1000+ paying customers
- 3-5 full-time hires
- First custom-development deal from an enterprise customer (KES 200k+ dev fee)
- Consider expanding to Uganda / Tanzania / Rwanda (same tax problems, similar M-Pesa markets)

---

## Closing thoughts

Omnix is what happens when someone builds a working Kenyan SME operating system without VC pressure or premature scale demands. It's not the biggest product. It's not the most-funded. It doesn't need to be.

It only needs to be **the one Kenyan pharmacy owners actually use**, and then be that for every Kenyan SME.

The technology is done. The commercial infrastructure is done. What's ahead is the messy, unglamorous, unrepeatable work of finding the first 100 customers by hand. That's not a product problem anymore. That's a founder problem.

The founder is capable. The playbook exists. The product doesn't fight him. What's left is picking up the phone.

**The next chapter is written on WhatsApp, not in a code editor.**
