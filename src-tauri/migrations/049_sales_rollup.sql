-- 049_sales_rollup.sql
--
-- Keep the app fast after YEARS of sales.
--
-- The hot path (ringing a sale, looking up a product) is already O(log n)
-- via B-tree indexes, so it never slows with table size. The thing that
-- DOES grow linearly is "all-time" / "this year" REPORTS that aggregate
-- millions of sale_items rows. We solve that with a pre-aggregated daily
-- rollup the reports read instead of scanning raw rows.
--
-- We do NOT delete or move old sales — they're legal records (KRA eTIMS,
-- insurance claims, controlled-substance logs, all FK-referenced and
-- retained for years). Archiving them would orphan compliance data.
-- Instead we summarise.

-- One row per day: the totals a dashboard/report actually charts.
CREATE TABLE IF NOT EXISTS sales_daily (
    day TEXT PRIMARY KEY,              -- 'YYYY-MM-DD'
    branch_id TEXT,                    -- null = all branches (single-store)
    sales_count INTEGER NOT NULL DEFAULT 0,
    gross REAL NOT NULL DEFAULT 0,     -- sum(total) of completed sales
    discount REAL NOT NULL DEFAULT 0,
    tax REAL NOT NULL DEFAULT 0,
    items_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sales_daily_day ON sales_daily(day);

-- Composite covering index for the most common report scan: sales in a
-- date range, newest first. Lets range reports stay index-only even on
-- the raw table for recent windows.
CREATE INDEX IF NOT EXISTS idx_sales_created_status ON sales(created_at, status);

-- Churn tables: index their timestamp so the rolling-window prune
-- (maintenance service) is a fast indexed delete, not a scan.
CREATE INDEX IF NOT EXISTS idx_ai_calls_created_prune ON ai_calls(created_at);

-- Stock movements grow with every sale/receive — index the timestamp so
-- ledger reports + any future prune stay fast.
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);
