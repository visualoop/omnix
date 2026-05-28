-- ============================================================================
-- 019_banking.sql
-- Bank accounts, transactions, reconciliation
-- ============================================================================

CREATE TABLE IF NOT EXISTS bank_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                       -- "Equity Main", "M-Pesa Till"
    account_type TEXT NOT NULL DEFAULT 'bank'
        CHECK (account_type IN ('bank','mpesa_till','mpesa_paybill','cash_box','credit_card','mobile_money')),
    bank_name TEXT,                           -- "Equity Bank", "Co-op", "Safaricom"
    account_number TEXT,                      -- account # / till # / paybill #
    branch TEXT,
    currency TEXT NOT NULL DEFAULT 'KES',
    opening_balance REAL NOT NULL DEFAULT 0,
    opening_date TEXT NOT NULL DEFAULT (date('now')),
    current_balance REAL NOT NULL DEFAULT 0,
    is_default INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    branch_id TEXT REFERENCES branches(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_active ON bank_accounts(is_active);

-- Insert default cash account on first install (idempotent)
INSERT OR IGNORE INTO bank_accounts (id, name, account_type, opening_balance, current_balance, is_default)
VALUES ('cash-default', 'Cash on Hand', 'cash_box', 0, 0, 1);

CREATE TABLE IF NOT EXISTS bank_transactions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES bank_accounts(id),
    transaction_date TEXT NOT NULL,
    transaction_type TEXT NOT NULL
        CHECK (transaction_type IN ('deposit','withdrawal','transfer_in','transfer_out','fee','interest','adjustment')),
    amount REAL NOT NULL,                     -- always positive; type determines sign
    balance_after REAL,                       -- running balance after this txn (computed)
    reference TEXT,                           -- M-Pesa code, cheque #, transfer ID
    description TEXT NOT NULL,
    counterparty_name TEXT,                   -- payer name or payee name
    payment_method TEXT,                      -- 'mpesa','cheque','cash','wire','card'
    -- linkage to source records (only one is non-null)
    related_sale_id TEXT REFERENCES sales(id),
    related_expense_id TEXT REFERENCES expenses(id),
    related_customer_payment_id TEXT REFERENCES customer_payments(id),
    related_supplier_payment_id TEXT REFERENCES supplier_payments(id),
    related_invoice_payment_id TEXT REFERENCES invoice_payments(id),
    related_transfer_id TEXT,                 -- self-ref for inter-account transfers
    -- reconciliation
    reconciled INTEGER NOT NULL DEFAULT 0,
    reconciled_at TEXT,
    reconciled_by TEXT REFERENCES users(id),
    statement_line_ref TEXT,                  -- bank statement reference if matched
    -- audit
    user_id TEXT NOT NULL REFERENCES users(id),
    branch_id TEXT REFERENCES branches(id),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bank_tx_account ON bank_transactions(account_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_tx_date ON bank_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_bank_tx_reconciled ON bank_transactions(reconciled);
CREATE INDEX IF NOT EXISTS idx_bank_tx_ref ON bank_transactions(reference);

CREATE TABLE IF NOT EXISTS bank_statement_imports (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES bank_accounts(id),
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    statement_starting_balance REAL NOT NULL,
    statement_ending_balance REAL NOT NULL,
    line_count INTEGER NOT NULL DEFAULT 0,
    matched_count INTEGER NOT NULL DEFAULT 0,
    unmatched_count INTEGER NOT NULL DEFAULT 0,
    file_name TEXT,
    notes TEXT,
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bank_statement_lines (
    id TEXT PRIMARY KEY,
    import_id TEXT NOT NULL REFERENCES bank_statement_imports(id) ON DELETE CASCADE,
    line_date TEXT NOT NULL,
    line_description TEXT NOT NULL,
    line_reference TEXT,
    debit REAL NOT NULL DEFAULT 0,            -- money OUT
    credit REAL NOT NULL DEFAULT 0,           -- money IN
    balance REAL,
    matched_transaction_id TEXT REFERENCES bank_transactions(id),
    is_matched INTEGER NOT NULL DEFAULT 0,
    raw_data TEXT                             -- JSON-encoded original line
);
CREATE INDEX IF NOT EXISTS idx_stmt_lines_import ON bank_statement_lines(import_id);
CREATE INDEX IF NOT EXISTS idx_stmt_lines_matched ON bank_statement_lines(is_matched);
