# 05 — Soko Retail Module Plan

**Goal:** A new module for general retail — beauty shops, mini-marts, dukas, cosmetics, electronics-light, hardware-light, gift shops, butcheries.

This is **not** Dawa. Different schema, different forms, different reports.

## Target users

Researched online — Kenyan retail SMEs that need this:
- **Beauty shops & cosmetics** — high-margin, fast-moving SKUs, many brands, color/shade variants
- **Mini-marts ("dukas")** — broad SKU range, low margins, FMCG, expiry-sensitive
- **Small supermarkets** — wider SKU, multiple categories, daily restocking
- **Hardware-light** — tools, fasteners, paint (different from Pharmacy module — no controlled substances; different from a future pure-Hardware module — fewer bulk-pricing tiers)
- **Butcheries** — weight-based pricing, scale integration, refrigeration tracking
- **Stationery / general goods**

## Why this is different from Pharmacy + Core

| Concept | Pharmacy (Dawa) | Retail (Soko) | Core |
|---|---|---|---|
| Variants per product | Strength + dosage form | **Color + size + shade** ⭐ | Just SKU |
| Pricing | Single price per pack | Tiered (retail/wholesale/promo), bulk discounts | Single |
| Customer interaction | Prescription, allergies | Loyalty + walk-in mostly anonymous | — |
| Compliance | PPB, controlled log | Country of origin, expiry for FMCG | Generic |
| Sales speed | Moderate (consultation) | **Fast** (scan-and-go) ⭐ | — |
| Returns | Rarely (regulated) | Frequent (size, change of mind) | — |
| Receipts | Detailed | Compact, quick | — |

## Module-specific schema (migration 017_retail.sql)

```sql
-- Product variants (color, size, shade) — many per product
CREATE TABLE product_variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    variant_sku TEXT UNIQUE NOT NULL,           -- e.g. PROD-RED-L
    variant_name TEXT NOT NULL,                  -- "Red / Large"
    barcode TEXT,
    color TEXT,
    size TEXT,
    shade TEXT,
    -- variant-level pricing override (optional)
    selling_price REAL,                          -- NULL = inherit from product
    buying_price REAL,
    -- stock tracked per variant
    stock_qty REAL NOT NULL DEFAULT 0,
    reorder_level INTEGER NOT NULL DEFAULT 0,
    image_path TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_barcode ON product_variants(barcode);

-- Pricing tiers (retail / wholesale / promo / contractor)
CREATE TABLE price_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,                   -- "Retail", "Wholesale", "Staff"
    is_default INTEGER NOT NULL DEFAULT 0,
    customer_group_id TEXT REFERENCES customer_groups(id),
    starts_at TEXT,
    ends_at TEXT,
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE price_list_items (
    id TEXT PRIMARY KEY,
    price_list_id TEXT NOT NULL REFERENCES price_lists(id),
    product_id TEXT REFERENCES products(id),
    variant_id TEXT REFERENCES product_variants(id),
    price REAL NOT NULL,
    min_quantity REAL DEFAULT 1,
    UNIQUE(price_list_id, product_id, variant_id, min_quantity)
);

-- Brands (cosmetics, FMCG)
CREATE TABLE brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    logo_path TEXT,
    country_of_origin TEXT,
    active INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE products ADD COLUMN brand_id TEXT REFERENCES brands(id);
ALTER TABLE products ADD COLUMN sku_short TEXT;            -- short SKU for quick keyboard entry
ALTER TABLE products ADD COLUMN unit_of_sale TEXT NOT NULL DEFAULT 'piece';  -- piece / kg / g / l / ml / m / pack
ALTER TABLE products ADD COLUMN sold_by_weight INTEGER NOT NULL DEFAULT 0;   -- requires scale
ALTER TABLE products ADD COLUMN price_per_unit REAL;       -- e.g. KES per kg

-- Quick-add categories for fast SKU creation (visual button on inventory page)
CREATE TABLE retail_quick_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,                                    -- icon name from lucide
    color TEXT,
    parent_category_id TEXT REFERENCES categories(id),
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- Damage / shrinkage records (a major retail concern)
CREATE TABLE shrinkage (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    variant_id TEXT REFERENCES product_variants(id),
    quantity REAL NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('damaged','expired','theft','spillage','count_correction')),
    cost_value REAL,
    notes TEXT,
    user_id TEXT NOT NULL REFERENCES users(id),
    branch_id TEXT REFERENCES branches(id),
    incident_date TEXT NOT NULL DEFAULT (date('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Per-pack vs per-unit conversion (e.g. carton of 24 → 24 individual units)
CREATE TABLE product_uoms (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    name TEXT NOT NULL,                          -- "Carton of 24"
    quantity_per REAL NOT NULL,                  -- 24
    barcode TEXT,                                -- carton-level barcode
    is_default_purchase INTEGER NOT NULL DEFAULT 0,
    is_default_sale INTEGER NOT NULL DEFAULT 0
);

-- Layby / installment sales (common in retail for higher-ticket items)
CREATE TABLE laybys (
    id TEXT PRIMARY KEY,
    layby_number TEXT UNIQUE NOT NULL,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    total_amount REAL NOT NULL,
    deposit_amount REAL NOT NULL,
    paid_amount REAL NOT NULL DEFAULT 0,
    balance_due REAL NOT NULL,
    expires_at TEXT NOT NULL,                    -- usually 30-90 days
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled','expired')),
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);

CREATE TABLE layby_items (
    id TEXT PRIMARY KEY,
    layby_id TEXT NOT NULL REFERENCES laybys(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    variant_id TEXT REFERENCES product_variants(id),
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    line_total REAL NOT NULL
);

CREATE TABLE layby_payments (
    id TEXT PRIMARY KEY,
    layby_id TEXT NOT NULL REFERENCES laybys(id),
    amount REAL NOT NULL,
    method TEXT NOT NULL,
    reference TEXT,
    user_id TEXT NOT NULL REFERENCES users(id),
    paid_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Hold notes / special orders ("Mama Wanjiru wants 5kg sugar Friday")
CREATE TABLE special_orders (
    id TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES customers(id),
    customer_name TEXT,                          -- if no customer record
    customer_phone TEXT,
    items_json TEXT NOT NULL,                    -- list of {product_id, qty, notes}
    needed_by TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ordered','received','fulfilled','cancelled')),
    notes TEXT,
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## Pages (under `/retail` path)

1. **`/retail/dashboard`** — retail-flavored dashboard: top brands, sales by category, today's footfall, stock value
2. **`/retail/products`** — browser-grid view (with images), variant chips, brand filter
3. **`/retail/products/:id`** — product detail with variant manager, multi-image upload, brand selector
4. **`/retail/brands`** — brand directory CRUD
5. **`/retail/price-lists`** — price-list manager
6. **`/retail/quick-add`** — speed-entry form for adding 20 products fast (one row each)
7. **`/retail/laybys`** — list of active laybys + new layby flow
8. **`/retail/special-orders`** — pre-orders / special requests
9. **`/retail/shrinkage`** — log + view damage / theft / expiry write-offs
10. **`/retail/scale`** — scale integration test page
11. **`/retail/reports/category-mix`** — pie chart of sales by category
12. **`/retail/reports/brand-performance`** — sales per brand over time

## POS adjustments for retail

The existing POS works but needs a "retail mode" with:
1. **Variant picker** — when adding a product with variants, popup shows all variants with stock
2. **Bigger product images** — visual grid for cosmetics where customers point at SKUs
3. **Scale integration** — when product `sold_by_weight=1`, auto-pull weight from connected scale (USB HID), compute price = weight × price_per_unit
4. **Price tier auto-pick** — if customer is in a customer_group linked to a price_list, use that pricing
5. **Quick-cash buttons** — KES 100 / 200 / 500 / 1000 / 2000 with auto-change calc
6. **Layby checkout option** — on payment, offer "Pay deposit only, layby"
7. **Bulk discount auto-apply** — if buying ≥5 of an item with tier pricing, snap to tier price

## Hardware integrations (Retail-specific)

1. **Barcode scanner** — already supported via keyboard wedge
2. **Receipt printer** — already supported
3. **Cash drawer** — already supported
4. **Weighing scale** — NEW. Most Kenyan butcheries / mini-marts have a USB or RS-232 scale that outputs `<weight>kg<CR><LF>`. Need a Tauri command that reads from a serial/HID device.
5. **Customer-facing display** — second monitor shows running total, advertisements (NEW)

## Module-specific permissions

- `retail.variants.manage`
- `retail.price_lists.manage`
- `retail.brands.manage`
- `retail.laybys.use`
- `retail.shrinkage.record`
- `retail.special_orders.use`

## Module branding

- Module ID: `retail` (or rename to `soko-retail`)
- Logo: replace one of the planned slots in module-logos.tsx with a retail-specific mark (shopping cart with KES tag? cosmetics palette? bag with sparkle?)
- Color: warm orange/red (different from Dawa's teal)

## Build order (8 batches)

1. **Migration 017** + brands CRUD + price lists basics + variants CRUD
2. **Variants in product detail** — rich form with image upload per variant
3. **POS variant picker** + scale integration scaffold
4. **Layby system** — schema, page, payment flow
5. **Special orders** — schema + page
6. **Shrinkage tracking** — schema + page + report
7. **Retail dashboard** + brand performance + category mix reports
8. **Quick-add multi-row** product entry page

## What we don't build (defer)

- Real scale integration (need real hardware to test) — ship the abstraction, defer driver
- Customer-facing display — needs a second-window Tauri config experiment
- E-commerce sync — Soko website module is for the company's marketing, not customer e-shop
- Multi-currency — Kenya is KES-only

## What this module SHARES with Core/Pharmacy

- Customers, suppliers, expenses, P&L, cash register, petty cash, promotions, loyalty (yes!), eTIMS, employees/payroll, branches, banking
- The new tables here are additive, not replacing core
- Activate "retail" module = these new pages appear in sidebar under "Retail" group
