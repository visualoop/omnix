pub const LOAD_PURCHASE_ORDER_REVISION: &str = r#"
WITH authorized_branches(branch_id) AS (SELECT value FROM json_each(?1))
SELECT po.revision
FROM purchase_orders po
JOIN authorized_branches ab ON ab.branch_id = po.branch_id
WHERE po.branch_id = ?2 AND po.id = ?3
"#;

pub const INSERT_PURCHASE_ORDER: &str = r#"
INSERT INTO purchase_orders (
  id, po_number, supplier_id, user_id, order_date, expected_date, status,
  subtotal, tax_amount, total, notes, branch_id, currency, revision, created_at, updated_at
) SELECT ?1, ?2, ?3, ?4, ?5, ?6, 'draft', ?7, ?8, ?9, ?10,
         ab.branch_id, ?12, 1, ?13, ?13
FROM (SELECT value AS branch_id FROM json_each(?11)) ab
WHERE ab.branch_id = ?14
"#;

pub const ANDROID_OPEN_PURCHASES: &str = r#"
WITH authorized_branches(branch_id) AS (SELECT value FROM json_each(?1))
SELECT po.branch_id, po.id, po.po_number, po.supplier_id, s.name,
       po.status, CAST(round(po.total * 100) AS INTEGER) AS total_minor,
       po.expected_date, po.revision, po.updated_at
FROM purchase_orders po
JOIN authorized_branches ab ON ab.branch_id = po.branch_id
JOIN suppliers s ON s.id = po.supplier_id
WHERE po.status IN ('draft', 'sent', 'partial', 'pending_approval', 'approved')
  AND (?2 = '' OR po.po_number LIKE ?2 ESCAPE '\\' OR s.name LIKE ?2 ESCAPE '\\')
  AND (?3 IS NULL OR po.supplier_id = ?3)
  AND (po.updated_at < ?4 OR (po.updated_at = ?4 AND po.id < ?5))
ORDER BY po.updated_at DESC, po.id DESC
LIMIT ?6
"#;

pub const NEXT_PO_NUMBER: &str = r#"
SELECT printf('PO-%05d', COALESCE(MAX(CAST(substr(po_number, 4) AS INTEGER)), 0) + 1)
FROM purchase_orders
"#;

pub const INSERT_PURCHASE_ORDER_ITEM: &str = r#"
INSERT INTO purchase_order_items (
 id, po_id, product_id, product_name, quantity, received_quantity, unit_cost, line_total, sort_order
) SELECT ?1, ?2, bi.product_id, bi.name, CAST(?4 AS REAL) / 1000.0, 0,
         CAST(?5 AS REAL) / 100.0, CAST(?6 AS REAL) / 100.0, ?7
FROM branch_inventory_items bi
JOIN stockable_products p ON p.id = bi.product_id
WHERE bi.branch_id = ?8 AND bi.product_id = ?3
"#;
