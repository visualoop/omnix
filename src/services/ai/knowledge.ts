/**
 * Omnix knowledge base — the comprehensive ground truth the in-app
 * assistant uses to answer questions accurately. Embedded into the
 * system prompt so the model "knows" the product without a RAG step.
 *
 * Update this file when:
 *   - New routes / settings pages ship
 *   - Pricing or licensing terms change
 *   - New modules / features are added
 *   - KRA / NHIF / SHA process changes materially
 */

export const PRODUCT_FACTS = `
PRODUCT IDENTITY
================
Omnix is an offline-first ERP desktop app for Kenyan SMEs. Tauri v2 + React +
SQLite. One Windows .exe, runs on the till even with no internet. Pay once,
own forever. Built by Visualoop (Nairobi).

Pricing (KES):
  - License (one-time):       30,000  — full Omnix:Dawa system, 1 device
  - Annual maintenance:       12,000/year  — eTIMS updates, SHA updates,
                                            new features, support; first year
                                            included so first payment is 30,000
  - Extra POS device on LAN:  10,000  — one-time, per terminal
  - Software keeps working forever even if maintenance lapses (no lock-out).
    Maintenance is for updates + support only.
  - Test Paystack keys are currently configured (sk_test_…, pk_test_…).
    Live keys swap-in cleanly when the user is ready.

Target customer:
  - Single-location pharmacies, mini-marts, hardware shops, restaurants,
    hotels in Kenya. 1–5 staff. KES 200k–600k/month revenue.
  - Currently using Excel/paper/basic POS or nothing.
  - NOT targeted: chains, hospitals, distributors.

MODULES (5 total)
=================
1. Core (always on, no licence required to demo):
   POS, inventory, sales history, customers, suppliers, purchases (GRN),
   accounting (expenses, P&L, banking), KRA eTIMS, payroll + statutory,
   reports, VAT3, Z-report, daily operations, audit log, multi-branch,
   LAN sync, cloud backup, RBAC, machine licensing.

2. Dawa (Pharmacy):
   "Run your pharmacy. Calm and compliant."
   Prescriptions, patient profiles, doctor directory, controlled substances
   register, drug interactions check, expiry & cold-chain tracking, AMR
   reporting, NHIF + SHA insurance claims with member verification + copay
   split. Refills, drug labels, counselling notes.

3. Retail (Soko):
   "Sell faster. Reorder smarter."
   Brand-aware inventory, layby (deposit + recurring instalments), special
   orders (custom items), shrinkage tracking, price-list tiers, variant
   matrix (size/colour), barcode scanner workflow.

4. Hardware:
   "Heavy stock. Heavier margins."
   Quotations → invoices → delivery notes, contractor accounts with credit
   + ageing, salesperson commissions, bulk pricing, BOM-friendly quote
   builder, M-Pesa Express check-out for the field rep.

5. Hospitality:
   "Tables to kitchen. Rooms to folio."
   Restaurant POS with kitchen display & bumping, recipe + ingredient
   costing, dining areas + tables, room types + bookings + folios,
   service charge rules, room-service workflow, charge-to-room, tip
   tracking, end-of-shift reconciliation.

DESKTOP APP — TOP-LEVEL ROUTES
==============================
Core / global:
  /pos                  Point of sale. Ctrl+K command palette here.
  /inventory            Products, batches, expiry, variants, brands.
  /sales-history        Every sale. Returns/refunds from here.
  /customers            Customer directory + credit limits + lifetime stats.
  /suppliers            Suppliers + open balances.
  /purchase-orders      POs + Goods Received Notes.
  /expenses             Operating expenses.
  /pnl                  Profit & loss (period-aware).
  /banking · /banking-detail   Bank accounts + reconciliation.
  /cash-register        Open/close shift, cash counts.
  /petty-cash           Petty cash float.
  /reports · /reports-index    Report catalogue.
  /vat-report           KRA VAT3 generator.
  /zreport              End-of-day shift summary.
  /daily-operations     Daily checklist.
  /tips-report          Tip allocation by employee.
  /amr-report           Antimicrobial Resistance report (Dawa).
  /etims-queue          Pending KRA eTIMS submissions.
  /import-products      Bulk CSV/Excel import. Click ✨ Auto-map columns.
  /stock · /stock-take · /stock-transfers · /stock-transfer-new · /stock-transfer-detail
  /returns              Sale returns workflow.
  /promotions           Discount campaigns.
  /invoicing · /invoice-new · /invoice-detail · /recurring-invoices
  /claims               SHA / private insurance claims (Dawa).
  /payroll · /attendance · /leave · /employees   HR.
  /backup · /cloud-backup    Local + encrypted cloud backups.
  /audit                Security/compliance event log.
  /quick-add            Speed-create products / customers.

Module-specific:
  Dawa:   /pharmacy, /doctors, /patient-profile, /controlled-register,
          /cold-chain, /refills, /expiry
  Retail: /retail-laybys, /retail-special-orders, /retail-shrinkage,
          /retail-brands, /retail-dashboard
  Hardware: /hardware
  Hospitality: /hospitality (orders + kitchen + menu + rooms + folios)

Onboarding / lifecycle:
  /setup                First-run wizard
  /login                Sign in (real auth, Argon2)
  /license-activation   Trial start + license key entry (gates the app)
  /modules              Module catalogue + activation
  /branches             Multi-branch + LAN client setup

SETTINGS — 32 sub-pages
=======================
Business:
  /settings                       Brand, contacts, KRA PIN, currency
  /settings/branches              Multi-location + branch user access
  /settings/users                 User accounts (Argon2 hashed)
  /settings/roles                 Custom roles
  /settings/groups                Group membership
  /settings/access-audit          "Why can / can't user X do Y?"

Finance:
  /settings/payments              Cash, M-Pesa STK, cards, bank, credit
  /settings/taxes                 VAT classes, rates
  /settings/price-lists           Customer pricing tiers
  /settings/etims                 KRA control unit + signing keys

Operations:
  /settings/network               LAN master/client mode
  /settings/modules               Active vertical (Dawa/Retail/etc.)
  /settings/backup                Local backups
  /settings/cloud-backup          Encrypted offsite backups
  /settings/customer-display      Second-screen, per-module privacy
  /settings/receipt               Receipt template + footer
  /settings/audit                 Audit log filter
  /settings/license               License key + machine binding
  /settings/insurance             SHA / private insurer setup (Dawa)
  /settings/ai                    AI providers + features + activity

Module-specific:
  /settings/hardware/units        Bulk units + contractor credit terms
  /settings/hospitality/service-charge   Auto service-charge percent

WEBSITE (omnix.co.ke)
=====================
Public pages: / (homepage hero), /modules, /pricing, /downloads, /changelog,
/docs, /blog, /about, /contact, /privacy, /terms, /support.
Auth: /signup, /login, /forgot-password, /verify-email/[token].
Buy / checkout: /buy, /buy/[licenseId].
Dashboard (logged-in customer): /dashboard, /dashboard/licenses,
/dashboard/machines, /dashboard/payments, /dashboard/support, /dashboard/profile,
/dashboard/billing, /dashboard/downloads.
Admin (Payload owner): /admin (14 collections, 3 globals — Users, Customers,
Licenses, Machines, Activations, Releases, TelemetryEvents, Payments,
SupportTickets, Pages, BlogPosts, Modules, Media, CloudBackups + Settings,
Pricing, LandingPage globals).

DOCS CATALOG (26 articles at omnix.co.ke/docs)
==============================================
Basics:
  - Getting started
  - Users & permissions
Core:
  - Point of sale
  - Inventory & variants
  - Cloud backup & restore
  - Banking & reconciliation
  - Payroll & statutory
  - Sales & receipts
  - Customers & credit
  - Suppliers
  - Purchases & GRN
  - Expenses
  - Profit & loss
  - Reports
  - LAN multi-device sync
Modules:
  - Insurance claims
  - Pharmacy (Dawa)
  - Retail
  - Hardware & building
  - Hospitality
Integrations:
  - KRA eTIMS setup
  - M-Pesa (Daraja & Paystack)
Billing:
  - Licence & activation
  - Trial to purchase
Troubleshooting:
  - Install troubleshooting
  - Multi-device sync issues
  - Backup recovery

KEY WORKFLOWS (cheat sheet)
===========================
KRA eTIMS:
  Setup → /settings/etims → enter PIN, branch, control unit → activate.
  Every sale auto-signs. /etims-queue shows pending. KRA error codes
  explained inline (✨ Explain button).

NHIF / SHA insurance (Dawa):
  /settings/insurance → add insurer + member verification API → on dispense,
  enter member number → system verifies + splits copay. Claim ledger lives
  at /claims.

M-Pesa STK:
  /settings/payments → enable Daraja or Paystack → STK push at POS payment
  modal. Funds settle to /banking automatically. M-Pesa receipt number
  recorded on every transaction.

LAN multi-device:
  /settings/network → master + add clients on the same wifi. Inventory + sales
  sync via the local axum server. No internet needed. Master can run with
  zero clients.

Cloud backup:
  /settings/cloud-backup → enable → encrypted snapshot uploaded to Cloudflare
  R2 every N hours (auto-scheduler in /hooks/use-auto-cloud-backup). Restore
  on a fresh device with the licence key (key derives the encryption secret
  so backups travel with the licence).

License activation:
  Free trial: 7 days at /license-activation, no payment, no credit card.
  Paid: buy at omnix.co.ke/buy → key emailed via Resend → enter at
  /license-activation OR upgrade in-place at /settings/license. Machine-bound
  via fingerprint; one device per licence (extras KES 10k each).

Trial to paid (no data lost):
  Trial expires → /settings/license shows the upgrade form → paste key →
  every product, sale, customer carries over. Trial uses the same SQLite
  database as the paid app.

AI assistant (this concierge):
  Cmd/Ctrl+J or click ✨ bottom-right.
  Per-feature toggles + privacy tier in /settings/ai → Features.
  Multi-provider (Groq, OpenRouter, DeepSeek, OpenAI, Anthropic, Google,
  custom Ollama). Bring-your-own-key — Omnix takes no fee on inference.
  Activity log at /settings/ai → Activity (every call: provider, tokens,
  ms, cost).

KEY SHORTCUTS
=============
  Ctrl+K     Command palette (everywhere)
  Cmd/Ctrl+J Toggle this assistant
  F1         Help
  F8         Z-report
  Ctrl+S     Save
  Ctrl+B     Back
  Esc        Close dialog / sheet

VERSIONING + UPDATES
====================
Tauri auto-updater built-in. Each release signed with minisign.
Free patch + minor updates while on maintenance.
Major updates (e.g. v0.x → v1.x) require an upgrade payment (one-time per
major), as a thank-you-for-existing model.
`
