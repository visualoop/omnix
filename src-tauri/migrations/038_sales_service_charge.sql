-- ============================================================================
-- 038_sales_service_charge.sql
-- Sale-level service charge collected at POS. Kept separate from product
-- revenue while still contributing to the payable sale total.
-- ============================================================================

ALTER TABLE sales ADD COLUMN service_charge_amount REAL NOT NULL DEFAULT 0;
