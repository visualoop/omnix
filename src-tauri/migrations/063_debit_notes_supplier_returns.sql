-- ============================================================================
-- 063_debit_notes_supplier_returns.sql — Mirror to credit_notes + sale_returns.
-- Debit notes are issued to suppliers when they over-invoice or we return
-- goods. Supplier returns record physical goods sent back to the supplier.
-- ============================================================================

CREATE TABLE IF NOT EXISTS debit_notes (
  id TEXT PRIMARY KEY,
  note_number TEXT NOT NULL UNIQUE,     -- DN-2026-000001
  supplier_id TEXT REFERENCES suppliers(id),
  purchase_order_id TEXT REFERENCES purchase_orders(id),
  goods_receipt_id TEXT REFERENCES goods_receipts(id),
  issue_date TEXT NOT NULL,
  reason TEXT NOT NULL,                 -- 'over_invoice' | 'return' | 'damage' | 'price_adjustment'
  subtotal REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'issued', -- 'draft' | 'issued' | 'applied' | 'cancelled'
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dn_supplier ON debit_notes(supplier_id, issue_date);

CREATE TABLE IF NOT EXISTS debit_note_items (
  id TEXT PRIMARY KEY,
  debit_note_id TEXT NOT NULL REFERENCES debit_notes(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  description TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS supplier_returns (
  id TEXT PRIMARY KEY,
  return_number TEXT NOT NULL UNIQUE,   -- SR-2026-000001
  supplier_id TEXT REFERENCES suppliers(id),
  goods_receipt_id TEXT REFERENCES goods_receipts(id),
  debit_note_id TEXT REFERENCES debit_notes(id),
  return_date TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'sent',  -- 'draft' | 'sent' | 'credited' | 'closed'
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sr_supplier ON supplier_returns(supplier_id, return_date);

CREATE TABLE IF NOT EXISTS supplier_return_items (
  id TEXT PRIMARY KEY,
  supplier_return_id TEXT NOT NULL REFERENCES supplier_returns(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  batch_id TEXT,
  quantity REAL NOT NULL,
  unit_cost REAL NOT NULL DEFAULT 0,
  reason TEXT
);
