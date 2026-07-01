-- 053_sale_returns_impact.sql
--
-- Before this migration, returns were only recorded in sale_returns +
-- sale_return_items. The originating sale row stayed frozen: same
-- total, same payment_status, no marker of "part of this sale came
-- back". That broke:
--
--   - Dashboard `today's revenue` (getTodaySalesSummary) — showed
--     gross sales, never subtracted refunds.
--   - Customer stats — a customer who bought 5000 then returned 2000
--     still looked like a 5000 customer.
--   - Reports that JOINed sales with returns did the right thing, but
--     any code doing SELECT SUM(total) FROM sales lied by omission.
--
-- Fix: add `sales.refunded_amount` (running total of returns that
-- reference this sale row) + `sales.refunded_at` (last-refund
-- timestamp). Populated by triggers so callers can't forget.
--
-- Idempotent: guarded with IF NOT EXISTS pattern (SQLite doesn't
-- support ALTER TABLE ADD COLUMN IF NOT EXISTS, so we use a
-- separate check in migration runner OR accept the error on rerun.
-- Every real migration file in this repo is only applied once by
-- the Rust migrator, so a plain ADD COLUMN is safe here.)

ALTER TABLE sales ADD COLUMN refunded_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN refunded_at TEXT;

CREATE INDEX IF NOT EXISTS idx_sales_refunded ON sales(refunded_amount) WHERE refunded_amount > 0;

-- Trigger: on every sale_returns insert, bump the parent sale's
-- refunded_amount and stamp refunded_at.
CREATE TRIGGER IF NOT EXISTS trg_sale_return_bumps_sale
AFTER INSERT ON sale_returns
WHEN NEW.sale_id IS NOT NULL
BEGIN
  UPDATE sales
     SET refunded_amount = ROUND(COALESCE(refunded_amount,0) + COALESCE(NEW.refund_amount,0), 2),
         refunded_at = COALESCE(NEW.created_at, datetime('now'))
   WHERE id = NEW.sale_id;
END;

-- Backfill for existing returns (idempotent — resets to a fresh sum).
-- Uses aggregate over sale_returns rather than a running counter so
-- multiple returns against the same sale add up correctly.
UPDATE sales
   SET refunded_amount = COALESCE((
       SELECT ROUND(SUM(refund_amount), 2)
         FROM sale_returns
        WHERE sale_id = sales.id
   ), 0);

UPDATE sales
   SET refunded_at = (
       SELECT MAX(created_at)
         FROM sale_returns
        WHERE sale_id = sales.id
   )
 WHERE refunded_amount > 0;
