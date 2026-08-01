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

pub const SET_REORDER_LEVEL: &str = r#"
UPDATE branch_inventory_items
SET reorder_level_milli = ?3, revision = revision + 1, updated_at = ?4
WHERE branch_id = ?1 AND product_id = ?2 AND revision = ?5
"#;

pub const SYNC_BRANCH_ITEM_QUANTITY: &str = r#"
UPDATE branch_inventory_items
SET quantity_milli = ?3, revision = MAX(revision, ?4), updated_at = ?5
WHERE branch_id = ?1 AND product_id = ?2
"#;

pub const REORDER_ALERTS: &str = r#"
WITH authorized_branches(branch_id) AS (SELECT value FROM json_each(?1))
SELECT bi.product_id, bi.sku, bi.name, bi.branch_id,
       CAST(bi.quantity_milli AS REAL) / 1000.0 AS quantity_on_hand,
       CAST(bi.reorder_level_milli / 1000 AS INTEGER) AS reorder_level,
       bi.revision
FROM branch_inventory_items bi
JOIN authorized_branches ab ON ab.branch_id = bi.branch_id
WHERE bi.active = 1 AND bi.quantity_milli <= bi.reorder_level_milli
  AND (?2 = 1 OR bi.quantity_milli > 0)
  AND (?3 = '' OR bi.sku LIKE ?3 ESCAPE '\\' OR bi.name LIKE ?3 ESCAPE '\\')
  AND (bi.revision > ?4 OR (bi.revision = ?4 AND bi.product_id > ?5))
ORDER BY bi.revision, bi.product_id
LIMIT ?6
"#;

pub const UPSERT_PRODUCT_CATALOG: &str = r#"
INSERT INTO products(id, name, sku, barcode, unit, reorder_level, active, created_at, updated_at)
VALUES (?1, ?2, ?3, ?4, ?5, CAST(?6 AS REAL) / 1000.0, ?7, ?8, ?8)
ON CONFLICT(id) DO UPDATE SET
 name = excluded.name, sku = excluded.sku, barcode = excluded.barcode,
 unit = excluded.unit, active = excluded.active, updated_at = excluded.updated_at
"#;

pub const ENSURE_BRANCH_STOCK: &str = r#"
INSERT INTO branch_stock(branch_id, product_id, quantity_milli, revision, updated_at)
VALUES (?1, ?2, 0, 1, ?3)
ON CONFLICT(branch_id, product_id) DO NOTHING
"#;

pub const LOAD_REORDER_LEVEL: &str = r#"
SELECT reorder_level_milli FROM branch_inventory_items
WHERE branch_id = ?1 AND product_id = ?2
"#;
