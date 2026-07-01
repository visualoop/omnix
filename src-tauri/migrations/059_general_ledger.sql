-- ============================================================================
-- 059_general_ledger.sql — Double-entry accounting foundation.
-- Adds a Chart of Accounts (COA), journal entries (headers), and journal lines
-- (debits + credits that must sum to zero). Seeds a minimum COA (25 accounts)
-- so a fresh install has something to post against.
-- ============================================================================

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  code TEXT PRIMARY KEY,               -- e.g. '1000', '4000'
  name TEXT NOT NULL,                  -- e.g. 'Cash on hand', 'Sales revenue'
  type TEXT NOT NULL,                  -- 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  parent_code TEXT REFERENCES chart_of_accounts(code),
  is_system INTEGER NOT NULL DEFAULT 0, -- 1 = seeded, don't delete; 0 = user-added
  active INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_coa_type ON chart_of_accounts(type);
CREATE INDEX IF NOT EXISTS idx_coa_parent ON chart_of_accounts(parent_code);

-- ─── Journal entries (headers) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  entry_number TEXT NOT NULL UNIQUE,   -- sequential per year (JE-2026-000001)
  entry_date TEXT NOT NULL,            -- transaction date, not creation date
  description TEXT NOT NULL,
  source_kind TEXT,                    -- 'sale', 'expense', 'payment', 'purchase', 'manual', 'adjustment'
  source_id TEXT,                      -- optional link to sales.id / expenses.id / etc.
  posted INTEGER NOT NULL DEFAULT 0,   -- 0 = draft, 1 = posted (immutable)
  posted_at TEXT,
  posted_by TEXT,                      -- users.id
  reversed_by TEXT REFERENCES journal_entries(id),
  reverses_entry TEXT REFERENCES journal_entries(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_je_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_je_source ON journal_entries(source_kind, source_id);
CREATE INDEX IF NOT EXISTS idx_je_posted ON journal_entries(posted, entry_date);

-- ─── Journal lines (debits/credits) ────────────────────────────────
-- Every entry has 2+ lines; total debits must equal total credits.
-- We enforce this in the service layer via a check before posting.
CREATE TABLE IF NOT EXISTS journal_lines (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  account_code TEXT NOT NULL REFERENCES chart_of_accounts(code),
  debit REAL NOT NULL DEFAULT 0,       -- always >= 0; a line is EITHER a debit OR a credit
  credit REAL NOT NULL DEFAULT 0,      -- always >= 0
  description TEXT,
  cost_centre TEXT,                    -- optional (for cost-centre accounting later)
  currency TEXT DEFAULT 'KES',
  fx_rate REAL DEFAULT 1.0,
  CHECK (debit >= 0 AND credit >= 0),
  CHECK (NOT (debit > 0 AND credit > 0))
);

CREATE INDEX IF NOT EXISTS idx_jl_entry ON journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_jl_account ON journal_lines(account_code);

-- ─── Seed Chart of Accounts ────────────────────────────────────────
-- Kenya SME standard structure. Codes follow the accounting norm:
--   1000-1999 Assets   2000-2999 Liabilities   3000-3999 Equity
--   4000-4999 Revenue  5000-5999 Cost of Sales 6000-6999 Expenses
INSERT OR IGNORE INTO chart_of_accounts (code, name, type, is_system) VALUES
  ('1000', 'Cash on hand', 'asset', 1),
  ('1010', 'M-Pesa float', 'asset', 1),
  ('1020', 'Bank (current)', 'asset', 1),
  ('1030', 'Bank (savings)', 'asset', 1),
  ('1100', 'Accounts receivable', 'asset', 1),
  ('1200', 'Inventory', 'asset', 1),
  ('1300', 'Prepaid expenses', 'asset', 1),
  ('1500', 'Fixed assets', 'asset', 1),
  ('1600', 'Accumulated depreciation', 'asset', 1),

  ('2000', 'Accounts payable', 'liability', 1),
  ('2100', 'VAT payable (output)', 'liability', 1),
  ('2110', 'VAT recoverable (input)', 'liability', 1),
  ('2200', 'PAYE payable', 'liability', 1),
  ('2210', 'NHIF/SHIF payable', 'liability', 1),
  ('2220', 'NSSF payable', 'liability', 1),
  ('2300', 'Customer deposits', 'liability', 1),
  ('2400', 'Loans payable', 'liability', 1),

  ('3000', 'Owner equity', 'equity', 1),
  ('3100', 'Retained earnings', 'equity', 1),
  ('3200', 'Current-year earnings', 'equity', 1),

  ('4000', 'Sales revenue', 'revenue', 1),
  ('4100', 'Service revenue', 'revenue', 1),
  ('4200', 'Other income', 'revenue', 1),
  ('4500', 'Sales returns and allowances', 'revenue', 1),
  ('4600', 'Sales discounts', 'revenue', 1),

  ('5000', 'Cost of goods sold', 'expense', 1),
  ('5100', 'Inventory shrinkage / write-off', 'expense', 1),

  ('6000', 'Rent expense', 'expense', 1),
  ('6100', 'Salaries and wages', 'expense', 1),
  ('6200', 'Utilities (electricity, water)', 'expense', 1),
  ('6300', 'Airtime and internet', 'expense', 1),
  ('6400', 'Transport and fuel', 'expense', 1),
  ('6500', 'Repairs and maintenance', 'expense', 1),
  ('6600', 'Bank charges and fees', 'expense', 1),
  ('6700', 'Marketing and advertising', 'expense', 1),
  ('6800', 'Professional fees (audit, legal)', 'expense', 1),
  ('6900', 'Miscellaneous expense', 'expense', 1);
