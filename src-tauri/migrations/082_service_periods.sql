-- 082_service_periods.sql — restaurant shifts (lunch, dinner, brunch).
--
-- Restaurants operate on discrete service windows. Reports break down
-- by shift; some kitchen behaviour differs across shifts (dinner has a
-- longer prep time). This mirrors what Toast calls "day parts" and
-- Square calls "revenue centres schedules".
--
-- Sessions track when an operator physically opened/closed a shift.
-- Kitchen + Orders headers show the currently-open session with a
-- close button.
CREATE TABLE IF NOT EXISTS service_periods (
  id TEXT PRIMARY KEY,
  branch_id TEXT,
  name TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS service_period_sessions (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES service_periods(id),
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT,
  opened_by TEXT REFERENCES users(id),
  closed_by TEXT REFERENCES users(id),
  gross_sales REAL,
  gross_covers INTEGER
);

CREATE INDEX IF NOT EXISTS idx_service_periods_active ON service_periods(active);
CREATE INDEX IF NOT EXISTS idx_service_period_sessions_open ON service_period_sessions(closed_at) WHERE closed_at IS NULL;

INSERT OR IGNORE INTO service_periods (id, name, starts_at, ends_at) VALUES
  ('breakfast', 'Breakfast', '06:00', '10:30'),
  ('lunch',     'Lunch',     '12:00', '15:30'),
  ('dinner',    'Dinner',    '18:00', '22:30');
