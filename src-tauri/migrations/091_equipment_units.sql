-- ============================================================================
-- 091_equipment_units.sql
-- Equipment layer for the Hardware & Equipment module (DMS Phase 1).
--
-- Turns ordinary "physical" products into serialized machines when needed:
-- one physical unit = one serial = one tracked record that follows the
-- machine through its whole life (in_stock -> sold -> in_service -> ...).
-- Warranty is per-unit and derived from the sale date. Catalog-level specs
-- (make/model/engine/rating) live as JSON on the product so new attributes
-- never need a migration; per-unit facts (serial, engine no, hours) are
-- first-class columns because they're queried + must be unique.
--
-- products.kind stays 'physical' — equipment IS physical stock; serial
-- tracking is an overlay flag, so no CHECK-constraint table rebuild.
-- ============================================================================

-- Product-level flags/specs -------------------------------------------------
ALTER TABLE products ADD COLUMN tracked_by_serial INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN warranty_months INTEGER;          -- default warranty for this model
ALTER TABLE products ADD COLUMN specs_json TEXT;                  -- catalog specs: make, model, category, engine_power, fuel, weight, rating...

-- Per-unit registry ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipment_units (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    serial_number TEXT NOT NULL,
    engine_number TEXT,
    chassis_number TEXT,
    year_of_manufacture INTEGER,
    condition TEXT NOT NULL DEFAULT 'new'           -- new | used | refurbished
        CHECK (condition IN ('new','used','refurbished')),
    status TEXT NOT NULL DEFAULT 'in_stock'         -- lifecycle state
        CHECK (status IN ('in_stock','reserved','sold','rented','in_service','written_off')),
    acquisition_cost REAL,
    acquired_at TEXT NOT NULL DEFAULT (datetime('now')),
    branch_id TEXT,
    location TEXT,
    meter_value REAL,                               -- hours / km on the clock
    meter_unit TEXT DEFAULT 'hours',                -- hours | km
    -- sale linkage (set when sold) ----------------------------------------
    sale_id TEXT REFERENCES sales(id),
    customer_id TEXT REFERENCES customers(id),
    sold_at TEXT,
    -- warranty (derived from the sale) ------------------------------------
    warranty_months INTEGER,
    warranty_start TEXT,
    warranty_expiry TEXT,
    -- per-unit spec overrides ---------------------------------------------
    specs_json TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Serial numbers are unique across the fleet.
CREATE UNIQUE INDEX IF NOT EXISTS idx_equipment_units_serial ON equipment_units(serial_number);
CREATE INDEX IF NOT EXISTS idx_equipment_units_product ON equipment_units(product_id);
CREATE INDEX IF NOT EXISTS idx_equipment_units_status ON equipment_units(status);
CREATE INDEX IF NOT EXISTS idx_equipment_units_customer ON equipment_units(customer_id);
CREATE INDEX IF NOT EXISTS idx_equipment_units_warranty ON equipment_units(warranty_expiry);
CREATE INDEX IF NOT EXISTS idx_equipment_units_sale ON equipment_units(sale_id);
