-- ============================================================================
-- 025_product_uoms.sql
-- Per-pack vs per-unit conversion (carton of 24 → 24 individual units)
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_uoms (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                       -- "Carton of 24", "Box of 12"
    quantity_per REAL NOT NULL CHECK (quantity_per > 0),
    barcode TEXT,                              -- carton-level barcode (often different from unit)
    selling_price REAL,                        -- override if selling whole pack at non-pro-rata
    buying_price REAL,
    is_default_purchase INTEGER NOT NULL DEFAULT 0,
    is_default_sale INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_product_uoms_product ON product_uoms(product_id);
CREATE INDEX IF NOT EXISTS idx_product_uoms_barcode ON product_uoms(barcode);
