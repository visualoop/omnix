-- 077_menu_86s.sql — soft "86" (temporarily out of stock) for menu items.
--
-- Distinct from menu_items.active which is "retired forever". 86 is a
-- kitchen-crew term meaning "we've run out of this tonight; put it back
-- when the ingredient comes in tomorrow." Every restaurant needs this
-- because the alternative — flipping active=0 and back — hides the
-- history and looks like the item was permanently discontinued.
--
-- until IS NULL means "indefinite until manually cleared".
-- until > datetime('now') means "still 86'd".
-- until <= datetime('now') means "auto-restored".
CREATE TABLE IF NOT EXISTS menu_86s (
  menu_item_id TEXT PRIMARY KEY REFERENCES menu_items(id) ON DELETE CASCADE,
  reason TEXT,
  until TEXT,
  set_by TEXT REFERENCES users(id),
  set_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_menu_86s_until ON menu_86s(until);
