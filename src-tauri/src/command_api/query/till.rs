pub const CURRENT_SHIFT: &str = r#"
WITH authorized_branches(branch_id) AS (SELECT value FROM json_each(?1))
SELECT cr.branch_id, cr.id, cr.user_id, cr.opened_at,
       CAST(round(cr.opening_balance * 100) AS INTEGER) AS opening_balance_minor,
       CAST(round(cr.expected_closing * 100) AS INTEGER) AS expected_closing_minor,
       CAST(round(cr.cash_in * 100) AS INTEGER) AS cash_in_minor,
       CAST(round(cr.cash_out * 100) AS INTEGER) AS cash_out_minor,
       cr.status, cr.revision
FROM cash_register cr
JOIN authorized_branches ab ON ab.branch_id = cr.branch_id
WHERE cr.status = 'open' AND (?2 IS NULL OR cr.user_id = ?2)
ORDER BY cr.opened_at DESC, cr.id DESC
LIMIT ?3
"#;

pub const LOAD_SHIFT_REVISION: &str = r#"
WITH authorized_branches(branch_id) AS (SELECT value FROM json_each(?1))
SELECT cr.revision
FROM cash_register cr
JOIN authorized_branches ab ON ab.branch_id = cr.branch_id
WHERE cr.branch_id = ?2 AND cr.id = ?3
"#;
