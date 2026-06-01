-- ============================================================================
-- 034_hospitality_service_charge.sql — Service charge (plan 08 Batch 4)
-- Service charge rules + allocations to employees. Separated from product
-- revenue in reporting. Tips reuse the existing 024_tips.sql model.
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_charge_rules (
    id TEXT PRIMARY KEY,
    branch_id TEXT,
    name TEXT NOT NULL,
    percent REAL NOT NULL DEFAULT 0,
    applies_to TEXT NOT NULL DEFAULT 'dine_in'
      CHECK (applies_to IN ('dine_in','room_service','all')),
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS service_charge_allocations (
    id TEXT PRIMARY KEY,
    sale_id TEXT REFERENCES sales(id),
    order_id TEXT REFERENCES hospitality_orders(id),
    employee_id TEXT REFERENCES employees(id),
    amount REAL NOT NULL,
    allocation_method TEXT NOT NULL DEFAULT 'waiter'
      CHECK (allocation_method IN ('waiter','pool','manual')),
    payroll_period TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sca_employee ON service_charge_allocations(employee_id);
CREATE INDEX IF NOT EXISTS idx_sca_sale ON service_charge_allocations(sale_id);
