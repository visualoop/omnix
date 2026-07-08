-- ============================================================================
-- 093_rental_units.sql
-- Equipment DMS Phase 3 — rental fleet integration.
--
-- Links a rental line to a specific serialized unit and captures the meter
-- reading out (at hire) and in (at return), so hours/km used on a machine are
-- recorded against the unit's running total.
-- ============================================================================

ALTER TABLE rental_items ADD COLUMN equipment_unit_id TEXT REFERENCES equipment_units(id);
ALTER TABLE rental_items ADD COLUMN meter_out REAL;
ALTER TABLE rental_items ADD COLUMN meter_in REAL;

CREATE INDEX IF NOT EXISTS idx_rental_items_unit ON rental_items(equipment_unit_id);
