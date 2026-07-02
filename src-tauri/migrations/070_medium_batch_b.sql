-- ============================================================================
-- 070_medium_batch_b.sql — Hospitality (portion control, bar inventory,
-- waiter stations, split/merge, group bookings), Pharmacy (compounded scripts),
-- Home delivery workflow, Hardware contractor holds.
-- ============================================================================

-- ─── Portion control (Task 45) ─────────────────────────
ALTER TABLE recipes ADD COLUMN portion_size REAL NOT NULL DEFAULT 1;
ALTER TABLE recipes ADD COLUMN std_cost REAL NOT NULL DEFAULT 0;
ALTER TABLE recipes ADD COLUMN std_price REAL NOT NULL DEFAULT 0;

-- Track daily theoretical vs actual usage.
CREATE TABLE IF NOT EXISTS food_cost_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_date TEXT NOT NULL,
  recipe_id TEXT NOT NULL REFERENCES recipes(id),
  units_sold REAL NOT NULL DEFAULT 0,
  theoretical_cost REAL NOT NULL DEFAULT 0,
  actual_cost REAL NOT NULL DEFAULT 0,
  variance_pct REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (snapshot_date, recipe_id)
);

-- ─── Bar inventory (Task 46) ───────────────────────────
CREATE TABLE IF NOT EXISTS bar_inventory_counts (
  id TEXT PRIMARY KEY,
  count_date TEXT NOT NULL,
  bottle_product_id TEXT NOT NULL REFERENCES products(id),
  opening_ml REAL NOT NULL,
  received_ml REAL NOT NULL DEFAULT 0,
  sold_theoretical_ml REAL NOT NULL DEFAULT 0,
  closing_ml REAL NOT NULL,
  variance_ml REAL NOT NULL,             -- opening + received - sold_theoretical - closing
  variance_pct REAL,
  counted_by TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bar_count_date ON bar_inventory_counts(count_date DESC);

-- ─── Waiter station assignments (Task 47) ───────────────
CREATE TABLE IF NOT EXISTS waiter_assignments (
  id TEXT PRIMARY KEY,
  waiter_id TEXT NOT NULL REFERENCES employees(id),
  table_id TEXT REFERENCES dining_tables(id),
  section TEXT,                          -- 'north', 'south', 'terrace', 'bar'
  shift_start TEXT,
  shift_end TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Course coursing on order items.
ALTER TABLE hospitality_order_items ADD COLUMN course TEXT;
-- 'appetizer' | 'main' | 'dessert' | 'drink' | null
ALTER TABLE hospitality_order_items ADD COLUMN fire_after_course TEXT;
-- e.g. 'appetizer' → wait until every appetizer bumped before firing this line

-- ─── Split-bill / merge-table / transfer (Task 48) ─────
-- We use parent_order_id to represent split parts.
ALTER TABLE hospitality_orders ADD COLUMN parent_order_id TEXT REFERENCES hospitality_orders(id);
ALTER TABLE hospitality_orders ADD COLUMN split_from_order_id TEXT REFERENCES hospitality_orders(id);
ALTER TABLE hospitality_orders ADD COLUMN merged_into_order_id TEXT REFERENCES hospitality_orders(id);

-- ─── Group bookings + rate plans + deposits (Task 49) ──
ALTER TABLE bookings ADD COLUMN group_id TEXT;
-- All bookings with the same group_id are a party (e.g. wedding block).
-- bookings.deposit_amount + rate_plan_id already exist from migration 035.
ALTER TABLE bookings ADD COLUMN deposit_paid_at TEXT;
CREATE INDEX IF NOT EXISTS idx_bookings_group ON bookings(group_id);

CREATE TABLE IF NOT EXISTS rate_plan_seasonal_prices (
  id TEXT PRIMARY KEY,
  rate_plan_id TEXT NOT NULL REFERENCES rate_plans(id) ON DELETE CASCADE,
  season_name TEXT NOT NULL,             -- 'High', 'Low', 'Christmas'
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  nightly_rate REAL NOT NULL,
  min_stay_nights INTEGER DEFAULT 1
);

-- ─── Compounded prescriptions (Task 50) ─────────────────
CREATE TABLE IF NOT EXISTS compounded_prescriptions (
  id TEXT PRIMARY KEY,
  prescription_id TEXT NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  output_name TEXT NOT NULL,             -- 'Custom cream 2%'
  output_quantity REAL NOT NULL,
  output_unit TEXT NOT NULL,
  labour_cost REAL NOT NULL DEFAULT 0,
  total_cost REAL NOT NULL DEFAULT 0,
  compounded_by TEXT,
  compounded_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS compounded_components (
  id TEXT PRIMARY KEY,
  compounded_id TEXT NOT NULL REFERENCES compounded_prescriptions(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity_used REAL NOT NULL,
  unit_cost REAL NOT NULL,
  line_cost REAL NOT NULL
);

-- ─── Home delivery / rider workflow (Task 51) ───────────
CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  delivery_number TEXT NOT NULL UNIQUE,  -- 'DEL-2026-00001'
  sale_id TEXT REFERENCES sales(id),
  invoice_id TEXT REFERENCES invoices(id),
  customer_id TEXT REFERENCES customers(id),
  customer_name TEXT,
  customer_phone TEXT,
  delivery_address TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  rider_id TEXT REFERENCES employees(id),
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'assigned' | 'picked_up' | 'en_route' | 'delivered' | 'failed'
  scheduled_at TEXT,
  picked_up_at TEXT,
  delivered_at TEXT,
  delivery_fee REAL NOT NULL DEFAULT 0,
  proof_photo_url TEXT,
  proof_signature TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_deliveries_rider ON deliveries(rider_id, status);

-- ─── Hardware contractor holds (Task 52) ────────────────
-- customer_accounts.credit_limit + on_hold already exist from migration 031.
ALTER TABLE customer_accounts ADD COLUMN days_overdue_hold INTEGER NOT NULL DEFAULT 60;
ALTER TABLE customer_accounts ADD COLUMN on_hold_at TEXT;
ALTER TABLE customer_accounts ADD COLUMN on_hold_reason TEXT;
