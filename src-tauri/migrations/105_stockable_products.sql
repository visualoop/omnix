-- Canonical inventory boundary shared by TypeScript and Rust read paths.
-- A stockable item is a physical product, not a Salon service/package or a
-- Hospitality menu item assembled from recipe ingredients.
CREATE VIEW stockable_products AS
SELECT *
FROM products
WHERE COALESCE(is_service, 0) = 0
  AND COALESCE(kind, 'physical') = 'physical';

-- Migration 102 predated the Salon service boundary and backfilled every
-- product into the command-API inventory projections. Remove those legacy
-- rows so mobile/reorder reads cannot retain non-stock catalogue entries.
DELETE FROM branch_stock
WHERE product_id NOT IN (SELECT id FROM stockable_products);

DELETE FROM branch_inventory_items
WHERE product_id NOT IN (SELECT id FROM stockable_products);
