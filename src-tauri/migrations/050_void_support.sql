-- 050_void_support.sql
--
-- Make voiding a sale a clean, reversible operation across money + tax.
--
-- Before this, voidSale only restored stock — it left the payments, the
-- mirrored bank deposit, and the signed eTIMS invoice in place, so a
-- voided sale still showed as banked revenue and a live KRA invoice.
--
-- These columns let the void path mark money + tax as reversed without
-- deleting the original audit rows (we never delete financial history).

-- Payments: flag the ones reversed by a void so reports exclude them.
ALTER TABLE payments ADD COLUMN voided_at TEXT;

-- eTIMS invoices: flag the original as voided. The correct KRA reversal
-- is a credit note; we mark the original + enqueue the credit-note intent
-- so the eTIMS queue can issue it. (invoice_type already supports
-- 'credit_note'.)
ALTER TABLE etims_invoices ADD COLUMN voided_at TEXT;
