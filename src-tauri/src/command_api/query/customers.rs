pub const LOAD_BRANCH_CUSTOMER_REVISION: &str = r#"
WITH authorized_branches(branch_id) AS (SELECT value FROM json_each(?1))
SELECT bc.revision
FROM branch_customers bc
JOIN authorized_branches ab ON ab.branch_id = bc.branch_id
WHERE bc.branch_id = ?2 AND bc.customer_id = ?3
"#;

pub const UPSERT_BRANCH_CUSTOMER: &str = r#"
INSERT INTO branch_customers (
  branch_id, customer_id, name, phone, email, credit_limit_minor, active, revision, updated_at
) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
ON CONFLICT(branch_id, customer_id) DO UPDATE SET
  name = excluded.name, phone = excluded.phone, email = excluded.email,
  credit_limit_minor = excluded.credit_limit_minor, active = excluded.active,
  revision = excluded.revision, updated_at = excluded.updated_at
WHERE branch_customers.branch_id = ?1
  AND branch_customers.customer_id = ?2
  AND branch_customers.revision = ?10
"#;

pub const ANDROID_CUSTOMERS: &str = r#"
WITH authorized_branches(branch_id) AS (SELECT value FROM json_each(?1))
SELECT bc.branch_id, bc.customer_id, bc.name, bc.phone, bc.email,
       bc.credit_limit_minor, bc.active, bc.revision
FROM branch_customers bc
JOIN authorized_branches ab ON ab.branch_id = bc.branch_id
WHERE (bc.revision > ?2 OR (bc.revision = ?2 AND bc.customer_id > ?3))
ORDER BY bc.revision, bc.customer_id
LIMIT ?4
"#;
