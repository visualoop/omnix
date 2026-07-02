-- ============================================================================
-- 068_product_lead_time.sql — Add lead_time_days + last_ordered_at to products
-- to power reorder suggestions and supplier-performance analytics.
-- ============================================================================

ALTER TABLE products ADD COLUMN lead_time_days INTEGER;
ALTER TABLE products ADD COLUMN last_ordered_at TEXT;
