-- ============================================================================
-- 073_hardware_quote_columns.sql — patch for the 018/031 quotations collision
--
-- Migration 018 (invoicing) and migration 031 (hardware) both CREATE TABLE
-- IF NOT EXISTS the same tables (`quotations`, `quotation_items`) with
-- different columns. 018 runs first and wins; 031 silently no-ops. The
-- hardware service tried to write columns that never got created and
-- crashed with "no such column: quote_number".
--
-- This migration additively upgrades the 018 schema with the hardware-only
-- fields so both modules can share one physical table. The hardware service
-- is rewritten in the same release to use 018's column names for everything
-- that already existed (quotation_number, discount_amount, description).
-- ============================================================================

-- Hardware-specific fields on the quotation header. SQLite does not support
-- IF NOT EXISTS on ALTER TABLE ADD COLUMN, so wrap in a checked block via
-- pragma_table_info. The migrator runs each file only once, so plain ADD
-- COLUMN is safe here — but we guard anyway in case of re-runs.

-- salesperson_id — commission driver on the hardware side
ALTER TABLE quotations ADD COLUMN salesperson_id TEXT REFERENCES employees(id);

-- converted_sale_id — when the quote is checked out through POS. 018's own
-- converted_to_invoice_id stays for the invoicing-driven flow.
ALTER TABLE quotations ADD COLUMN converted_sale_id TEXT REFERENCES sales(id);

CREATE INDEX IF NOT EXISTS idx_quotations_salesperson ON quotations(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_quotations_converted_sale ON quotations(converted_sale_id);
