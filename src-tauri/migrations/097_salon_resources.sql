-- ============================================================================
-- 097_salon_resources.sql
-- Salon Phase B — bookable resources (rooms / chairs / beds) + linking an
-- appointment to one. A resource can't be double-booked, same as staff.
-- ============================================================================

CREATE TABLE IF NOT EXISTS salon_resources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'room',    -- room | chair | bed | station
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE salon_appointments ADD COLUMN resource_id TEXT REFERENCES salon_resources(id);
CREATE INDEX IF NOT EXISTS idx_salon_appt_resource ON salon_appointments(resource_id);
