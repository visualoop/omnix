-- ============================================================================
-- 089_customer_address.sql
-- Customers had no address column, so quotes + delivery notes couldn't carry
-- a customer address (it was left null). Add it as a first-class field.
-- ============================================================================

ALTER TABLE customers ADD COLUMN address TEXT;
