-- ============================================================================
-- 024_tips.sql
-- Tips / gratuities on sales (restaurants, salons, hotels, hospitality)
-- ============================================================================

ALTER TABLE sales ADD COLUMN tip_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN tip_employee_id TEXT REFERENCES employees(id);

-- Tip pool / weekly distribution log (optional, for tip pooling staff)
CREATE TABLE IF NOT EXISTS tip_distributions (
    id TEXT PRIMARY KEY,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    total_tips REAL NOT NULL,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    employee_name TEXT NOT NULL,
    share_amount REAL NOT NULL,
    distribution_method TEXT NOT NULL CHECK (distribution_method IN ('direct','pooled_equal','pooled_hours','custom')),
    notes TEXT,
    user_id TEXT NOT NULL REFERENCES users(id),
    branch_id TEXT REFERENCES branches(id),
    paid_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tip_dist_employee ON tip_distributions(employee_id);
CREATE INDEX IF NOT EXISTS idx_tip_dist_period ON tip_distributions(period_start, period_end);

-- Settings: enable tips at POS, default tip percentages
INSERT OR IGNORE INTO settings (key, value, category) VALUES
    ('tips.enabled', '0', 'pos'),
    ('tips.default_percentages', '5,10,15,20', 'pos'),
    ('tips.assign_to_staff', '0', 'pos'),
    ('tips.distribution_method', 'direct', 'pos');
