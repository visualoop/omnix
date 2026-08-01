-- Production runtime for the typed command API.
-- Money is stored in integer minor units and quantities in integer thousandths.

CREATE TABLE authenticated_sessions (
  id TEXT PRIMARY KEY,
  token_hash BLOB NOT NULL UNIQUE CHECK(length(token_hash) = 32),
  user_id TEXT NOT NULL REFERENCES users(id),
  node_id TEXT NOT NULL REFERENCES devices(id),
  access_mode TEXT NOT NULL CHECK (access_mode IN ('desktop','android','browser_read_only')),
  authentication_level TEXT NOT NULL CHECK (authentication_level IN ('device_paired','user','elevated')),
  branch_local INTEGER NOT NULL DEFAULT 0 CHECK (branch_local IN (0,1)),
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX idx_authenticated_sessions_user ON authenticated_sessions(user_id, expires_at);
CREATE INDEX idx_authenticated_sessions_node ON authenticated_sessions(node_id, expires_at);

CREATE TABLE command_ledger (
  command_id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('processing','completed')),
  user_id TEXT NOT NULL REFERENCES users(id),
  node_id TEXT NOT NULL REFERENCES devices(id),
  session_id TEXT NOT NULL REFERENCES authenticated_sessions(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  command_type TEXT NOT NULL,
  expected_revision INTEGER NOT NULL,
  authentication_level TEXT NOT NULL,
  response_json TEXT,
  resulting_revision INTEGER,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX idx_command_ledger_processing ON command_ledger(state, created_at);

CREATE TABLE command_outbox (
  id TEXT PRIMARY KEY,
  command_id TEXT NOT NULL UNIQUE REFERENCES command_ledger(command_id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  aggregate_revision INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error_code TEXT
);
CREATE INDEX idx_command_outbox_pending ON command_outbox(created_at) WHERE published_at IS NULL;

CREATE TABLE branch_inventory_items (
  branch_id TEXT NOT NULL REFERENCES branches(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  barcode TEXT,
  unit TEXT NOT NULL,
  buying_price_minor INTEGER NOT NULL CHECK (buying_price_minor >= 0),
  selling_price_minor INTEGER NOT NULL CHECK (selling_price_minor >= 0),
  reorder_level_milli INTEGER NOT NULL CHECK (reorder_level_milli >= 0),
  quantity_milli INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (branch_id, product_id),
  UNIQUE (branch_id, sku)
);
CREATE INDEX idx_branch_inventory_revision ON branch_inventory_items(branch_id, revision, product_id);

CREATE TABLE branch_customers (
  branch_id TEXT NOT NULL REFERENCES branches(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  credit_limit_minor INTEGER NOT NULL DEFAULT 0 CHECK (credit_limit_minor >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (branch_id, customer_id)
);
CREATE INDEX idx_branch_customers_revision ON branch_customers(branch_id, revision, customer_id);

CREATE TABLE branch_stock (
  branch_id TEXT NOT NULL REFERENCES branches(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity_milli INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (branch_id, product_id)
);

CREATE TABLE stock_movements_v2 (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  batch_id TEXT REFERENCES batches(id),
  movement_kind TEXT NOT NULL,
  quantity_delta_milli INTEGER NOT NULL CHECK (quantity_delta_milli <> 0),
  reason_code TEXT NOT NULL,
  notes TEXT,
  user_id TEXT NOT NULL REFERENCES users(id),
  revision INTEGER NOT NULL CHECK (revision > 0),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_stock_movements_v2_branch ON stock_movements_v2(branch_id, created_at DESC, id DESC);

ALTER TABLE sales ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE purchase_orders ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE cash_register ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;

-- Explicit compatibility gate and hashed scope for old paired desktop tills.
ALTER TABLE api_tokens ADD COLUMN token_hash BLOB;
ALTER TABLE api_tokens ADD COLUMN token_scope TEXT NOT NULL DEFAULT 'legacy_trusted_lan';
ALTER TABLE api_tokens ADD COLUMN legacy_enabled INTEGER NOT NULL DEFAULT 1 CHECK(legacy_enabled IN (0,1));
CREATE UNIQUE INDEX idx_api_tokens_hash_scope ON api_tokens(token_hash, token_scope) WHERE token_hash IS NOT NULL;
INSERT OR IGNORE INTO settings(key, value, category)
SELECT 'network.legacy_trusted_lan',
       CASE WHEN EXISTS(SELECT 1 FROM api_tokens WHERE revoked = 0) THEN '1' ELSE '0' END,
       'network';

-- Backfill deterministic branch projections. SQLite round() is explicit here;
-- no legacy REAL value is reinterpreted as an integer.
INSERT INTO branch_inventory_items (
  branch_id, product_id, name, sku, barcode, unit, buying_price_minor,
  selling_price_minor, reorder_level_milli, quantity_milli, active, revision, updated_at
)
SELECT b.id, p.id, p.name, COALESCE(NULLIF(p.sku, ''), p.id), p.barcode, p.unit,
       CAST(round(COALESCE(pp.buying_price, 0) * 100.0) AS INTEGER),
       CAST(round(COALESCE(pp.selling_price, 0) * 100.0) AS INTEGER),
       CAST(round(COALESCE(p.reorder_level, 0) * 1000.0) AS INTEGER),
       CAST(round(COALESCE(bs.quantity, 0) * 1000.0) AS INTEGER),
       p.active, 1, COALESCE(p.updated_at, datetime('now'))
FROM branches b
CROSS JOIN products p
LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.price_list_id = 'default'
LEFT JOIN (
  SELECT branch_id, product_id, SUM(quantity) AS quantity
  FROM batches GROUP BY branch_id, product_id
) bs ON bs.branch_id = b.id AND bs.product_id = p.id
WHERE b.active = 1;

INSERT INTO branch_stock(branch_id, product_id, quantity_milli, revision, updated_at)
SELECT branch_id, product_id, quantity_milli, 1, updated_at FROM branch_inventory_items;

INSERT INTO branch_customers (
  branch_id, customer_id, name, phone, email, credit_limit_minor, active, revision, updated_at
)
SELECT b.id, c.id, c.name, c.phone, c.email,
       CAST(round(COALESCE(c.credit_limit, 0) * 100.0) AS INTEGER),
       c.active, 1, datetime('now')
FROM branches b CROSS JOIN customers c
WHERE b.active = 1;
