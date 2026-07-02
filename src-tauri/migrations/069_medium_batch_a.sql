-- ============================================================================
-- 069_medium_batch_a.sql — Cost centres, landed cost, recurring expenses,
-- multi-warehouse (bins), and assembly / manufacturing BOM.
-- ============================================================================

-- ─── Cost centres (Task 39) ─────────────────────────────
-- A cost centre is a project / branch / campaign that expenses + revenue can
-- be tagged with. Reports can then produce per-cost-centre P&L.
CREATE TABLE IF NOT EXISTS cost_centres (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,             -- 'PROJ-001', 'CAMP-BLACK-FRIDAY'
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES cost_centres(id),
  budget REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Optional cost_centre_id on money-touching entities.
ALTER TABLE expenses ADD COLUMN cost_centre_id TEXT REFERENCES cost_centres(id);
ALTER TABLE sales ADD COLUMN cost_centre_id TEXT REFERENCES cost_centres(id);
ALTER TABLE purchase_orders ADD COLUMN cost_centre_id TEXT REFERENCES cost_centres(id);

-- ─── Landed cost allocation on GRN (Task 41) ────────────
-- On receipt, allocate freight/duty/insurance proportionally to received lines.
CREATE TABLE IF NOT EXISTS landed_costs (
  id TEXT PRIMARY KEY,
  goods_receipt_id TEXT NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  cost_type TEXT NOT NULL,               -- 'freight' | 'duty' | 'insurance' | 'clearing' | 'other'
  amount REAL NOT NULL,
  allocation_basis TEXT NOT NULL DEFAULT 'value', -- 'value' | 'weight' | 'quantity'
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Recurring expenses (Task 42) ───────────────────────
-- Rent, salaries, subscriptions — auto-post to expenses on schedule.
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                    -- 'Shop rent'
  category_id TEXT REFERENCES expense_categories(id),
  amount REAL NOT NULL,
  frequency TEXT NOT NULL,               -- 'monthly' | 'weekly' | 'quarterly' | 'annually'
  day_of_month INTEGER,                  -- 1-31 (or null for weekly)
  next_due_date TEXT NOT NULL,
  payment_source TEXT NOT NULL DEFAULT 'bank', -- 'cash' | 'bank' | 'mpesa' | 'petty_cash'
  cost_centre_id TEXT REFERENCES cost_centres(id),
  auto_post INTEGER NOT NULL DEFAULT 1,  -- 0 = notify only, 1 = auto-create expense
  active INTEGER NOT NULL DEFAULT 1,
  last_posted_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_recurring_due ON recurring_expenses(active, next_due_date);

-- ─── Multi-warehouse (bin locations) (Task 43) ──────────
-- Every branch can have multiple physical zones (front shelf, back store,
-- cold room). Batches optionally live in a bin.
CREATE TABLE IF NOT EXISTS warehouse_bins (
  id TEXT PRIMARY KEY,
  branch_id TEXT REFERENCES branches(id),
  code TEXT NOT NULL,                    -- 'A-1', 'COLD-01'
  name TEXT NOT NULL,
  bin_type TEXT,                         -- 'shelf' | 'back_store' | 'cold_chain' | 'quarantine'
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (branch_id, code)
);

ALTER TABLE batches ADD COLUMN bin_id TEXT REFERENCES warehouse_bins(id);

-- ─── Assembly / manufacturing BOM (Task 44) ─────────────
-- Bakeries, ice makers, chapati vendors — produce output X consuming
-- ingredients from raw stock.
CREATE TABLE IF NOT EXISTS assembly_bom (
  id TEXT PRIMARY KEY,
  output_product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  yield_quantity REAL NOT NULL DEFAULT 1,
  labour_cost REAL NOT NULL DEFAULT 0,
  overhead_cost REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assembly_bom_ingredients (
  id TEXT PRIMARY KEY,
  bom_id TEXT NOT NULL REFERENCES assembly_bom(id) ON DELETE CASCADE,
  ingredient_product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity REAL NOT NULL,
  unit_of_measure TEXT
);

-- Production runs record actual output + consumed ingredients.
CREATE TABLE IF NOT EXISTS production_runs (
  id TEXT PRIMARY KEY,
  run_number TEXT NOT NULL UNIQUE,       -- 'PR-2026-00001'
  bom_id TEXT NOT NULL REFERENCES assembly_bom(id),
  output_quantity REAL NOT NULL,
  produced_at TEXT NOT NULL DEFAULT (datetime('now')),
  produced_by TEXT,
  total_cost REAL NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'completed' -- 'completed' | 'cancelled'
);
CREATE INDEX IF NOT EXISTS idx_production_bom ON production_runs(bom_id, produced_at);
