/// Parameters: authorized branch JSON, cursor revision, cursor product id, search, include inactive,
/// page limit. The branch join is mandatory and cannot be supplied by transport callers.
pub const ANDROID_INVENTORY: &str = r#"
WITH authorized_branches(branch_id) AS (SELECT value FROM json_each(?1))
SELECT bi.branch_id, bi.product_id, bi.sku, bi.name, bi.quantity_milli,
       bi.selling_price_minor, bi.active, bi.revision
FROM branch_inventory_items bi
JOIN authorized_branches ab ON ab.branch_id = bi.branch_id
WHERE (bi.revision > ?2 OR (bi.revision = ?2 AND bi.product_id > ?3))
  AND (?4 = '' OR bi.sku LIKE ?4 ESCAPE '\\' OR bi.name LIKE ?4 ESCAPE '\\')
  AND (?5 = 1 OR bi.active = 1)
ORDER BY bi.revision, bi.product_id
LIMIT ?6
"#;

pub const LOAD_BRANCH_ITEM_REVISION: &str = r#"
WITH authorized_branches(branch_id) AS (SELECT value FROM json_each(?1))
SELECT bi.revision
FROM branch_inventory_items bi
JOIN authorized_branches ab ON ab.branch_id = bi.branch_id
WHERE bi.branch_id = ?2 AND bi.product_id = ?3
"#;

pub const UPSERT_BRANCH_ITEM: &str = r#"
INSERT INTO branch_inventory_items (
  branch_id, product_id, name, sku, barcode, unit, buying_price_minor,
  selling_price_minor, reorder_level_milli, active, revision, updated_at
) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
ON CONFLICT(branch_id, product_id) DO UPDATE SET
  name = excluded.name, sku = excluded.sku, barcode = excluded.barcode,
  unit = excluded.unit, buying_price_minor = excluded.buying_price_minor,
  selling_price_minor = excluded.selling_price_minor,
  reorder_level_milli = excluded.reorder_level_milli, active = excluded.active,
  revision = excluded.revision, updated_at = excluded.updated_at
WHERE branch_inventory_items.branch_id = ?1
  AND branch_inventory_items.product_id = ?2
  AND branch_inventory_items.revision = ?13
"#;
