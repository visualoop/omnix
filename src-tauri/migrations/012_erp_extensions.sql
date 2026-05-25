-- Phase 11: ERP completeness — Procurement, Returns, Stock Take, Patient Profiles

-- ===== Purchase Orders =====

CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    po_number TEXT NOT NULL UNIQUE,
    supplier_id TEXT NOT NULL REFERENCES suppliers(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    order_date TEXT NOT NULL DEFAULT (date('now')),
    expected_date TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','partial','received','cancelled')),
    subtotal REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    paid_amount REAL NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id TEXT PRIMARY KEY,
    po_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    received_quantity REAL NOT NULL DEFAULT 0,
    unit_cost REAL NOT NULL,
    line_total REAL NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS goods_receipts (
    id TEXT PRIMARY KEY,
    grn_number TEXT NOT NULL UNIQUE,
    po_id TEXT REFERENCES purchase_orders(id),
    supplier_id TEXT REFERENCES suppliers(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    receipt_date TEXT NOT NULL DEFAULT (date('now')),
    invoice_number TEXT,
    notes TEXT,
    total REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS goods_receipt_items (
    id TEXT PRIMARY KEY,
    grn_id TEXT NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
    po_item_id TEXT REFERENCES purchase_order_items(id),
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity REAL NOT NULL,
    unit_cost REAL NOT NULL,
    batch_number TEXT,
    expiry_date TEXT,
    line_total REAL NOT NULL
);

-- ===== Sale Returns =====

CREATE TABLE IF NOT EXISTS sale_returns (
    id TEXT PRIMARY KEY,
    return_number TEXT NOT NULL UNIQUE,
    sale_id TEXT REFERENCES sales(id),
    customer_id TEXT REFERENCES customers(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    return_date TEXT NOT NULL DEFAULT (date('now')),
    reason TEXT NOT NULL,
    refund_method TEXT NOT NULL DEFAULT 'cash',
    refund_amount REAL NOT NULL,
    restock_to_inventory INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sale_return_items (
    id TEXT PRIMARY KEY,
    return_id TEXT NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
    sale_item_id TEXT REFERENCES sale_items(id),
    product_id TEXT NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    line_total REAL NOT NULL,
    reason TEXT
);

-- ===== Stock Takes =====

CREATE TABLE IF NOT EXISTS stock_takes (
    id TEXT PRIMARY KEY,
    reference TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL REFERENCES users(id),
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','cancelled')),
    notes TEXT,
    total_variance REAL NOT NULL DEFAULT 0,
    total_value_variance REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stock_take_items (
    id TEXT PRIMARY KEY,
    stock_take_id TEXT NOT NULL REFERENCES stock_takes(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    expected_quantity REAL NOT NULL,
    counted_quantity REAL,
    variance REAL,
    unit_cost REAL,
    value_variance REAL,
    counted_at TEXT,
    notes TEXT
);

-- ===== Patient Profiles (pharmacy module) =====
-- Extends customers with pharmacy-specific medical info.

CREATE TABLE IF NOT EXISTS patient_profiles (
    customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
    date_of_birth TEXT,
    gender TEXT CHECK (gender IN ('male','female','other')),
    blood_type TEXT,
    weight_kg REAL,
    height_cm REAL,
    pregnant INTEGER NOT NULL DEFAULT 0,
    breastfeeding INTEGER NOT NULL DEFAULT 0,
    chronic_conditions TEXT,           -- comma-separated or JSON array
    current_medications TEXT,          -- ongoing meds (free text or JSON)
    notes TEXT,
    emergency_contact TEXT,
    emergency_phone TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS patient_allergies (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    allergen TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'mild' CHECK (severity IN ('mild','moderate','severe','life-threatening')),
    reaction TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_grn_po ON goods_receipts(po_id);
CREATE INDEX IF NOT EXISTS idx_returns_sale ON sale_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_returns_customer ON sale_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_stock_take_status ON stock_takes(status);
CREATE INDEX IF NOT EXISTS idx_allergies_customer ON patient_allergies(customer_id);
