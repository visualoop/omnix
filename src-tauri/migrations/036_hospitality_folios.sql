-- ============================================================================
-- 036_hospitality_folios.sql — Guest folios (plan 08 Batch 6)
-- A folio opens at check-in; charges (room/restaurant/bar/...) post to it;
-- checkout requires a zero balance (or manager override).
-- ============================================================================

CREATE TABLE IF NOT EXISTS guest_folios (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES bookings(id),
    folio_number TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','voided')),
    opened_at TEXT NOT NULL DEFAULT (datetime('now')),
    closed_at TEXT
);

CREATE TABLE IF NOT EXISTS folio_charges (
    id TEXT PRIMARY KEY,
    folio_id TEXT NOT NULL REFERENCES guest_folios(id) ON DELETE CASCADE,
    charge_type TEXT NOT NULL
      CHECK (charge_type IN ('room','restaurant','bar','laundry','service','tax','adjustment')),
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    tax_amount REAL NOT NULL DEFAULT 0,
    source_sale_id TEXT REFERENCES sales(id),
    source_order_id TEXT REFERENCES hospitality_orders(id),
    posted_by TEXT REFERENCES users(id),
    posted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS folio_payments (
    id TEXT PRIMARY KEY,
    folio_id TEXT NOT NULL REFERENCES guest_folios(id),
    payment_id TEXT,
    amount REAL NOT NULL,
    method TEXT NOT NULL,
    reference TEXT,
    paid_by TEXT REFERENCES users(id),
    paid_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_folio_charges_folio ON folio_charges(folio_id);
CREATE INDEX IF NOT EXISTS idx_folio_payments_folio ON folio_payments(folio_id);
