-- 039_module_sale_bridge.sql
-- Add sale_id foreign keys to module tables that bridge through POS

ALTER TABLE laybys ADD COLUMN sale_id TEXT REFERENCES sales(id);
ALTER TABLE special_orders ADD COLUMN sale_id TEXT REFERENCES sales(id);
ALTER TABLE folio_payments ADD COLUMN sale_id TEXT REFERENCES sales(id);
