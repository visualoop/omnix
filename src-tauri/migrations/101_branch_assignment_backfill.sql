-- ============================================================================
-- 101_branch_assignment_backfill.sql
-- Repair branch access for users created after migration 016.
-- ============================================================================

-- A zero-assignment user normally indicates legacy missing data and may be
-- repaired automatically. Removing a user's final assignment is different:
-- record that explicit administrative decision so login remains fail-closed.
CREATE TABLE IF NOT EXISTS user_branch_assignment_revocations (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    revoked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Upgrade repair: every active user with no assignment receives the active
-- default branch. If no active default exists, a sole active branch is safe.
-- A repaired zero-assignment user necessarily receives a primary assignment.
WITH preferred_branch AS (
    SELECT id
    FROM branches
    WHERE active = 1 AND is_default = 1
    ORDER BY created_at, id
    LIMIT 1
),
single_active_branch AS (
    SELECT MIN(id) AS id
    FROM branches
    WHERE active = 1
    HAVING COUNT(*) = 1
),
candidate AS (
    SELECT id FROM preferred_branch
    UNION ALL
    SELECT id FROM single_active_branch
    WHERE NOT EXISTS (SELECT 1 FROM preferred_branch)
    LIMIT 1
)
INSERT OR IGNORE INTO user_branches (user_id, branch_id, is_primary)
SELECT u.id, candidate.id, 1
FROM users u
CROSS JOIN candidate
WHERE u.active = 1
  AND candidate.id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM user_branches ub WHERE ub.user_id = u.id
  );
