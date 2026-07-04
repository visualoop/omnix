-- 080_guest_fields.sql — indexes on the fields the booking flow uses
-- to adopt returning guests rather than duplicate rows.
--
-- The guests table already had: full_name, phone, email, id_number,
-- nationality, address, notes (from migration 035). This migration
-- only adds the indexes that make findGuestByPhoneOrId cheap enough
-- to run inline during booking.
CREATE INDEX IF NOT EXISTS idx_guests_phone ON guests(phone);
CREATE INDEX IF NOT EXISTS idx_guests_id_number ON guests(id_number);
