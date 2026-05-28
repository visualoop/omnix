-- ============================================================================
-- 022_recurring_invoices.sql
-- Recurring invoice templates + credit notes
-- ============================================================================

CREATE TABLE IF NOT EXISTS recurring_invoice_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                       -- "Monthly Subscription - Acme Co"
    customer_id TEXT REFERENCES customers(id),
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    customer_address TEXT,
    customer_tax_pin TEXT,
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly','biweekly','monthly','quarterly','annually')),
    interval_count INTEGER NOT NULL DEFAULT 1, -- e.g., every 2 weeks
    starts_on TEXT NOT NULL,                  -- date of first invoice
    ends_on TEXT,                             -- NULL = forever
    next_run_on TEXT NOT NULL,                -- date of next scheduled generation
    last_run_on TEXT,
    invoices_generated INTEGER NOT NULL DEFAULT 0,
    payment_terms_days INTEGER NOT NULL DEFAULT 30,
    notes TEXT,
    terms TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    auto_send INTEGER NOT NULL DEFAULT 0,     -- mark as 'sent' on generation
    user_id TEXT NOT NULL REFERENCES users(id),
    branch_id TEXT REFERENCES branches(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_invoice_templates(is_active, next_run_on);

CREATE TABLE IF NOT EXISTS recurring_invoice_items (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL REFERENCES recurring_invoice_templates(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id),
    description TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'pcs',
    unit_price REAL NOT NULL,
    tax_rate REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_recurring_items_tmpl ON recurring_invoice_items(template_id);

-- Credit notes (against an invoice)
CREATE TABLE IF NOT EXISTS credit_notes (
    id TEXT PRIMARY KEY,
    credit_note_number TEXT UNIQUE NOT NULL,
    invoice_id TEXT NOT NULL REFERENCES invoices(id),
    customer_id TEXT REFERENCES customers(id),
    customer_name TEXT NOT NULL,
    issue_date TEXT NOT NULL DEFAULT (date('now')),
    reason TEXT NOT NULL CHECK (reason IN ('return','overcharge','discount','correction','damaged','other')),
    subtotal REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    notes TEXT,
    user_id TEXT NOT NULL REFERENCES users(id),
    branch_id TEXT REFERENCES branches(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON credit_notes(invoice_id);

CREATE TABLE IF NOT EXISTS credit_note_items (
    id TEXT PRIMARY KEY,
    credit_note_id TEXT NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    tax_rate REAL NOT NULL DEFAULT 0,
    line_total REAL NOT NULL
);
