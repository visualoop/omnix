-- ============================================================================
-- 066_sales_pricing_extensions.sql — Customer groups, coupons, gift cards,
-- discount rules engine, sales targets, generic commissions.
-- ============================================================================

-- ─── Customer groups + tier pricing ─────────────────────────
-- customer_groups (id, name, price_list_id, discount_percent) + customers.customer_group_id
-- ALREADY EXIST from migration 002. This migration only adds fields we need going forward.
ALTER TABLE customer_groups ADD COLUMN credit_limit REAL;
ALTER TABLE customer_groups ADD COLUMN active INTEGER NOT NULL DEFAULT 1;

-- ─── Coupons + gift cards ──────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL,          -- 'percent' | 'amount'
  discount_value REAL NOT NULL,
  min_purchase REAL NOT NULL DEFAULT 0,
  valid_from TEXT,
  valid_until TEXT,
  max_redemptions INTEGER,              -- null = unlimited
  redemptions_count INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id TEXT PRIMARY KEY,
  coupon_id TEXT NOT NULL REFERENCES coupons(id),
  sale_id TEXT NOT NULL REFERENCES sales(id),
  customer_id TEXT REFERENCES customers(id),
  amount_off REAL NOT NULL,
  redeemed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gift_cards (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  initial_balance REAL NOT NULL,
  current_balance REAL NOT NULL,
  issued_to_customer_id TEXT REFERENCES customers(id),
  issued_by_user_id TEXT,
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'depleted' | 'expired' | 'cancelled'
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards(status);

CREATE TABLE IF NOT EXISTS gift_card_transactions (
  id TEXT PRIMARY KEY,
  gift_card_id TEXT NOT NULL REFERENCES gift_cards(id),
  sale_id TEXT REFERENCES sales(id),
  amount REAL NOT NULL,                  -- negative = redemption, positive = top-up
  balance_after REAL NOT NULL,
  transaction_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Discount rules engine ─────────────────────────────────
CREATE TABLE IF NOT EXISTS discount_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL,               -- 'buy_x_get_y' | 'tier_percent' | 'category_percent' | 'bogo'
  params TEXT NOT NULL DEFAULT '{}',     -- JSON: e.g. {"buy": 3, "get_free": 1, "category_id": "..."}
  active INTEGER NOT NULL DEFAULT 1,
  valid_from TEXT,
  valid_until TEXT,
  priority INTEGER NOT NULL DEFAULT 100, -- higher = evaluated first
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_discount_active ON discount_rules(active, priority DESC);

-- ─── Sales targets + generic commissions ────────────────────
CREATE TABLE IF NOT EXISTS sales_targets (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,                -- users.id or employees.id
  period TEXT NOT NULL,                  -- 'YYYY-MM'
  target_amount REAL NOT NULL,
  achieved_amount REAL NOT NULL DEFAULT 0,
  bonus_pct REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (staff_id, period)
);
CREATE INDEX IF NOT EXISTS idx_targets_period ON sales_targets(period);

CREATE TABLE IF NOT EXISTS commissions (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  rule_type TEXT NOT NULL,               -- 'flat_pct' | 'tiered' | 'per_product'
  params TEXT NOT NULL DEFAULT '{}',     -- JSON
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS commission_ledger (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  sale_id TEXT NOT NULL REFERENCES sales(id),
  amount REAL NOT NULL,
  posted_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT,
  paid_via TEXT                          -- 'payroll' | 'cash' | 'mpesa'
);
CREATE INDEX IF NOT EXISTS idx_commission_staff ON commission_ledger(staff_id, paid_at);
