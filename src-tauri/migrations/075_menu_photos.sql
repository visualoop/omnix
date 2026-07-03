-- ============================================================================
-- 075_menu_photos.sql — menu-item photos + allergen list
--
-- Two additive columns on menu_items so the UI can show a photo tile in
-- the order-taking grid + a small icon on KDS tickets, and so the KDS
-- can flag allergens visibly.
--
-- image_path stores a data-URL (image/png or image/jpeg base64). Same
-- convention used for the business logo — no external file store, no
-- CDN, no plugin. Compact enough for the 400px max we enforce in the UI.
-- ============================================================================

ALTER TABLE menu_items ADD COLUMN image_path TEXT;
ALTER TABLE menu_items ADD COLUMN allergens TEXT;

CREATE INDEX IF NOT EXISTS idx_menu_items_active ON menu_items(active);
