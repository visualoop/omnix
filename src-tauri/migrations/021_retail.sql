-- ============================================================================
-- 021_retail.sql
-- Retail module — variants, brands, price lists, shrinkage, laybys, special orders
-- ============================================================================

-- Brands
CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    logo_path TEXT,
    country_of_origin TEXT,
    description TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Add retail-specific columns to products (nullable to preserve existing data)
ALTER TABLE products ADD COLUMN brand_id TEXT REFERENCES brands(id);
ALTER TABLE products ADD COLUMN sku_short TEXT;
ALTER TABLE products ADD COLUMN unit_of_sale TEXT NOT NULL DEFAULT 'piece';
ALTER TABLE products ADD COLUMN sold_by_weight INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN price_per_unit REAL;
ALTER TABLE products ADD COLUMN image_path TEXT;

CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_sku_short ON products(sku_short);

-- Product variants (color, size, shade per product)
CREATE TABLE IF NOT EXISTS product_variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_sku TEXT UNIQUE NOT NULL,
    variant_name TEXT NOT NULL,
    barcode TEXT,
    color TEXT,
    size TEXT,
    shade TEXT,
    selling_price REAL,                       -- NULL = inherit from product
    buying_price REAL,
    stock_qty REAL NOT NULL DEFAULT 0,
    reorder_level INTEGER NOT NULL DEFAULT 0,
    image_path TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_barcode ON product_variants(barcode);

-- Price lists / tiered pricing
CREATE TABLE IF NOT EXISTS retail_price_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    starts_at TEXT,
    ends_at TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Default price lists
INSERT OR IGNORE INTO retail_price_lists (id, name, description, is_default) VALUES
    ('pl-retail', 'Retail', 'Default walk-in customer pricing', 1),
    ('pl-wholesale', 'Wholesale', 'Bulk-purchase tier (≥10 units)', 0),
    ('pl-staff', 'Staff', 'Staff discount pricing', 0),
    ('pl-vip', 'VIP', 'VIP customer pricing', 0);

CREATE TABLE IF NOT EXISTS retail_price_list_items (
    id TEXT PRIMARY KEY,
    price_list_id TEXT NOT NULL REFERENCES retail_price_lists(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id),
    variant_id TEXT REFERENCES product_variants(id),
    price REAL NOT NULL,
    min_quantity REAL NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_pli_pl ON retail_price_list_items(price_list_id);
CREATE INDEX IF NOT EXISTS idx_pli_product ON retail_price_list_items(product_id);
CREATE INDEX IF NOT EXISTS idx_pli_variant ON retail_price_list_items(variant_id);

-- Customer to price-list link
ALTER TABLE customers ADD COLUMN price_list_id TEXT REFERENCES retail_price_lists(id);

-- Shrinkage / damage / theft / expiry write-offs
CREATE TABLE IF NOT EXISTS shrinkage (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    variant_id TEXT REFERENCES product_variants(id),
    quantity REAL NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('damaged','expired','theft','spillage','count_correction','sample','other')),
    cost_value REAL NOT NULL DEFAULT 0,
    notes TEXT,
    user_id TEXT NOT NULL REFERENCES users(id),
    branch_id TEXT REFERENCES branches(id),
    incident_date TEXT NOT NULL DEFAULT (date('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_shrinkage_date ON shrinkage(incident_date);
CREATE INDEX IF NOT EXISTS idx_shrinkage_reason ON shrinkage(reason);

-- Layby / installment sales
CREATE TABLE IF NOT EXISTS laybys (
    id TEXT PRIMARY KEY,
    layby_number TEXT UNIQUE NOT NULL,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    total_amount REAL NOT NULL,
    deposit_amount REAL NOT NULL,
    paid_amount REAL NOT NULL DEFAULT 0,
    balance_due REAL NOT NULL,
    expires_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','completed','cancelled','expired')),
    notes TEXT,
    user_id TEXT NOT NULL REFERENCES users(id),
    branch_id TEXT REFERENCES branches(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_laybys_status ON laybys(status);
CREATE INDEX IF NOT EXISTS idx_laybys_customer ON laybys(customer_id);

CREATE TABLE IF NOT EXISTS layby_items (
    id TEXT PRIMARY KEY,
    layby_id TEXT NOT NULL REFERENCES laybys(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    variant_id TEXT REFERENCES product_variants(id),
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    line_total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS layby_payments (
    id TEXT PRIMARY KEY,
    layby_id TEXT NOT NULL REFERENCES laybys(id) ON DELETE CASCADE,
    amount REAL NOT NULL CHECK (amount > 0),
    method TEXT NOT NULL,
    reference TEXT,
    user_id TEXT NOT NULL REFERENCES users(id),
    paid_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Special orders / pre-orders
CREATE TABLE IF NOT EXISTS special_orders (
    id TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES customers(id),
    customer_name TEXT,
    customer_phone TEXT,
    items_json TEXT NOT NULL,
    estimated_value REAL,
    needed_by TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','ordered','received','fulfilled','cancelled')),
    notes TEXT,
    user_id TEXT NOT NULL REFERENCES users(id),
    branch_id TEXT REFERENCES branches(id),
    fulfilled_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_special_orders_status ON special_orders(status);
