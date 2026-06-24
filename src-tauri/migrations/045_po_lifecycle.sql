-- 045: PO lifecycle hardening
--
-- Adds:
--   - purchase_orders.currency + exchange_rate (mixed-currency POs)
--   - purchase_orders.approved_at + approved_by (approval workflow)
--   - purchase_orders.approval_threshold_at_create (price-snapshot for audit)
--   - purchase_order_items.unit_cost_received (price snapshot at GRN time)
--   - goods_receipts.reversed_at + reversed_by (reverse-GRN audit)
--   - goods_receipts.invoice_total + invoice_currency (3-way match)
--
-- Plus a settings row that defines the org-wide approval threshold (the
-- org owner can change it; every PO above this amount must transition
-- through 'pending_approval' → 'approved' → 'sent' instead of straight
-- to 'sent').

ALTER TABLE purchase_orders ADD COLUMN currency TEXT NOT NULL DEFAULT 'KES';
ALTER TABLE purchase_orders ADD COLUMN exchange_rate REAL NOT NULL DEFAULT 1;
ALTER TABLE purchase_orders ADD COLUMN approved_at TEXT;
ALTER TABLE purchase_orders ADD COLUMN approved_by TEXT;
ALTER TABLE purchase_orders ADD COLUMN approval_threshold_at_create REAL;

ALTER TABLE purchase_order_items ADD COLUMN unit_cost_received REAL;

ALTER TABLE goods_receipts ADD COLUMN reversed_at TEXT;
ALTER TABLE goods_receipts ADD COLUMN reversed_by TEXT;
ALTER TABLE goods_receipts ADD COLUMN invoice_total REAL;
ALTER TABLE goods_receipts ADD COLUMN invoice_currency TEXT;

-- Default approval threshold: 100,000 KES. Change via settings UI.
INSERT OR IGNORE INTO settings (key, value, category)
VALUES ('purchasing.approval_threshold', '100000', 'purchasing');

-- Threshold is a hard limit (must be approved before sending) when "1".
INSERT OR IGNORE INTO settings (key, value, category)
VALUES ('purchasing.approval_required', '1', 'purchasing');

-- 3-way match tolerance, in percent. PO total vs GRN total vs invoice
-- total are considered "matching" if they're within this % of each
-- other. Default 1% — typical FX wobble + rounding.
INSERT OR IGNORE INTO settings (key, value, category)
VALUES ('purchasing.three_way_tolerance_pct', '1', 'purchasing');
