-- ============================================================================
-- 088_delivery_note_source.sql
-- Delivery notes are generated FROM an accepted quotation (industry-standard
-- hardware flow): quote → accepted → deliver goods. Link the note back to the
-- quote it fulfils so both sides reconcile + partial deliveries are traceable.
-- ============================================================================

ALTER TABLE delivery_notes ADD COLUMN source_quotation_id TEXT REFERENCES quotations(id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_source_quote ON delivery_notes(source_quotation_id);
