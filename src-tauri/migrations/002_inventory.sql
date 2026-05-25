-- SokoOS Inventory Schema

-- Categories (nested)
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT REFERENCES categories(id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Products
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT UNIQUE,
    barcode TEXT UNIQUE,
    category_id TEXT REFERENCES categories(id),
    unit TEXT NOT NULL DEFAULT 'pcs',
    description TEXT,
    reorder_level INTEGER NOT NULL DEFAULT 10,
    tax_rate REAL NOT NULL DEFAULT 16.0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Price lists
CREATE TABLE IF NOT EXISTS price_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    markup_percent REAL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Product prices (per price list)
CREATE TABLE IF NOT EXISTS product_prices (
    product_id TEXT NOT NULL REFERENCES products(id),
    price_list_id TEXT NOT NULL REFERENCES price_lists(id),
    buying_price REAL NOT NULL DEFAULT 0,
    selling_price REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (product_id, price_list_id)
);

-- Batches (stock lots with expiry)
CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    batch_number TEXT,
    quantity REAL NOT NULL DEFAULT 0,
    buying_price REAL NOT NULL DEFAULT 0,
    expiry_date TEXT,
    received_at TEXT NOT NULL DEFAULT (datetime('now')),
    supplier_id TEXT REFERENCES suppliers(id)
);

-- Stock movements (audit trail)
CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    batch_id TEXT REFERENCES batches(id),
    type TEXT NOT NULL CHECK (type IN ('purchase','sale','adjustment','return','damage','transfer')),
    quantity REAL NOT NULL,
    reference_type TEXT,
    reference_id TEXT,
    notes TEXT,
    user_id TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    payment_terms TEXT,
    balance_owed REAL NOT NULL DEFAULT 0,
    notes TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    customer_group_id TEXT REFERENCES customer_groups(id),
    credit_limit REAL NOT NULL DEFAULT 0,
    balance REAL NOT NULL DEFAULT 0,
    notes TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Customer groups (linked to price lists)
CREATE TABLE IF NOT EXISTS customer_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_list_id TEXT REFERENCES price_lists(id),
    discount_percent REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tax rates
CREATE TABLE IF NOT EXISTS tax_rates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rate_percent REAL NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
);

-- Seed default price list
INSERT OR IGNORE INTO price_lists (id, name, is_default) VALUES ('default', 'Retail', 1);

-- Seed default tax rates
INSERT OR IGNORE INTO tax_rates (id, name, rate_percent, is_default) VALUES ('vat16', 'VAT 16%', 16.0, 1);
INSERT OR IGNORE INTO tax_rates (id, name, rate_percent) VALUES ('exempt', 'Exempt', 0.0);
INSERT OR IGNORE INTO tax_rates (id, name, rate_percent) VALUES ('zero', 'Zero Rated', 0.0);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_batches_product ON batches(product_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
