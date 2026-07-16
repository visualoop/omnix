-- Salon commission payouts.
--
-- Salon/spa staff are typically paid their commissions daily. Until now
-- commissions only accrued (salon_commissions) with no record of what was
-- actually paid out, so owners couldn't see accrued-vs-paid or answer
-- "did we overpay / is anything unrecorded". This adds:
--   • salon_commission_payouts — one row per (staff, pay-out event), the
--     money handed to a staff member covering a set of accrued commissions.
--   • salon_commissions.payout_id + paid_at — links each commission to the
--     payout that settled it (NULL = still outstanding).

CREATE TABLE IF NOT EXISTS salon_commission_payouts (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL REFERENCES salon_staff(id),
    amount REAL NOT NULL DEFAULT 0,
    -- The business day this payout covers (YYYY-MM-DD), for "paid for the day".
    period_date TEXT,
    commission_count INTEGER NOT NULL DEFAULT 0,
    paid_by TEXT REFERENCES users(id),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_salon_payouts_staff ON salon_commission_payouts(staff_id, created_at DESC);

ALTER TABLE salon_commissions ADD COLUMN payout_id TEXT REFERENCES salon_commission_payouts(id);
ALTER TABLE salon_commissions ADD COLUMN paid_at TEXT;
CREATE INDEX IF NOT EXISTS idx_salon_commissions_payout ON salon_commissions(payout_id);
