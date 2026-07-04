-- 083_walkin_folios.sql — allow folios without a booking (walk-in tabs).
--
-- SQLite can't ALTER a NOT NULL constraint off; we rebuild the table.
-- Also add a direct guest_id link so charge-to-folio flows can render
-- the guest name without walking through bookings (which don't exist
-- for walk-ins).
--
-- Design:
--   - booking_id becomes NULLABLE
--   - new guest_id column links the folio to the guest directly
--   - folios opened via check-in still populate BOTH columns (backfill
--     below) so existing queries that expect guest_id keep working
--   - walk-in folios populate guest_id + leave booking_id NULL

-- 1. Rename existing table.
ALTER TABLE guest_folios RENAME TO guest_folios_pre083;

-- 2. Recreate with the relaxed constraint + guest_id.
CREATE TABLE guest_folios (
    id TEXT PRIMARY KEY,
    booking_id TEXT REFERENCES bookings(id),
    guest_id TEXT REFERENCES guests(id),
    folio_number TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','voided')),
    opened_at TEXT NOT NULL DEFAULT (datetime('now')),
    closed_at TEXT
);

-- 3. Backfill: copy rows + resolve guest_id from bookings.
INSERT INTO guest_folios (id, booking_id, guest_id, folio_number, status, opened_at, closed_at)
SELECT f.id,
       f.booking_id,
       b.guest_id,
       f.folio_number,
       f.status,
       f.opened_at,
       f.closed_at
FROM guest_folios_pre083 f
LEFT JOIN bookings b ON b.id = f.booking_id;

-- 4. Drop legacy table.
DROP TABLE guest_folios_pre083;

-- 5. Restore indexes.
CREATE INDEX IF NOT EXISTS idx_guest_folios_status ON guest_folios(status);
CREATE INDEX IF NOT EXISTS idx_guest_folios_guest ON guest_folios(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_folios_booking ON guest_folios(booking_id);
