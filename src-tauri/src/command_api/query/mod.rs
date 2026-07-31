pub mod atomic;
pub mod auth;
pub mod customers;
pub mod inventory;
pub mod purchasing;
pub mod sales;
pub mod stock_movements;
pub mod till;

/// Marker required in every branch-scoped leaf. Tests reject SQL leaves without it.
pub const BRANCH_SCOPE_CTE: &str =
    "authorized_branches(branch_id) AS (SELECT value FROM json_each(?1))";

pub fn has_mandatory_branch_scope(sql: &str) -> bool {
    sql.contains(BRANCH_SCOPE_CTE)
        && sql.contains("JOIN authorized_branches")
        && !sql.contains("{branch")
        && !sql.contains("format!(")
}
