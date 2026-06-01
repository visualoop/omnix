-- Single-module trial (v2): a trial unlocks exactly one chosen vertical, and is
-- registered server-side (best-effort) so it can't be re-farmed across reinstalls.

ALTER TABLE trial_state ADD COLUMN module TEXT NOT NULL DEFAULT 'dawa';
ALTER TABLE trial_state ADD COLUMN server_registered INTEGER NOT NULL DEFAULT 0;
