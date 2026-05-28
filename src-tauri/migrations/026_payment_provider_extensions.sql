-- Migration 026: Add Daraja M-Pesa columns to payment_providers
ALTER TABLE payment_providers ADD COLUMN passkey TEXT DEFAULT NULL;
ALTER TABLE payment_providers ADD COLUMN shortcode TEXT DEFAULT NULL;
ALTER TABLE payment_providers ADD COLUMN api_endpoint TEXT DEFAULT NULL;
ALTER TABLE payment_providers ADD COLUMN api_key TEXT DEFAULT NULL;
ALTER TABLE payment_providers ADD COLUMN api_secret TEXT DEFAULT NULL;
ALTER TABLE payment_providers ADD COLUMN facility_code TEXT DEFAULT NULL;
