-- 047_prescription_customer_link.sql
--
-- Add the missing customer_id link on prescriptions.
--
-- Before this migration the prescriptions table had patient_name as a
-- bare TEXT. The new Patients tab in the pharmacy module groups
-- prescriptions by customer (so a returning patient sees their full
-- history) so we need a real FK. Existing rows get NULL — they're
-- legacy prescriptions where the customer wasn't picked at create-time;
-- the patient_name column stays as a free-text fallback for display.

ALTER TABLE prescriptions ADD COLUMN customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS prescriptions_customer_id_idx ON prescriptions(customer_id);
