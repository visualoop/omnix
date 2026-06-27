-- Seed payment_methods rows for the synthetic IDs the UI uses when
-- charging via the Daraja STK push or Paystack STK proxy. Before this
-- migration these rows didn't exist, so the FK on payments.method_id
-- failed when a sale was completed with a charge from either flow —
-- the M-Pesa money was already taken via the gateway but the local
-- sale row could not be written, leaving the operator with a charged
-- customer and no receipt.
--
-- INSERT OR IGNORE keeps this idempotent across upgrades / re-runs.

INSERT OR IGNORE INTO payment_methods (id, name, type, sort_order) VALUES
  ('mpesa-daraja',   'M-Pesa (Direct)',   'mpesa',  5),
  ('mpesa-paystack', 'M-Pesa (Paystack)', 'mpesa',  6);
