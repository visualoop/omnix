-- ============================================================================
-- 016_branches.sql
-- Multi-location / multi-branch support.
-- ============================================================================
--
-- Adds the concept of branches (shops/outlets) so an SME can run >1 location.
-- Every transactional record gets a branch_id. A user can be assigned to one
-- or more branches and switches between them in the topbar.
--
-- For existing single-location installs, we create a default "Main Branch"
-- and backfill all existing rows to point at it. New installs get the
-- default branch as part of setup.

CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,           -- short code like "MAIN", "WL-2", used on receipts
    name TEXT NOT NULL,                  -- "Main Branch", "Westlands Branch"
    address TEXT,
    phone TEXT,
    email TEXT,
    manager_id TEXT REFERENCES users(id),
    is_default INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    timezone TEXT NOT NULL DEFAULT 'Africa/Nairobi',
    -- KRA / compliance per branch (some chains have separate TINs per branch)
    kra_pin TEXT,
    etims_device_id TEXT,
    -- Operating hours (optional)
    open_time TEXT,                      -- "08:00"
    close_time TEXT,                     -- "20:00"
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_branches_active ON branches(active);

-- Seed: default branch for existing installs.
-- Use a stable ID so backfill is deterministic.
INSERT OR IGNORE INTO branches (id, code, name, is_default, active)
VALUES ('default-branch', 'MAIN', 'Main Branch', 1, 1);

-- User → Branch assignment (a user can work at multiple branches)
CREATE TABLE IF NOT EXISTS user_branches (
    user_id TEXT NOT NULL REFERENCES users(id),
    branch_id TEXT NOT NULL REFERENCES branches(id),
    is_primary INTEGER NOT NULL DEFAULT 0,
    granted_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_user_branches_user ON user_branches(user_id);

-- Auto-assign existing users to the default branch
INSERT OR IGNORE INTO user_branches (user_id, branch_id, is_primary)
SELECT id, 'default-branch', 1 FROM users WHERE active = 1;

-- ─── Tag transactional tables with branch_id ─────────────────────────────
-- We use ALTER TABLE ADD COLUMN with default + NOT NULL workaround:
-- SQLite doesn't allow NOT NULL without DEFAULT on ALTER, so we set a
-- default of 'default-branch' which references the seeded branch above.

ALTER TABLE sales ADD COLUMN branch_id TEXT NOT NULL DEFAULT 'default-branch' REFERENCES branches(id);
CREATE INDEX IF NOT EXISTS idx_sales_branch ON sales(branch_id, created_at DESC);

ALTER TABLE expenses ADD COLUMN branch_id TEXT NOT NULL DEFAULT 'default-branch' REFERENCES branches(id);
CREATE INDEX IF NOT EXISTS idx_expenses_branch ON expenses(branch_id);

ALTER TABLE cash_register ADD COLUMN branch_id TEXT NOT NULL DEFAULT 'default-branch' REFERENCES branches(id);
CREATE INDEX IF NOT EXISTS idx_cash_register_branch ON cash_register(branch_id);

ALTER TABLE petty_cash ADD COLUMN branch_id TEXT NOT NULL DEFAULT 'default-branch' REFERENCES branches(id);

ALTER TABLE customer_payments ADD COLUMN branch_id TEXT NOT NULL DEFAULT 'default-branch' REFERENCES branches(id);

ALTER TABLE supplier_payments ADD COLUMN branch_id TEXT NOT NULL DEFAULT 'default-branch' REFERENCES branches(id);

ALTER TABLE sale_returns ADD COLUMN branch_id TEXT NOT NULL DEFAULT 'default-branch' REFERENCES branches(id);

-- Purchase orders are per-branch (which branch is receiving)
ALTER TABLE purchase_orders ADD COLUMN branch_id TEXT NOT NULL DEFAULT 'default-branch' REFERENCES branches(id);
CREATE INDEX IF NOT EXISTS idx_po_branch ON purchase_orders(branch_id);

-- Stock takes are per-branch
ALTER TABLE stock_takes ADD COLUMN branch_id TEXT NOT NULL DEFAULT 'default-branch' REFERENCES branches(id);

-- ─── Stock-per-branch (inventory broken out by location) ──────────────────
-- Strategy: keep products.* as the canonical product list, but stock lives
-- in stock_levels (product_id, branch_id, quantity). The legacy `batches`
-- table also gets branch_id so we know where each batch is.

ALTER TABLE batches ADD COLUMN branch_id TEXT NOT NULL DEFAULT 'default-branch' REFERENCES branches(id);
CREATE INDEX IF NOT EXISTS idx_batches_branch_product ON batches(branch_id, product_id);

CREATE TABLE IF NOT EXISTS stock_transfers (
    id TEXT PRIMARY KEY,
    transfer_number TEXT UNIQUE NOT NULL,
    from_branch_id TEXT NOT NULL REFERENCES branches(id),
    to_branch_id TEXT NOT NULL REFERENCES branches(id),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_transit','received','cancelled')),
    transfer_date TEXT NOT NULL DEFAULT (date('now')),
    received_date TEXT,
    user_id TEXT NOT NULL REFERENCES users(id),
    received_by TEXT REFERENCES users(id),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id TEXT PRIMARY KEY,
    transfer_id TEXT NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    batch_id TEXT REFERENCES batches(id),
    product_name TEXT NOT NULL,
    quantity_sent REAL NOT NULL,
    quantity_received REAL NOT NULL DEFAULT 0,
    unit_cost REAL,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_transfer_items ON stock_transfer_items(transfer_id);
