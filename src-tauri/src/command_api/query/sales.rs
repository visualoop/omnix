pub const INSERT_SALE: &str = r#"
INSERT INTO sales (
  id, sale_number, customer_id, user_id, subtotal, discount_amount, tax_amount,
  total, payment_status, status, notes, branch_id, revision, created_at
) SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'completed', ?10, ab.branch_id, 1, ?12
FROM (SELECT value AS branch_id FROM json_each(?11)) ab
WHERE ab.branch_id = ?13
"#;

pub const RECENT_TILL_SALES: &str = r#"
WITH authorized_branches(branch_id) AS (SELECT value FROM json_each(?1))
SELECT s.branch_id, s.id, s.sale_number, c.name AS customer_name,
       CAST(round(s.total * 100) AS INTEGER) AS total_minor,
       s.payment_status, s.status, s.created_at, s.revision
FROM sales s
JOIN authorized_branches ab ON ab.branch_id = s.branch_id
LEFT JOIN customers c ON c.id = s.customer_id
WHERE (?2 = '' OR CAST(s.sale_number AS TEXT) LIKE ?2 OR c.name LIKE ?2 ESCAPE '\\')
  AND (?3 IS NULL OR s.created_at >= ?3)
  AND (s.created_at < ?4 OR (s.created_at = ?4 AND s.id < ?5))
ORDER BY s.created_at DESC, s.id DESC
LIMIT ?6
"#;

pub const LOAD_SALE_REVISION: &str = r#"
WITH authorized_branches(branch_id) AS (SELECT value FROM json_each(?1))
SELECT s.revision
FROM sales s
JOIN authorized_branches ab ON ab.branch_id = s.branch_id
WHERE s.branch_id = ?2 AND s.id = ?3
"#;

pub const NEXT_SALE_NUMBER: &str = r#"
UPDATE sequences SET value = value + 1 WHERE name = 'sale_number' RETURNING value
"#;

pub const INSERT_SALE_ITEM: &str = r#"
INSERT INTO sale_items (
 id, sale_id, product_id, batch_id, product_name, quantity, unit_price, discount, tax_rate, total
) SELECT ?1, ?2, bi.product_id, ?4, bi.name,
         CAST(?5 AS REAL) / 1000.0, CAST(?6 AS REAL) / 100.0,
         CAST(?7 AS REAL) / 100.0, CAST(?8 AS REAL) / 100.0, CAST(?9 AS REAL) / 100.0
FROM branch_inventory_items bi
WHERE bi.branch_id = ?10 AND bi.product_id = ?3
"#;

pub const INSERT_PAYMENT: &str = r#"
INSERT INTO payments (id, sale_id, method_id, method_name, amount, reference, created_at)
SELECT ?1, ?2, pm.id, pm.name, CAST(?4 AS REAL) / 100.0, ?5, ?6
FROM payment_methods pm WHERE pm.id = ?3 AND pm.active = 1
"#;

pub const DECREMENT_BRANCH_STOCK: &str = r#"
UPDATE branch_stock
SET quantity_milli = quantity_milli - ?3, revision = revision + 1, updated_at = ?4
WHERE branch_id = ?1 AND product_id = ?2 AND quantity_milli >= ?3
RETURNING quantity_milli, revision
"#;
