# Omnix Comprehensive Product Audit

**Auditor panel**: Senior ERP Architect · Product Manager · Systems Analyst · Retail Ops · Pharmacy Ops · Hospitality Ops · Accountant · Inventory Specialist · Supply Chain · POS Specialist · UX · QA · Security · Database · Rust · Performance · Hardware Integration · AI Product Designer.

**Version audited**: v0.29.2 (`0fe73d3`)
**Codebase snapshot**: 105 desktop pages · 95 desktop services · 60+ SQLite tables (54 migrations) · 68 permission scopes · 4 trade modules (dawa, retail, hardware, hospitality).

**Method**: every claim below is grounded in the actual codebase — no assumptions. Verified via file inventory, table enumeration, service surface, permission matrix, and route registry. Where marketing docs claim a capability that isn't in the code (SQLCipher is the clearest example), it's flagged as **spec drift**.

**Verdict up front**: Omnix is a strong SME-tier retail + pharmacy platform with real depth in KRA compliance, POS, and inventory. It has substantial *scaffolding* for an ERP-grade platform but material gaps in **double-entry accounting, financial reporting, peripheral hardware, security hardening, kitchen operations, and reservations**. It is production-ready for single-shop retail and pharmacy today. It is **not** ready as a "Business Operating System" comparable to Odoo, Zoho, or Dynamics 365 BC — closing that gap is a 6-to-9-month track for a single-engineer team, half that with two.

---

## Executive dashboard

| Domain | Coverage today | Gap severity | Effort to close |
|---|---|---|---|
| POS / checkout | ~90% | Low | Weeks |
| Inventory | ~75% | Medium | Weeks–month |
| Procurement | ~60% | Medium-High | Month |
| Pharmacy compliance | ~85% | Low-Medium | Weeks |
| Retail extensions | ~70% | Medium | Weeks–month |
| Hospitality F&B | ~50% | High | 2–3 months |
| Hospitality lodging | ~35% | High | 2–3 months |
| Hardware / building materials | ~65% | Medium | Weeks–month |
| Accounting (cash-basis) | ~55% | High | 2 months |
| **Accounting (accrual + GL)** | **~5%** | **Critical** | **2–3 months** |
| Reports | ~40% | High | Month |
| CRM | ~50% | Medium | Weeks |
| Multi-branch / warehouse | ~65% | Medium | Weeks–month |
| HR / payroll | ~65% | Medium | Weeks |
| Hardware peripherals | ~30% | High | Month |
| Security hardening | ~40% | Critical | Month |
| AI | ~70% | Low | Ongoing |
| UX / accessibility | ~70% | Medium | Ongoing |
| Platform (offline, backup, upgrade) | ~75% | Medium | Weeks |
| Automation / scheduling | ~30% | High | Weeks–month |
| Integrations / APIs | ~40% | Medium | Month |

---

## 1. Core Platform

### What exists
- Dashboard: `pages/dashboard.tsx` + `pages/retail-dashboard.tsx` + trade-specific overviews. KPIs from `services/reports.ts::getDashboardKPIs`.
- Navigation: sidebar with role-gated items via `RequireRole`. Trade-specific left rails.
- Command Palette: `components/layout/command-palette.tsx` (Ctrl+K).
- Global search: **NOT a dedicated component** — search is inside command palette + individual list pages. No cross-entity search.
- Notifications: **absent**. No notification center, no in-app toasts other than transient sonner toasts.
- Activity feed: **absent** at global level (audit-log page shows filtered history but there's no "what happened today" widget).
- Tasks / calendar: **absent**. No todo, no follow-up, no reminders.
- Multi-user: yes. `users` + `sessions` tables + Argon2 password hashing (`services/auth.ts`).
- RBAC: yes. 4 built-in roles (owner/manager/cashier/viewer) + custom roles table (`roles`, `permissions`, `role_permissions`, `groups`, `group_members`). Route-level guards work. **Field-level permissions absent.**
- Audit log: yes. `audit_log` table + `pages/audit.tsx`.
- Business settings: yes (`pages/settings.tsx` + `layout/settings-layout.tsx`, 7 job-oriented tabs).
- Multi-branch: yes. `branches` + `user_branches` + `active_branch` store. Stock transfers between branches.
- Multi-warehouse: **not a separate concept** — warehouse = branch in current model. Grocery/pharmacy owners tend to conflate. Hardware stores may need this distinction.
- User management: yes.
- Themes: light/dark + system-aware. No brand-color override yet (locked to blue-600).
- Accessibility: **partial**. Keyboard nav on most tables. No documented a11y audit. No screen-reader-tested paths. Focus rings inconsistent.
- Localisation: **English only.** No i18n framework wired to desktop. Swahili/Kikuyu/Luo not started.
- Offline-first: yes for standalone. **LAN client mode has no offline queue** — if master goes down, clients simply fail. Cited in AGENTS.md as design goal, not implemented.
- Backup: yes (`pages/backup.tsx` — encrypted, versioned local backup via `commands::backup`).
- Restore: yes (verified in Rust; UI in backup page).
- Export: partial. CSV export for products (`services/products-export.ts`). No global "export any table" feature.
- Import: yes for products (`pages/import-products.tsx` with AI-assisted CSV mapping via `services/csv-automap.ts`). No import for customers, suppliers, invoices, expenses.
- AI Import: yes for products.
- Data validation: zod schemas on individual forms. **No global schema registry.** Migration integrity not enforced beyond "did the file run".
- Migration tools: yes (numbered migrations in `src-tauri/migrations/`, 54 files).
- Logs: no user-facing app log. Rust `log` crate wired but no viewer. Console-only.
- Error recovery: `ErrorBoundary` at App root. Sentry / crash reporting **not wired** — a Sentry init lives in the marketing site but not in the desktop.
- Autosave: **absent.** Long forms (invoice-new, purchase-orders) lose input on navigation or crash.
- Crash recovery: **partial.** SQLite is durable; unsaved form state is not.
- Versioning: yes for the app (semver + auto-updater). **Not for data** — no per-record change history except audit_log (which is coarse: action + resource + metadata, no diff).
- Performance: not systematically profiled. `sales_daily` rollup table exists — dashboard reads pre-aggregated. Bundle size, cold-boot time, RAM: **unmeasured**.
- Plugin architecture: **none.** Every feature is compiled in.
- API architecture: internal Tauri commands (~50) + web API (~70 routes). No public API for third-party integrations.
- Extensions: none.
- Automation engine: **none.** No if-this-then-that. No recipe/scenario builder.
- Scheduled tasks: only auto-backup, telemetry heartbeat, auto-update. Nothing user-schedulable.
- AI Assistant: yes. `pages/ai-workspace.tsx` + full `services/ai/*` with router, retry, cache, redact, streaming, tool calls, actions.
- Keyboard shortcuts: extensive on POS. Documented in `components/shortcuts-overlay.tsx`. **No global shortcut editor.**
- Quick actions: some (POS overview action rows). No universal quick-add across modules.
- Global settings: yes, 7-tab layout.

### Missing (Core Platform)

**Critical**
- **Notification center** — new PO ready to receive, expired batch just wrote off, low-stock alert, unpaid invoice past due, patient prescription refill due, cold-chain temperature breached, back-in-stock. Right now these fire as toasts if user is looking, disappear otherwise.
- **Offline queue for LAN client mode** — every till dies when the master reboots. AGENTS.md declares this as goal, not built.
- **Autosave for long forms** — invoice-new / PO / stock-take. Loss of data on crash or accidental navigation is normal in the wild.

**High**
- Global cross-entity search (product SKU that's actually a customer's phone → both surface)
- Activity feed / recent-actions widget on dashboard
- Field-level permissions (e.g. cashier sees products but not buying price; manager sees payroll totals but not individual salaries)
- Localisation framework (Swahili + French are needed for East Africa)
- Sentry / crash telemetry so we hear about crashes before customers WhatsApp us
- Per-record change history for money-touching entities (products, prices, invoices) — diff-level, not just audit-log
- Schema validation on migration replay (integrity check that the DB matches the current migration set)
- App log viewer inside Settings → System → Logs
- Themes: business-owner-editable accent colour (already spec'd in AGENTS.md, not built)

**Medium**
- Tasks / todo list with due dates + assignees
- Calendar (staff schedules, follow-ups, promotions, expiry reminders)
- Global "Export any table to CSV" (right-click on a data grid → export)
- Universal quick-add (Ctrl+N contextual to what page you're on)
- Scheduled tasks framework (recurring cash-count reminders, weekly stocktake, monthly close)
- Custom-field / user-defined-field support on products, customers, suppliers
- Bulk edit tools on every list page (products has one; customers/suppliers/employees don't)
- Data-quality dashboard (duplicate customers, orphan sales, negative stock, unreconciled payments)

**Low**
- Plugin architecture (later)
- Public REST API (later)
- Extension marketplace (much later)

---

## 2. Accounting & Finance

### What exists
- **Expenses**: `expenses` + `expense_categories` tables. Cash-basis. Full UI at `pages/expenses.tsx`.
- **Petty cash**: `pages/petty-cash.tsx` + `services/petty-cash.ts`.
- **Cash register / drawer counting**: `cash_register` table + `pages/cash-register.tsx` + shift open/close.
- **Other income**: `other_income` table.
- **Bank accounts + transactions**: full CRUD.
- **Bank reconciliation**: partial — `bank_statement_imports` + `bank_statement_lines` tables exist. Matching UI **not verified**; if present, thin.
- **Sales ledger / AR**: derives from `sales` + `customer_payments` + `customers.balance`. Age analysis in `services/erp.ts::getCustomerStats`.
- **Purchase ledger / AP**: `purchase_orders` + `supplier_payments`.
- **Credit notes**: `credit_notes` + `credit_note_items` tables. Wired to eTIMS as of v0.28.3.
- **Debit notes**: **absent**.
- **Invoices**: `invoices` + `invoice_items` + `invoice_payments`. Recurring templates too.
- **Receipts**: physical receipts yes. Numbered receipt records: sales carry `sale_number`; standalone customer-payment receipts yes.
- **Payments**: `payments` + `payment_providers` + `payment_transactions` + `customer_payments` + `supplier_payments`.
- **VAT**: eTIMS auto-signing per sale (`etims_invoices`). VAT report at `pages/vat-report.tsx` (VAT3 shape).
- **P&L**: `pages/pnl.tsx` — cash-basis P&L. Real revenue minus COGS minus expenses.
- **Cash flow**: `services/cashflow.ts` — inflow/outflow view. **Not a full statement.**

### Missing (Accounting)

**Critical**
- **Chart of Accounts** — no `chart_of_accounts` table. Everything is siloed (expenses, income, cash, bank, sales) with no unified account codes. Consequence: no proper trial balance, no balance sheet, no accountant handover.
- **Journal entries / General Ledger** — no `journal_entries` / `ledger_lines` table. Every posting today is single-entry to a specific silo. An audit-grade ERP must have double-entry with debit/credit lines summing to zero.
- **Trial Balance** — impossible without GL.
- **Balance Sheet** — impossible without GL.
- **Cash Flow Statement (proper)** — impossible without categorised journal postings.
- **Financial years / closing periods** — no way to close a period. Editing a sale from 8 months ago silently rewrites P&L for the closed year. Auditor-hostile.

**High**
- Opening balances (starting a business mid-year — cash on hand, existing receivables/payables, stock at cost). Currently every business starts from zero.
- Debit notes (supplier over-invoiced you, you issue a debit to reduce what you owe).
- Budgets — no `budget` table, no budget-vs-actual variance report.
- Recurring transactions beyond invoices (recurring expenses: rent, salaries, subscriptions).
- Multi-currency support (base = KES; visitor from Nigeria wants NGN receipts, dashboard in USD). Currently locked to `intlLocale()`.
- Foreign-exchange rate table + revaluation.
- Bank reconciliation UI (matching, ledger-vs-statement, tolerance rules). Tables exist; workflow missing.
- Tax analytics beyond VAT (income tax provision, withholding tax on suppliers).
- Statutory reports for KRA beyond VAT3: monthly income tax, PAYE (payroll tax), NHIF/SHIF, NSSF returns as e-slips.
- Fixed assets register + depreciation schedule (essential for anything past first year).

**Medium**
- Cost centres / project accounting (which branch / event / campaign did this expense belong to)
- Cost analysis (variance analysis, actual vs standard costing)
- Consolidated reports across multiple businesses (owner runs three shops with separate installs — sees one dashboard)
- Automated bank feed via bank API (M-Pesa Business, KCB, Equity have APIs; hitting them requires per-bank negotiation)

**Low**
- Advanced tax reporting (transfer pricing, VAT partial exemption)
- Segment reporting (IFRS-style)

---

## 3. Inventory

### What exists
- `products` + `categories` + `brands` + `product_variants` (retail).
- `batches` — expiry, cost, quantity. FIFO issue via `services/inventory.ts`.
- `product_uoms` — units of measure with conversion (base + case + carton).
- `product_prices` (multi-price-list) + `price_lists` + `retail_price_lists`.
- `shrinkage` (retail write-offs).
- `stock_transfers` + `stock_transfer_items`.
- `wastage` (`services/wastage.ts` + `pages/wastage-report.tsx`) — hospitality-focused but works elsewhere.
- Cold chain: `cold_chain_units` + `cold_chain_logs`.
- Reorder thresholds: `products.reorder_level`.
- Stock take: `pages/stock-take.tsx`.
- Barcodes: printing supported via `services/receipt.ts` and shelf labels (`services/shelf-labels.ts`).
- Barcode scan: `hooks/use-scanner.ts` + `pages/settings-scanner.tsx`.
- Inventory reports page: `pages/inventory-reports.tsx`.

### Missing (Inventory)

**High**
- **Serial-number tracking** (not batch — individual serials for electronics/appliances). AGENTS.md mentions IMEI/serial for a future Electronics module; nothing today.
- **Bundles / kits / composite products** — no `bundle_components` or `kit_items` table. Retail sees this everywhere ("gift set = 1 lotion + 1 soap + 1 comb").
- **Assembly / manufacturing** — needed if any customer sells produced goods (bakery, ice, chapati).
- **Reorder suggestions with lead time** — reorder level exists; AI-driven suggestion "buy 40 units of X, you'll run out in 5 days at current velocity" absent.
- **Inventory forecasting** — velocity-based demand forecast per SKU.
- **Cycle counts** — scheduled partial counts (top-100 fast movers weekly, everyone else monthly). Only a single full stocktake page today.
- **Damages register** — separate from shrinkage. Damage on receive → supplier-return. Damage in-store → write-off. Only shrinkage exists.
- **Supplier catalogs** — SKU-to-supplier price cross-reference. Currently supplier is a `products.supplier_id` FK; multi-supplier per product not modelled.
- **QR codes on products** (some hospitality use QR for menu ordering; retail uses QR for warranty registration).
- **Stock aging report** — how long has each batch sat.
- **Dead stock report** — SKUs with zero movement in N days.
- **Inventory timeline** — per-SKU chart of receipts + sales + adjustments over time.
- **Inventory valuation methods** — FIFO is implemented but "weighted average" and "LIFO" as options aren't.

**Medium**
- Multi-warehouse (bin locations within a branch: rack A-1, cold-store, front shelf).
- Barcode generation (Code128 / EAN-13) — printing works; auto-generation of internal SKU→barcode absent.
- Product images with proper media library (partial — some product-detail pages accept an image, no global media library with folders).
- Product variants: retail has them (`product_variants`) but pharmacy/hardware don't share the schema.
- Landed cost allocation (import duty, freight, forex on receive → per-line cost).
- Kit costing (composite pricing).
- Slow / fast movers per branch (currently global).
- Barcode-only mode for the POS (customer types phone, cashier scans and forgets).

**Low**
- Consignment stock (supplier's stock in your store — sell first, pay later).
- Batch labels with human-readable expiry stickers.

---

## 4. Procurement

### What exists
- `suppliers` + `supplier_payments`.
- `purchase_orders` + `purchase_order_items` (with `services/po-lifecycle.ts`).
- `goods_receipts` + `goods_receipt_items` (GRN).

### Missing (Procurement)

**High**
- **Purchase requests / requisitions** — internal request → manager approval → PO. Every scale-up business hits this.
- **Approval workflow** — PO over KES X needs manager sign-off. No approval framework.
- **Supplier returns** — no `supplier_return` table (only customer returns). "This box came broken" → return-to-supplier document, debit note.
- **Supplier credits** — same problem, no credit-from-supplier ledger entry.
- **Supplier statements** — printable statement per supplier (period, opening, transactions, closing).
- **Price lists per supplier** — different price for same SKU across suppliers.
- **Supplier performance dashboard** — on-time-in-full, lead time, defect rate.
- **Lead time tracking** — infer from PO-issued → GRN.
- **Outstanding orders view** — PO issued, waiting for goods.

**Medium**
- Blanket / call-off orders (annual contract, order against it monthly).
- Multi-currency purchase orders.
- Duty / freight allocation on receipt.
- Auto-3-way matching (PO ↔ GRN ↔ supplier invoice).
- Purchase requisition portal for LAN clients.

**Low**
- E-procurement (electronic PO submission to suppliers via API/email).

---

## 5. Sales

### What exists
- `sales` + `sale_items` + `payments` + `held_sales`.
- `sale_returns`.
- `services/sales.ts` + `services/erp.ts` + `services/promotions.ts`.
- Quotations + sales orders + invoices via invoicing module.
- Layaway (`retail-laybys.tsx` + retail-only for now).
- Credit sales via customer.balance.
- Sales sources: `sales.source` (from v0.27+) tracks POS / walk-in / hospitality / invoice.

### Missing (Sales)

**High**
- **Sales orders as a first-class concept** — quotations and invoices exist, but the interim "customer confirmed but not delivered" state is missing.
- **Installments / payment plans** — layaway exists in retail; general installment scheduling (fees, hire-purchase) does not.
- **Sales targets + commissions per staff** — hardware module has `commissions` table; retail/pharmacy/hospitality don't.
- **Customer pricing / customer groups** — every customer pays list price. No `customer_groups` table, no per-customer price override.
- **Discount rules engine** — flat discount at line/sale level works; "buy 3, get 1 free", "10% off after 5th item", tier discounts absent.
- **Coupons + coupon codes** — promotions exist as flat / percent-off but no coupon-code redemption.
- **Gift cards** — mentioned in permissions/UI copy nowhere in schema. No `gift_cards` table.
- **Order history export** — CSV export per customer.

**Medium**
- Sales analytics beyond top-products (basket analysis, cross-sell, RFM segmentation).
- Best-sellers by branch / by staff / by day-of-week (partial exists).
- Slow-sellers report.
- Margin analysis by category / brand / supplier.
- Deposit / down-payment tracking (paid 50%, balance owed).

**Low**
- B2B quote-to-order workflow (multi-step approval).

---

## 6. CRM

### What exists
- `customers` table + `customer_payments` + `customer_notes` (yes there's a `customers.notes` field).
- Loyalty: `loyalty_transactions` + `loyalty_settings` (points per KES).
- Patient profiles (pharmacy): `pages/patient-profile.tsx` + `patient_conditions` + allergies.
- Customer detail page shows purchase history + balance + credit limit.

### Missing (CRM)

**High**
- **Communication history** — SMS/email log per customer. Nothing today.
- **Follow-ups** — reminder to call customer X on date Y.
- **Customer segmentation** — no dynamic tags / segments (VIP, high-margin, defaulter, dormant).
- **Customer lifetime value** — one column derived (`getCustomerStats`), no dashboard.
- **Gift cards** (also listed above).
- **Loyalty tier UI** — points table exists; there's no "silver/gold/platinum" tier definition or redeem-for-reward flow.
- **Contacts under a customer** — Corporate customer has 3 people who buy. Today it's one row with one phone.

**Medium**
- SMS campaigns / bulk WhatsApp (KRA doesn't allow marketing-tax-invoice but promotional messages are fine).
- Customer analytics: cohort retention, month-over-month spend.
- Customer credit-scoring (auto-flag before extending credit).
- Referral tracking on customer records (existing affiliate system tracks referrer purchases in a separate table; not linked to customer profile).

**Low**
- Multi-channel inbox (WhatsApp + SMS + email in one thread).

---

## 7. Retail POS

### What exists — very strong here
- Fast POS at `pages/pos-sale.tsx` + `pos-overview.tsx`.
- Barcode scan.
- Held sales / recall.
- Split payments (multi-tender).
- Cash drawer via receipt printer signal (**not verified as functional**).
- Thermal printing via `services/print-html.ts`.
- Receipt templates: `pages/settings-receipt.tsx` — customisable.
- Returns, refunds, exchanges.
- Discount + manager override (`services/rbac.ts`).
- Shift open / close with cash count. Blind close **not enforced** (cashier sees expected drawer).
- X-Report (v0.29.1) + Z-Report.
- Multi-branch / multi-register.
- Gift receipts: **absent** (no "gift mode" that hides prices).
- Loyalty at POS: yes.
- Promotions at POS: yes (flat / percent-off, campaign-level).
- Price checker: **absent** as a dedicated screen (product search works).
- Self-checkout: not attempted.
- Layaway: yes (`retail-laybys.tsx`).
- Special orders: yes (`retail-special-orders.tsx`).
- Customer display: yes.
- Offline sales: **the standalone install works offline; LAN client does not queue.**

### Missing (Retail POS)

**High**
- **True blind close** — enforce "count first, see variance after". Owner-side reveal of expected drawer.
- **Gift receipts** — a variant of receipt printout that hides prices.
- **Suspend and resume with till reboot** — held sales survive DB but if PC dies mid-sale, the cart doesn't (localStorage but no explicit crash-restore).
- **Cash-in / cash-out during a shift** — pay out driver, receive owner's float mid-day. Petty cash exists; POS-side "paid-in / paid-out" during shift absent.
- **No-sale button** — open drawer with an audit entry ("cashier opened drawer without sale — reason").
- **Return without receipt** — pin-approved override to return goods without prior sale ID.

**Medium**
- Price-check kiosk (customer scans, sees price, moves on).
- Bag fee / carry-out fee auto-add.
- Rounding rules per branch (Kenya has coin scarcity; auto-round to nearest 5 KES).
- Multiple currencies at POS (visitor pays in USD).
- Manager override log (already audit-logged, but no dedicated "overrides today" report).
- Multi-language receipt (English + Swahili header on same receipt).

**Low**
- Self-checkout mode.
- Deli scale integration.

---

## 8. Pharmacy (Dawa)

### What exists — strong regulatory coverage
- `pharmacy_products` + `prescriptions` + `prescription_items` + `controlled_log`.
- Batch + expiry + near-expiry alerts.
- Prescription validation + dispense workflow (`pages/pharmacy.tsx`).
- Drug interactions (`drug_interactions` + `interaction_overrides`).
- Patient allergies + conditions.
- Controlled substances register.
- Doctors register.
- Insurance: `insurance_providers` + `insurance_claims` + `insurance_claim_items` + `insurance_batches` + `pages/claims.tsx`.
- Refills (`pages/refills.tsx`).
- AMR (antimicrobial resistance) report (`services/amr-report.ts` + `pages/amr-report.tsx`).
- Cold chain (`services/cold-chain.ts`).
- Drug labels with dispenser initials (`services/drug-labels.ts`).
- Corporate accounts: partial via customer credit; no dedicated corporate schema.
- Medicine recalls: **absent** (no `recall_notice` workflow).
- Medicine images: partial (products can have image; no dedicated pharmacopoeia).

### Missing (Pharmacy)

**High**
- **Medicine recalls** — MOH issues a batch recall (e.g. Ranitidine 2019). Today no way to systematically quarantine + track quarantined stock across all branches.
- **Corporate accounts as a schema** — company X's employees dispense on account; monthly statement to company. Currently overloaded onto customer.balance.
- **Partial dispensing** — customer only wants half the prescribed course. Should split the prescription, remember balance for pickup.
- **Refill reminders** — automatic reminder N days before chronic patient runs out. Refill page exists; no scheduler.
- **Generic substitution** — `drug_substitutions` table exists; UI/workflow **not verified as active** in dispense flow.
- **Copay + insurance split** — partial (insurance module bills the insurer share, cashier collects the copay). Verify the split isn't lost on returns.

**Medium**
- Compounded prescriptions (mix your own; cost tracking of components).
- Cold-chain temperature dashboards per unit (data is captured, dashboard is thin).
- Barcode dispense (scan to log against the correct SKU rather than search-then-select).
- Dose calculator (paediatric mg/kg).
- Drug information monograph search (integrate FDA / BNF / etc.).

**Low**
- Prescription image capture (attach scanned doctor's script).
- Home delivery workflow with rider assignment.

---

## 9. Hospitality (Restaurants, Bars, Cafés, Hotels)

### What exists (F&B side)
- `dining_areas` + `dining_tables` + `kitchen_stations`.
- `menu_items` + `menu_modifiers`.
- `hospitality_orders` + `hospitality_order_items` + `hospitality_order_item_modifiers`.
- `recipes` + `recipe_ingredients` — recipe BOM.
- `hospitality_wastage`.
- `service_charge_rules` + `service_charge_allocations`.
- `tips` + `tip_distributions`.
- Menu kind (food/drink/dessert flag).
- Page `pages/hospitality.tsx`.

### What exists (Lodging side)
- `room_types` + `rooms` + `rate_plans`.
- `guests` + `bookings`.
- `guest_folios` + `folio_charges` + `folio_payments`.

### Missing (Hospitality — F&B)

**Critical**
- **Kitchen Display System (KDS)** — schema has `kitchen_stations` but there is **no page/route rendering a live kitchen board**. Every serious restaurant needs a screen in the kitchen showing incoming tickets, ability to bump. This is a blocker for real deployment.
- **Reservations** — no `reservations` table. Bar/restaurant customers ring to book table. Currently there's no way.
- **Table map / seating layout** — no visual floor plan. Waiter needs to see "table 4 = seated 45min, table 6 = free, table 7 = ordering".
- **Course-based coursing** — appetiser, main, dessert timing to kitchen.
- **Split bills / merge tables / transfer** — schema half there; workflow UI unverified.

**High**
- Kitchen printing (dedicated printer per station: bar printer for cocktails, grill printer for meat). Print settings exist; per-station routing absent.
- Happy hour pricing rules (time-of-day price switching).
- Combo meals.
- Portion control on recipe (guardrail against over-pour).
- Food cost dashboard (theoretical vs actual per dish).
- Waiter performance dashboard (average table time, average check size, upsell rate).
- Modifiers hierarchy: half-cake + extra icing on the second half.

**Medium**
- Bar inventory (spillage, over-pour, waste per bottle).
- Cocktail recipes (auto-deduct multiple ingredients).
- Waiter station assignment (waiter A owns tables 1-5).
- Split-check by seat.
- Cover count reporting (heads/night).

### Missing (Hospitality — Lodging)

**Critical**
- **Room-status board** — housekeeping-facing: clean / dirty / inspected / OOO. Schema thin; UI absent.
- **Reservations engine** — bookings table exists; booking calendar visualisation and availability search absent.
- **Room service posting** — F&B order charged to a room (folio charge). Bridge probably works; verify.

**High**
- Housekeeping worksheets.
- Rate plans + seasonal pricing (`rate_plans` exists; pricing engine bare).
- Group bookings / block reservations.
- Deposit + cancellation policy.
- Channel manager integration (Booking.com / Airbnb — likely later).

**Medium**
- No-show + auto-cancel.
- OTA sync.
- Guest history / repeat guest recognition.

---

## 10. Hardware / Building Materials Module

### What exists
- `quotations` + `quotation_items` (separate from invoicing's quotations).
- `delivery_notes` + `delivery_note_items`.
- `customer_accounts` (contractor accounts with credit terms + aging).
- Commissions.

### Missing (Hardware module)

**High**
- Bulk pricing tiers (buy 100 bags of cement → 5% off; 500 bags → 10%). Partial via retail price-lists; not surfaced as tier.
- Parts catalog for specific brands (Bostitch nail sizes, MRC rebar grades).
- Contractor account statements + credit-holds when overdue.
- Loading / dispatch schedule (pickups vs deliveries).
- Order-to-cash across multi-day fulfilment.

**Medium**
- Vehicle / driver tracking on delivery.
- Site-based delivery (deliver to job site, not billing address).

**Low**
- Rental (scaffolding rental, mixer rental) — separate revenue stream common at hardware stores.

---

## 11. Reports

### What exists
- Dashboard KPIs (`services/reports.ts::getDashboardKPIs`).
- Sales by day / by payment method.
- Top products.
- Stock valuation.
- P&L (cash-basis).
- Z-report + X-report (v0.29.1).
- VAT report (VAT3).
- Wastage report.
- AMR report.
- Tips report.
- Retail-specific reports (`services/retail-reports.ts`).
- Cashflow view.
- `pages/reports-index.tsx` as landing.

### Missing (Reports)

**High**
- **Balance sheet** — impossible without GL.
- **Trial balance** — same.
- **Cash flow statement** (proper) — same.
- **Sales analytics by every dimension** — by branch, by category, by brand, by staff, by hour-of-day, by day-of-week. Some slices exist; a report builder does not.
- **Purchase analytics** — by supplier, by category, by lead time.
- **Inventory analytics** — turnover, days-of-cover, deadstock, aging.
- **Customer analytics** — cohort retention, RFM.
- **Waiter / cashier scorecards** — comparative per-staff dashboards.
- **Report builder** — drag-drop dimensions + measures. Even without full ad-hoc, saved-query facility.

**Medium**
- Scheduled report emails (daily P&L to owner at 6pm).
- Export to Excel with formatting (currently CSV/PDF).
- PDF reports with brand — some exist (`services/reports-pdf.ts`); not consistent everywhere.
- Consolidated multi-branch report.
- Comparison periods (this month vs last month, YoY).

**Low**
- Dashboards per role (cashier's dashboard vs owner's dashboard).
- Public-facing customer report (statement portal).

---

## 12. Security

### What exists
- Argon2 password hashing (verified in `services/auth.ts` + Rust `auth.rs`).
- Role permissions (68 permissions across 4 roles + custom).
- Audit log.
- Encrypted local backups (verified in `commands::backup`).
- RSA-signed licences per machine.
- HTTPS-only for all server calls.
- Tauri CSP: locked down per config.
- 2FA **service** exists at `services/two-factor.ts` — TOTP generation + verification. **But is NOT wired to any login or settings page.** Zero users can enable it.

### Missing (Security)

**Critical**
- **SQLCipher / database encryption at rest** — declared as a requirement in AGENTS.md and marketing pages (`website/security/page.tsx`), **not implemented in code**. Migrations run plain SQLite. Anyone with disk access reads the DB. This is spec-drift misrepresentation and needs to either be built or removed from marketing.
- **2FA UI + enforcement** — service ready, no login flow uses it, no settings toggle. Wire it end-to-end.
- **Password policies** — min length exists (8 in some places, 6 in others); rotation/complexity/breach-check absent.
- **Session management UI** — no "sign out other devices" view.
- **PIN login for tills** — cashiers on a shared till should be able to quick-switch by PIN. Not built.

**High**
- Field-level permissions (see Core).
- Branch-level permissions (cashier at branch A can't see branch B sales).
- Tamper detection (has anyone edited `sales.total` after eTIMS submission?).
- Fraud detection heuristics (voids > 5% of shift, staff-discount > threshold, unusual cash short).
- Biometric login (Windows Hello / fingerprint) — noted in requirements, not built.
- Login rate limiting (currently unlimited attempts).
- Password-breach check (HIBP hash prefix API — offline-safe).

**Medium**
- Restore verification (does the last backup actually restore cleanly? nightly check).
- Full-disk-encryption reminder / requirement banner.
- Session timeout enforcement (inactive 15min → auto-lock).
- Encrypted export files (currently CSV/PDF exports are plaintext).

**Low**
- Formal SOC-style audit trail exports.
- Signed audit-log chain (each entry hashes prior).

---

## 13. AI Features

### What exists — surprisingly strong
- Provider routing (`services/ai/router.ts` with Groq fallback chain).
- Task-specific prompts: enrich-product, normalize-import, drug-enrich, zreport-summary, setup-assist, explain-etims.
- CSV auto-mapping.
- Redaction (PII strip before send).
- Prompt caching.
- Streaming.
- Retry with quota / model-gone handling.
- Chat history (`ai_conversations` + `ai_messages`).
- Actions (`ai_actions`) with audit.
- AI Workspace page.
- AI settings page.

### Missing (AI)

**High**
- **Invoice extraction / receipt OCR** — vendor sends WhatsApp photo of invoice; auto-extract line items. Nothing today.
- **Natural-language search** — "show me all sales of Panadol under KES 300 last week from cashier Mary". Search primitives exist; NL layer absent.
- **Business insights** — daily "this week's summary" push. Data is there; scheduled AI summariser absent.
- **Sales forecasting** — beyond top products, predict demand curve.
- **Inventory forecasting / purchase suggestions** — see Inventory section.
- **Customer insights** — churn prediction, next-best product for a customer.
- **Anomaly alerts** — cashier's variance jumped this week, sales dropped 30%, expiry writeoff spiked.

**Medium**
- Expense OCR (scan receipt → expense entry).
- Product-photo-based lookup (photo → catalog match).
- Voice input on POS (Swahili).
- Duplicate customer detection.
- Auto-suggest re-order at end-of-day close.

**Low**
- Meeting-notes / handover summary at shift close.

---

## 14. Hardware / Peripherals

### What exists
- Barcode scanner (input listener; auto-focus).
- Receipt printer via HTML print (works with any Windows-installed printer).
- Customer display (secondary window).
- Cash drawer signal (kick pulse via receipt printer command).

### Missing (Peripherals)

**Critical**
- **Cash drawer explicit driver** — today the drawer opens *if* the receipt printer supports the kick pulse. Standalone (USB or serial) cash drawers unsupported.
- **Kitchen printer** — different physical printer than receipt printer, routed per menu item's station. Not implemented.
- **Kitchen Display Screen** — see Hospitality.
- **Weight scale** — deli/grocery. USB or serial scale reads weight → auto-fill line quantity. Zero support.
- **Card reader** — Verifone / Ingenico / Pax integration for chip+PIN. Currently every card sale is manual entry ("customer paid by card, cashier types amount"). No integration.
- **USB / serial device management page** — see attached devices, test each, diagnostics.

**High**
- Network printer discovery + selection per till.
- Multi-monitor management (customer display on secondary; POS on primary).
- Automatic reconnection when printer/scanner drops.
- Bluetooth printer support (mobile POS).

**Medium**
- Device diagnostics dashboard (per till: printer OK, scanner OK, drawer OK, display OK).
- Fingerprint reader wiring.

**Low**
- NFC tap-to-pay reader.

---

## 15. UX / Accessibility

### What exists
- Sidebar + command palette + keyboard shortcuts.
- Skeleton loading states on most pages.
- Empty states on lists (some).
- Confirm dialogs via imperative helper (v0.28.7 — enforced by audit rule).
- Toasts (sonner).
- Dark / light mode.
- 7-tab settings.
- Fuzzy settings search.

### Missing (UX / A11y)

**High**
- **Comprehensive keyboard flow across all forms** — POS has it, PO / invoice / stock-take don't.
- **Focus management on modal close** — tab doesn't always return to trigger.
- **Screen-reader path testing** — no ARIA audit.
- **Consistent empty states** — some pages have great empties; others show blank tables.
- **Consistent error states** — HTTP error → red toast (mostly) but not standardised copy or recovery steps.
- **First-run onboarding** — setup exists; no interactive tour after setup.

**Medium**
- Discoverability of features (users don't know shrinkage / special-orders exist).
- Consistent breadcrumbs (some pages have them, some don't).
- Responsive on 10-inch tablets (Kenya has cheap tablets in shops).
- Reduced-motion respect.
- High-contrast theme.
- Font-size increase for older users.

**Low**
- Live-region announcements for AI streaming.
- Voice control.

---

## FINAL PRIORITISED ROADMAP

### 🚨 Critical — ship in the next 30 days

1. **Kitchen Display Screen (hospitality)** — one page rendering incoming tickets per station with bump-to-clear. Unblocks real restaurant deployments. `~5 days`.
2. **Reservations table + booking calendar (hospitality)** — F&B reservations + lodging booking availability search. `~7 days`.
3. **Wire 2FA end-to-end** — enrolment page + login step + settings toggle + audit-log event. Service already exists. `~2 days`.
4. **Chart of Accounts + basic Journal Entries + Trial Balance** — foundational; even a minimum COA (25 accounts) + auto-posting from existing sales/expense/payment tables gets us to Trial Balance and a real Balance Sheet within a month. `~14 days`.
5. **SQLCipher decision** — either build encryption at rest (`~5 days`) OR strip "encrypted database" from marketing copy TODAY. Cannot leave the drift.
6. **LAN client offline queue** — pending-transactions log that replays when master returns. `~5 days`.
7. **Notification centre + alert framework** — expiry, low-stock, unpaid-invoice, cold-chain, PO-ready, refill-due. Central inbox. `~7 days`.
8. **Autosave on long forms** — invoice-new, PO, stock-take. Use IndexedDB or SQLite tmp. `~2 days`.
9. **Cash drawer + weight-scale + kitchen printer explicit driver** — Rust-side device abstraction + settings-hardware page becomes real. `~10 days`.
10. **X/Z-report already shipped v0.29.1. ✅**

### 🔴 High — 30-90 days

11. Balance Sheet + Cash Flow Statement (once GL is up).
12. Financial year + period close.
13. Debit notes + supplier returns + supplier statements.
14. Approval workflows on POs and expenses.
15. Bundles / kits schema + POS UI.
16. Serial-number tracking (electronics-ready).
17. Cycle counts + damages + stock-aging + dead-stock reports.
18. Reorder suggestions (velocity-based).
19. Sales targets + commissions (all modules, not just hardware).
20. Customer groups + customer pricing.
21. Coupon codes + gift cards.
22. Discount rules engine ("buy 3 get 1").
23. Communication history + follow-ups on customers.
24. Bank reconciliation UI.
25. Fixed assets register + depreciation.
26. Multi-currency.
27. Field-level permissions.
28. Password policies + PIN login for tills + branch-scoped permissions.
29. Recall workflow (pharmacy).
30. Room-status board + housekeeping (hospitality lodging).
31. Kitchen printer per station.
32. Report builder (saved queries + scheduled emails).
33. Sales / purchase / inventory analytics dashboards.
34. Localisation framework (Swahili).
35. Sentry / crash telemetry.
36. Per-record change history for money entities.
37. Public REST API (basic).

### 🟡 Medium — 90-180 days

38. Cost centres / project accounting.
39. Bank feed integrations (M-Pesa Business API first).
40. Landed cost allocation.
41. Recurring expenses.
42. Multi-warehouse (bin locations).
43. Assembly / manufacturing.
44. Portion control + food-cost dashboards (hospitality).
45. Bar inventory (spillage, over-pour).
46. Waiter station assignment + course coursing.
47. Split-bill / merge-table / transfer complete workflow.
48. Group bookings + rate plans + deposits (lodging).
49. Compounded prescriptions (pharmacy).
50. Home-delivery / rider workflow.
51. Contractor account statements + auto-hold on overdue (hardware).
52. Voice input on POS.
53. Anomaly alerts (variance jumps, expiry spikes).
54. Report scheduling + Excel export.
55. Consolidated multi-business dashboard.
56. Global cross-entity search.
57. Universal quick-add (Ctrl+N).
58. Custom / user-defined fields.
59. Bulk edit on every list.
60. Data-quality dashboard.

### 🟢 Low — 180+ days

61. Plugin architecture + extension marketplace.
62. Channel-manager integrations (OTA sync).
63. Self-checkout.
64. NFC tap-to-pay.
65. Rental workflow (hardware).
66. Formal signed audit-log chain.
67. Multi-language receipts on same paper.
68. Prescription photo capture with OCR.
69. Cohort / RFM customer analytics.
70. Loyalty tier UI + reward redemption.

---

## CLOSING PERSPECTIVE — the real-owner test

Play back to the Kenyan owner running Omnix on Monday morning:

- **Do they see what happened over the weekend?** Partially — dashboard KPIs work; there's no activity feed.
- **Can their accountant close the month?** Not really — cash-basis P&L only, no GL, no formal period-close, no trial balance.
- **Can the shop keep selling if the master PC crashes?** Standalone yes; LAN client no.
- **Can they sleep knowing the DB is encrypted at rest?** No (despite marketing claim).
- **If a batch of cough syrup gets recalled by KEMSA at midnight, can they quarantine all units by 7am?** No — no recall workflow.
- **If they run a restaurant, do their cooks see orders coming in?** No KDS — orders live on the manager's PC.
- **If someone books a table for Saturday 8pm, can they take the reservation?** No — no reservations feature.
- **Can the cashier reprint yesterday's Z-report with the drawer variance breakdown for insurance?** Yes.
- **Can the cashier see running totals mid-shift without closing?** Yes now (X-report — v0.29.1).
- **Can the owner see cash flow for the last 30 days?** Yes (cashflow view). Formal cash-flow statement — no.
- **Is 2FA on the owner's account?** No, service is unwired.

The right posture for the next quarter is: **finish the ERP fundamentals (GL + double-entry + period close + reservations + KDS + notifications + LAN offline + encryption + 2FA) before adding features.** Everything else is polish.

---

*Audit generated v0.29.2, `0fe73d3`, 2026-07-01.*
