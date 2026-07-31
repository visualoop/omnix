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
       po.expected_date, po.revision
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
