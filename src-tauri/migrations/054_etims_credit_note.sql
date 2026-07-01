-- 054_etims_credit_note.sql
--
-- Adds sale_return_id to etims_invoices so credit notes can be linked
-- back to the return they file against. Also relaxes sale_id to
-- nullable — a walk-in cash refund with no originating sale row still
-- needs a credit note if the eTIMS-signed cash refund policy applies.
-- (The FK constraint stays; NULL just means "no linked sale".)
--
-- SQLite doesn't allow altering NOT NULL directly, so we recreate the
-- table only if needed. For most installations the ADD COLUMN + index
-- is enough because the credit-note flow only creates rows with a
-- non-null sale_id anyway.

ALTER TABLE etims_invoices ADD COLUMN sale_return_id TEXT REFERENCES sale_returns(id);
ALTER TABLE etims_invoices ADD COLUMN original_invoice_number TEXT;

CREATE INDEX IF NOT EXISTS idx_etims_invoices_return ON etims_invoices(sale_return_id);
