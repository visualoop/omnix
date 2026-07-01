-- ============================================================================
-- 062_period_close.sql — Financial year + period-close.
-- Once a period is closed, journal_entries within it are read-only. Reopening
-- requires an owner override + audit-log entry.
-- ============================================================================

CREATE TABLE IF NOT EXISTS financial_years (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,          -- e.g. "FY2026" or "2026-07 to 2027-06"
  start_date TEXT NOT NULL,            -- 'YYYY-MM-DD'
  end_date TEXT NOT NULL,              -- 'YYYY-MM-DD'
  closed_at TEXT,                      -- null = open
  closed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fy_range ON financial_years(start_date, end_date);

-- Monthly periods within a financial year (optional soft-close per month).
CREATE TABLE IF NOT EXISTS accounting_periods (
  id TEXT PRIMARY KEY,
  financial_year_id TEXT NOT NULL REFERENCES financial_years(id) ON DELETE CASCADE,
  label TEXT NOT NULL,                  -- '2026-07'
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'soft_closed' | 'closed'
  closed_at TEXT,
  closed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (financial_year_id, label)
);

CREATE INDEX IF NOT EXISTS idx_period_status ON accounting_periods(status, start_date);

-- Seed the current financial year (Kenya's default is calendar year Jan–Dec).
INSERT OR IGNORE INTO financial_years (id, label, start_date, end_date)
VALUES (
  'fy-' || strftime('%Y', 'now'),
  'FY' || strftime('%Y', 'now'),
  strftime('%Y-01-01', 'now'),
  strftime('%Y-12-31', 'now')
);
