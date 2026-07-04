-- ============================================================================
-- 087_retail_pricing_convergence.sql
-- Retail audit remediation (v0.48): converge the three price-list registries
-- onto price_lists + product_prices (the store POS already reads), plus a
-- clean customer link and loyalty GL-liability flag.
-- ============================================================================

-- 1) Seed the extra tiers into the REAL registry (price_lists, migration 002).
INSERT OR IGNORE INTO price_lists (id, name, is_default) VALUES
    ('wholesale', 'Wholesale', 0),
    ('staff', 'Staff', 0),
    ('vip', 'VIP', 0);

-- 2) Clean customer -> price_lists link. The 021 column customers.price_list_id
--    points at the orphan retail_price_lists; leave it for back-compat and add
--    a fresh column referencing the real registry.
ALTER TABLE customers ADD COLUMN pricing_list_id TEXT REFERENCES price_lists(id);

-- Best-effort carry-over by name.
UPDATE customers
   SET pricing_list_id = (
     SELECT pl.id FROM price_lists pl
      JOIN retail_price_lists rpl ON LOWER(rpl.name) = LOWER(pl.name)
     WHERE rpl.id = customers.price_list_id
     LIMIT 1
   )
 WHERE price_list_id IS NOT NULL AND pricing_list_id IS NULL;

-- 3) Migrate orphan retail_price_list_items into product_prices so no configured
--    price is lost. Map orphan list ids -> real list ids by name.
INSERT OR IGNORE INTO product_prices (product_id, price_list_id, buying_price, selling_price)
SELECT rpli.product_id,
       COALESCE(map.real_id, 'default') AS price_list_id,
       0 AS buying_price,
       rpli.price AS selling_price
  FROM retail_price_list_items rpli
  JOIN retail_price_lists rpl ON rpl.id = rpli.price_list_id
  LEFT JOIN (
    SELECT rpl2.id AS orphan_id, pl.id AS real_id
      FROM retail_price_lists rpl2
      JOIN price_lists pl ON LOWER(pl.name) = LOWER(rpl2.name)
  ) map ON map.orphan_id = rpli.price_list_id
 WHERE rpli.product_id IS NOT NULL
   AND rpli.variant_id IS NULL
   AND (rpli.min_quantity IS NULL OR rpli.min_quantity <= 1);

CREATE INDEX IF NOT EXISTS idx_customers_pricing_list ON customers(pricing_list_id);

-- 4) Loyalty points GL liability flag.
ALTER TABLE loyalty_transactions ADD COLUMN gl_posted INTEGER NOT NULL DEFAULT 0;

-- 5) Layby stock reservation tracking.
ALTER TABLE layby_items ADD COLUMN reserved_qty REAL NOT NULL DEFAULT 0;

-- 6) Customer notifications queue (RT-17) — layby installment reminders +
--    special-order ready-for-collection. A downstream SMS/print job flushes
--    sent_at IS NULL rows.
CREATE TABLE IF NOT EXISTS customer_notifications (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('layby_due','layby_expiring','special_order_ready','other')),
    customer_id TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    reference_type TEXT,          -- 'layby' | 'special_order'
    reference_id TEXT,
    message TEXT NOT NULL,
    queued_at TEXT NOT NULL DEFAULT (datetime('now')),
    sent_at TEXT,
    sent_ref TEXT,
    failure_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_pending ON customer_notifications(sent_at) WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_notifications_ref ON customer_notifications(reference_type, reference_id);
