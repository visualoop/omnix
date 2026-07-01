-- ============================================================================
-- 065_inventory_extensions.sql — Bundles/kits, Serials, Cycle counts, Damages,
-- Reorder suggestions.
-- ============================================================================

-- ─── Bundles / kits / composite products ────────────────────
CREATE TABLE IF NOT EXISTS bundle_components (
  id TEXT PRIMARY KEY,
  bundle_product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  component_product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity REAL NOT NULL DEFAULT 1,
  discount_pct REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (bundle_product_id, component_product_id)
);
CREATE INDEX IF NOT EXISTS idx_bundle_parent ON bundle_components(bundle_product_id);
CREATE INDEX IF NOT EXISTS idx_bundle_child ON bundle_components(component_product_id);

-- ─── Serial-number tracking ─────────────────────────────────
CREATE TABLE IF NOT EXISTS product_serials (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_id TEXT REFERENCES batches(id),
  serial TEXT NOT NULL,                 -- IMEI, SN, etc.
  status TEXT NOT NULL DEFAULT 'in_stock', -- 'in_stock' | 'sold' | 'returned' | 'damaged' | 'quarantined'
  sale_id TEXT REFERENCES sales(id),
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  sold_at TEXT,
  warranty_until TEXT,
  notes TEXT,
  UNIQUE (product_id, serial)
);
CREATE INDEX IF NOT EXISTS idx_serials_status ON product_serials(status);
CREATE INDEX IF NOT EXISTS idx_serials_sale ON product_serials(sale_id);

-- ─── Cycle counts (scheduled partial counts) ────────────────
CREATE TABLE IF NOT EXISTS cycle_count_schedules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                   -- 'Top-100 fast movers weekly'
  category_id TEXT REFERENCES categories(id),
  frequency TEXT NOT NULL,              -- 'daily' | 'weekly' | 'monthly'
  last_run_at TEXT,
  next_due_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cycle_counts (
  id TEXT PRIMARY KEY,
  schedule_id TEXT REFERENCES cycle_count_schedules(id) ON DELETE SET NULL,
  count_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress' | 'completed' | 'cancelled'
  counted_by TEXT,
  notes TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cycle_count_items (
  id TEXT PRIMARY KEY,
  cycle_count_id TEXT NOT NULL REFERENCES cycle_counts(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  system_qty REAL NOT NULL,
  counted_qty REAL,                     -- null until counted
  variance REAL,
  reason TEXT
);

-- ─── Damages register (separate from shrinkage) ─────────────
CREATE TABLE IF NOT EXISTS damages (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  batch_id TEXT REFERENCES batches(id),
  quantity REAL NOT NULL,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  discovered_at_stage TEXT NOT NULL,    -- 'on_receipt' | 'in_store' | 'in_transit'
  supplier_return_id TEXT REFERENCES supplier_returns(id),
  reason TEXT,
  reported_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_damages_product ON damages(product_id, occurred_at);

-- ─── Reorder suggestions (velocity-based) ──────────────────
CREATE TABLE IF NOT EXISTS reorder_suggestions (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  suggested_qty REAL NOT NULL,
  velocity_30d REAL,                    -- units sold per day, past 30d
  days_of_cover REAL,                   -- current stock / velocity
  lead_time_days INTEGER,
  reason TEXT,                          -- 'below_reorder' | 'stockout' | 'expected_stockout'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'ordered' | 'dismissed'
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (product_id, status) ON CONFLICT REPLACE
);
CREATE INDEX IF NOT EXISTS idx_reorder_status ON reorder_suggestions(status);
