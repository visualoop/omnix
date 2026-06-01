# 10 - Hardware & Building Materials Module Plan

**Goal:** Add a Hardware module for Kenyan hardware shops, building-materials dealers,
and electrical/plumbing suppliers. Core ERP stays shared. Hardware owns quotations,
delivery notes, contractor pricing, bulk units of measure, customer accounts with
credit/aging, and salesperson commissions.

This is a vertical module like Dawa, Retail, and Hospitality. It is gated by the
`hardware` entitlement (Tasks 8/9) and never contaminates other modules' settings.

## Target users

- Hardware shops (tools, fasteners, paint, plumbing, electricals)
- Building-materials dealers (cement, steel, timber, mabati, aggregates)
- Electrical and plumbing supply shops
- Shops that sell to both walk-in retail customers and contractors on account

## What belongs in Core vs Hardware

| Concept | Core | Hardware |
|---|---|---|
| Users, roles, branches | Yes | Uses Core |
| Inventory, purchasing, stock | Yes | Adds bulk UOM (bag/length/sheet/carton) sell-units |
| POS payments, cash register | Yes | Adds quote→sale, on-account/credit sales |
| Customers | Yes | Adds contractor accounts, credit limits, aged receivables |
| Pricing | Core price (selling_price) | Adds contractor/wholesale price lists (reuse Retail engine) |
| Reports, P&L | Yes | Adds receivables aging, commission, quote conversion |
| Employees | Yes | Adds salesperson commission attribution |

**Promote to Core (deliberately, since other modules reuse them):**
- **Quotations** and **delivery notes** are useful for Hospitality (events/catering),
  Retail (special orders), and Dawa (institutional supply). Build them as Core-leaning
  tables under the hardware migration but name/scope them generically
  (`quotations`, `delivery_notes`) so they can be surfaced by other modules later.
- **Customer credit limits + aged receivables** likewise generalize; keep the columns
  on Core `customers` where possible and the aging query in a shared service.

## Module identity

- Module ID: `hardware`
- Display name: `Hardware Store` (`MODULE_DEFINITIONS.hardware`, status → available)
- Short name: `Hardware`
- Suggested accent: orange (configurable; one-accent rule still applies)
- Primary workflows: quotation → invoice/sale, delivery notes, contractor accounts +
  statements, bulk UOM pricing, salesperson commissions, receivables aging.

## Roles & permissions

Add to `PERMISSION_CATALOG` + `Permission` union (`src/lib/permissions.ts`); group **Hardware**:

- `hardware.quotations.manage` (normal) — create/convert quotations
- `hardware.delivery_notes.manage` (normal) — issue/track delivery notes
- `hardware.accounts.manage` (high) — contractor accounts, credit limits, statements
- `hardware.pricing.manage` (high) — contractor/wholesale price lists
- `hardware.commissions.view` (normal) — view salesperson commissions
- `hardware.reports.view` (low) — hardware reports

Role grants (`ROLE_PERMISSIONS`):
- Owner: all (implicit).
- Manager: quotations, delivery_notes, accounts, pricing, commissions.view, reports.view.
- Cashier: quotations.manage (quote at counter), delivery_notes.manage.
- Viewer: reports.view.

`moduleOf()` in `rbac.ts` already maps `hardware.*` → `hardware` for the catalog seed.

## Settings boundary

Hardware settings appear only when active module is `hardware` (via `registerSettings`
with `module:'hardware'`):
- `/settings/hardware/pricing` — contractor/wholesale price lists (reuse Retail engine)
- `/settings/hardware/units` — sellable bulk units (bag, length, sheet, carton, m, kg)
- `/settings/hardware/credit` — default credit terms + aging buckets
- `/settings/hardware/commissions` — commission rates per salesperson/category

Must NOT appear in Dawa/Retail/Hospitality.

## Data model (migration 031_hardware.sql)

Extends Core via FKs; never alters core tables destructively.

```sql
-- Quotations (generic; hardware is first consumer)
CREATE TABLE quotations (
    id TEXT PRIMARY KEY,
    quote_number TEXT UNIQUE NOT NULL,
    branch_id TEXT,
    customer_id TEXT REFERENCES customers(id),
    status TEXT NOT NULL DEFAULT 'draft'
      CHECK (status IN ('draft','sent','accepted','converted','expired','cancelled')),
    valid_until TEXT,
    subtotal REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    converted_sale_id TEXT REFERENCES sales(id),
    salesperson_id TEXT REFERENCES employees(id),
    notes TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE quotation_items (
    id TEXT PRIMARY KEY,
    quotation_id TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id),
    name TEXT NOT NULL,
    uom TEXT,                          -- bag / length / sheet / carton / piece
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    discount REAL NOT NULL DEFAULT 0,
    line_total REAL NOT NULL
);

-- Delivery notes (generic)
CREATE TABLE delivery_notes (
    id TEXT PRIMARY KEY,
    note_number TEXT UNIQUE NOT NULL,
    branch_id TEXT,
    customer_id TEXT REFERENCES customers(id),
    sale_id TEXT REFERENCES sales(id),
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','dispatched','delivered','cancelled')),
    delivery_address TEXT,
    vehicle TEXT,
    driver TEXT,
    dispatched_at TEXT,
    delivered_at TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE delivery_note_items (
    id TEXT PRIMARY KEY,
    delivery_note_id TEXT NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id),
    name TEXT NOT NULL,
    uom TEXT,
    quantity REAL NOT NULL
);

-- Contractor / customer accounts (credit + statements). One row per credit customer.
CREATE TABLE customer_accounts (
    customer_id TEXT PRIMARY KEY REFERENCES customers(id),
    credit_limit REAL NOT NULL DEFAULT 0,
    balance REAL NOT NULL DEFAULT 0,        -- outstanding receivable
    terms_days INTEGER NOT NULL DEFAULT 30,
    on_hold INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE account_ledger (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    entry_type TEXT NOT NULL CHECK (entry_type IN ('charge','payment','adjustment')),
    sale_id TEXT REFERENCES sales(id),
    amount REAL NOT NULL,                   -- +charge / -payment
    balance_after REAL NOT NULL,
    due_date TEXT,
    reference TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Salesperson commissions
CREATE TABLE commission_rules (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES employees(id),
    category_id TEXT,                       -- NULL = all categories
    percent REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE commission_accruals (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    sale_id TEXT REFERENCES sales(id),
    base_amount REAL NOT NULL,
    percent REAL NOT NULL,
    amount REAL NOT NULL,
    payroll_period TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Pricing reuses the Retail engine: `retail_price_lists` + `resolvePrice()` in
`src/services/retail.ts`. Hardware price lists are just price lists named
"Contractor"/"Wholesale" assigned to customer accounts.

## Services (`src/services/hardware.ts`)

All mutating ops call `assertModuleEntitled('hardware')` + `requirePermission(...)`.

- `createQuotation`, `addQuoteItem`, `convertQuoteToSale(quoteId)` (creates Core sale).
- `createDeliveryNote`, `markDispatched`, `markDelivered`.
- `getAccount`, `setCreditLimit`, `postCharge`, `postPayment`, `agedReceivables(asOf)`
  → buckets (current / 1-30 / 31-60 / 61-90 / 90+).
- `creditCheck(customerId, amount)` → blocks on-account sale over limit / on hold.
- `commissionForSale(saleId)` accrues per `commission_rules`.

## Pages (`/hardware/*`, gated by entitlement)

1. `/hardware/dashboard` — KPIs: open quotes, receivables, deliveries pending, commissions.
2. `/hardware/quotations` — list + new + convert.
3. `/hardware/delivery-notes` — list + issue + dispatch/deliver.
4. `/hardware/accounts` — contractor accounts, balances, statements, aging.
5. `/hardware/commissions` — accruals by salesperson/period.
6. `/hardware/reports` — receivables aging, quote conversion, commission, top materials.

Settings under `/settings/hardware/*`.

## module-features.ts registration

Add to `FEATURE_OWNERS`:
```
"/hardware/dashboard": "hardware",
"/hardware/quotations": "hardware",
"/hardware/delivery-notes": "hardware",
"/hardware/accounts": "hardware",
"/hardware/commissions": "hardware",
"/hardware/reports": "hardware",
"/settings/hardware/pricing": "hardware",
"/settings/hardware/units": "hardware",
"/settings/hardware/credit": "hardware",
"/settings/hardware/commissions": "hardware",
```

## Build order

### Batch 1 — Registration (Task 19, this doc)
- `MODULE_DEFINITIONS.hardware` status → available.
- `FEATURE_OWNERS` hardware routes.
- `PERMISSION_CATALOG` + `Permission` union + `ROLE_PERMISSIONS` hardware perms.
- This plan doc.

### Batch 2 — Data model + services (Task 20)
- Migration `031_hardware.sql` (registered in `lib.rs` version 31).
- `src/services/hardware.ts`: quotations, delivery notes, accounts/aging, commissions.
- Reuse `resolvePrice()` for contractor pricing.

### Batch 3 — Pages + reports + settings (Task 21) [SKILLS GATE]
- Operational pages + reports under the design system.
- Hardware settings registered into the shell via `registerSettings`.
- Customer-display hardware context (already in display registry).

## Out of scope for v1
- Project/job costing beyond per-customer grouping.
- Rental/hire of equipment.
- Multi-currency.
- Automated contractor portals.

## Acceptance criteria
- Hardware pages/settings appear only when the `hardware` module is licensed + active.
- Quote converts to a Core sale; on-account sale respects credit limit; aging buckets compute.
- Delivery note issues against a sale; dispatch/deliver tracked.
- Commission accrues per rule and is readable by payroll.
- Core sale/payment/accounting remains the financial source of truth.
