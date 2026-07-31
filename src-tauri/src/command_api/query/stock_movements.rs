pub const LOAD_STOCK_REVISION: &str = r#"
WITH authorized_branches(branch_id) AS (SELECT value FROM json_each(?1))
SELECT bs.revision, bs.quantity_milli
FROM branch_stock bs
JOIN authorized_branches ab ON ab.branch_id = bs.branch_id
WHERE bs.branch_id = ?2 AND bs.product_id = ?3
"#;

pub const UPDATE_BRANCH_STOCK: &str = r#"
UPDATE branch_stock
SET quantity_milli = quantity_milli + ?3, revision = revision + 1, updated_at = ?4
WHERE branch_id = ?1 AND product_id = ?2 AND revision = ?5
"#;

pub const INSERT_STOCK_MOVEMENT: &str = r#"
INSERT INTO stock_movements_v2 (
  id, branch_id, product_id, batch_id, movement_kind, quantity_delta_milli,
  reason_code, notes, user_id, revision, created_at
) SELECT ?1, ab.branch_id, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11
FROM (SELECT value AS branch_id FROM json_each(?2)) ab
WHERE ab.branch_id = ?12
"#;

pub const STOCK_MOVEMENTS: &str = r#"
WITH authorized_branches(branch_id) AS (SELECT value FROM json_each(?1))
SELECT sm.branch_id, sm.id, sm.product_id, sm.batch_id, sm.movement_kind,
       sm.quantity_delta_milli, sm.reason_code, sm.user_id, sm.revision, sm.created_at
FROM stock_movements_v2 sm
JOIN authorized_branches ab ON ab.branch_id = sm.branch_id
WHERE (sm.created_at < ?2 OR (sm.created_at = ?2 AND sm.id < ?3))
ORDER BY sm.created_at DESC, sm.id DESC
LIMIT ?4
"#;
