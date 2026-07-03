-- 076_hospitality_party_folio.sql — party size + folio link for room service.
-- These are additive columns so existing orders are unaffected.
ALTER TABLE hospitality_orders ADD COLUMN party_size INTEGER;
ALTER TABLE hospitality_orders ADD COLUMN folio_id TEXT REFERENCES guest_folios(id);
ALTER TABLE hospitality_orders ADD COLUMN room_id TEXT REFERENCES rooms(id);
CREATE INDEX IF NOT EXISTS idx_hospitality_orders_folio ON hospitality_orders(folio_id);
