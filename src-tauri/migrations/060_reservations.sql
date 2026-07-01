-- ============================================================================
-- 060_reservations.sql — Reservations for restaurant tables + hotel rooms.
-- ============================================================================

CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'table',    -- 'table' | 'room'
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  guest_email TEXT,
  party_size INTEGER,                    -- table reservations
  table_id TEXT REFERENCES dining_tables(id),
  room_id TEXT REFERENCES rooms(id),
  arrival_at TEXT NOT NULL,              -- datetime
  departure_at TEXT,                     -- datetime (rooms) or expected end (tables)
  status TEXT NOT NULL DEFAULT 'confirmed', -- 'confirmed' | 'seated' | 'checked_in' | 'no_show' | 'cancelled' | 'completed'
  deposit_amount REAL NOT NULL DEFAULT 0,
  deposit_paid_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_reservations_arrival ON reservations(arrival_at, status);
CREATE INDEX IF NOT EXISTS idx_reservations_kind ON reservations(kind, status);
CREATE INDEX IF NOT EXISTS idx_reservations_table ON reservations(table_id, arrival_at);
CREATE INDEX IF NOT EXISTS idx_reservations_room ON reservations(room_id, arrival_at);
