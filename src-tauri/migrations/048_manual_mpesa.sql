-- 048_manual_mpesa.sql
--
-- Manual M-Pesa (Paybill / Till) support.
--
-- Most Kenyan SMEs don't wire the Daraja API — they have a Safaricom
-- Paybill or Buy-Goods Till and the customer pays directly. The cashier
-- then reads the M-Pesa confirmation code off the customer's SMS and
-- records it against the sale. No API call, just reconciliation.
--
-- We store the business's paybill/till on the existing payment_providers
-- table under a synthetic 'mpesa-manual' row so it sits alongside the
-- Daraja + Paystack provider rows and reuses the same active flag.

INSERT OR IGNORE INTO payment_providers (id, name, active)
VALUES ('mpesa-manual', 'M-Pesa (Manual)', 0);

-- Card payment method (settled via the Paystack Popup iframe). Sort
-- after bank so cash/M-Pesa lead the picker — the Kenyan default.
INSERT OR IGNORE INTO payment_methods (id, name, type, sort_order)
VALUES ('card', 'Card', 'card', 6);

-- Paybill number (e.g. 174379). Null when the business uses a Till.
ALTER TABLE payment_providers ADD COLUMN paybill_number TEXT;

-- For Paybill, the account-number convention the customer should type
-- (e.g. the invoice number, phone number, or a fixed account). Free text
-- shown as a hint on the POS manual-M-Pesa panel.
ALTER TABLE payment_providers ADD COLUMN paybill_account_hint TEXT;

-- Buy-Goods Till number (e.g. 5202020). Null when the business uses a
-- Paybill. A business may have both; the POS shows whichever is set.
ALTER TABLE payment_providers ADD COLUMN till_number TEXT;
