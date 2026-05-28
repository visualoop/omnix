# 00 — Current State (after v0.1.6)

## Shipped & working

### Core ERP
- POS with held sales, line/cart discounts (% or amount), substitution suggestions, customer picker, quick-add customer
- Inventory with categories, batches, expiry, reorder levels, CSV import, bulk edit
- Purchase Orders + Goods Received Notes
- Stock take with variance adjustment
- Sales returns
- Customer + supplier records with credit/balance tracking
- Customer + supplier settlement payments (cash / mpesa / card / bank)
- Cash register / shifts with handover slip printing
- Petty cash separate from main till
- Expenses tracker + categories
- Promotions (% off / amount off / buy X get Y, time-windowed, codes)
- Daily Z-report (end-of-day, 80mm thermal printable)
- Monthly P&L with print-to-PDF
- Auto-backup
- Audit log

### Dawa Pharmacy module
- Prescriptions with dispensing
- Drug labels (100×60mm thermal print)
- One-click prescription refill
- Doctors / prescriber database with KMPDC license
- Drug interaction warnings (28 clinical pairs seeded)
- Controlled substances log
- Patient profiles (allergies, conditions)
- Expiry alerts at 30/60/90 days
- VAT exemption logic for medicaments
- SHA / private insurance claims workflow
- Loyalty points with tier upgrade

### Compliance & integrations
- KRA eTIMS auto-signing + queue
- VAT report
- Insurance claims submission

### Platform
- 4-role RBAC (owner / manager / cashier / viewer) enforced on routes + sidebar + actions
- Single-key license activation with RSA signature verification
- 30-day local trial mode (no server)
- Module selection in setup wizard
- Per-module branding / logos
- LAN multi-device pairing (master + clients)
- Auto-updater via GitHub Releases
- Onboarding tour, command palette, keyboard shortcuts overlay, idle auto-lock
- Persistent cart, sticky filters
- Brand abstraction (`src/lib/brand.ts`) — single edit to rebrand
- 2FA TOTP scaffold
- ~~SMS service stub~~ (removed — out of scope)

## Gaps the user explicitly called out

1. **Components don't feel native** — shadcn defaults look web-app, not Windows native
2. **No employee management** — only user accounts, not staff records / payroll / attendance / leave / commissions
3. **No retail module** — only pharmacy is implemented
4. **Core ERP incomplete** — needs deeper Kenyan-SME features

## Build environment

- Tauri 2.x, Rust + React 19 + TypeScript + Vite + Tailwind 4 + shadcn (base-ui variant)
- SQLite via tauri-plugin-sql
- 15 migrations registered in `src-tauri/src/lib.rs`
- 42 page components, 60+ services
- Active branch: `main` at v0.1.6 (NOT pushed yet — local only going forward)
