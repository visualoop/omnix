-- Omnix Sales & POS Schema

-- Payment methods (configurable)
CREATE TABLE IF NOT EXISTS payment_methods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'manual',
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- Sales
CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    sale_number INTEGER NOT NULL,
    customer_id TEXT REFERENCES customers(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    subtotal REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid')),
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','voided','held')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sale items
CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL REFERENCES sales(id),
    product_id TEXT NOT NULL REFERENCES products(id),
    batch_id TEXT REFERENCES batches(id),
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    discount REAL NOT NULL DEFAULT 0,
    tax_rate REAL NOT NULL DEFAULT 16.0,
    total REAL NOT NULL
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL REFERENCES sales(id),
    method_id TEXT NOT NULL REFERENCES payment_methods(id),
    method_name TEXT NOT NULL,
    amount REAL NOT NULL,
    reference TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Held sales (parked carts)
CREATE TABLE IF NOT EXISTS held_sales (
    id TEXT PRIMARY KEY,
    cart_json TEXT NOT NULL,
    customer_id TEXT,
    note TEXT,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sale number sequence
CREATE TABLE IF NOT EXISTS sequences (
    name TEXT PRIMARY KEY,
    value INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO sequences (name, value) VALUES ('sale_number', 0);

-- Seed default payment methods
INSERT OR IGNORE INTO payment_methods (id, name, type, sort_order) VALUES ('cash', 'Cash', 'cash', 1);
INSERT OR IGNORE INTO payment_methods (id, name, type, sort_order) VALUES ('mpesa-manual', 'M-Pesa', 'manual', 2);
INSERT OR IGNORE INTO payment_methods (id, name, type, sort_order) VALUES ('bank', 'Bank Transfer', 'manual', 3);
INSERT OR IGNORE INTO payment_methods (id, name, type, sort_order) VALUES ('credit', 'Credit (On Account)', 'credit', 4);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);
