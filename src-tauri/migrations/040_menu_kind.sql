-- ============================================================================
-- 040_menu_kind.sql
--
-- Separates "physical" (stockable) products from "menu_item" products so
-- hospitality menu items (Ugali, Chai etc.) stop polluting the inventory
-- views. Menu items keep a row in `products` for receipt/sale_item
-- compatibility, but `kind = 'menu_item'` excludes them from inventory
-- listings, stock takes, expiry reports, etc.
--
-- Also adds sale_items.menu_item_id so the sale knows when a line came
-- from a menu item — used by recipe-based stock consumption.
-- ============================================================================

ALTER TABLE products
    ADD COLUMN kind TEXT NOT NULL DEFAULT 'physical'
    CHECK (kind IN ('physical','menu_item'));

-- Backfill: any product currently referenced by a menu_item is a menu item.
UPDATE products
SET kind = 'menu_item'
WHERE id IN (SELECT product_id FROM menu_items WHERE product_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_products_kind ON products(kind);

ALTER TABLE sale_items ADD COLUMN menu_item_id TEXT REFERENCES menu_items(id);
CREATE INDEX IF NOT EXISTS idx_sale_items_menu_item ON sale_items(menu_item_id);
