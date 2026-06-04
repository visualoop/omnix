-- ============================================================================
-- 041_sales_source.sql
--
-- Tag every sale with the module workflow it came from. Today the cart store
-- already carries a `source` (`hospitality_order`, `prescription`, `layby`,
-- `special_order`, `folio`, `hardware_quote`) but the value is dropped at
-- sale time. Persisting it lets reports split revenue by module without
-- inferring it from line composition.
-- ============================================================================

ALTER TABLE sales ADD COLUMN source_type TEXT;   -- e.g. 'hospitality_order'
ALTER TABLE sales ADD COLUMN source_id TEXT;     -- the upstream record id

CREATE INDEX IF NOT EXISTS idx_sales_source ON sales(source_type, source_id);
