-- ============================================================================
-- 095_salon_backbar.sql
-- Salon Phase B — back-bar consumption. A service can consume professional
-- products from stock (dye, wax, oils) when it's checked out. This maps
-- services → products + the quantity used, so completeAppointment can deduct
-- them (FEFO) as an inventory adjustment.
-- ============================================================================

CREATE TABLE IF NOT EXISTS salon_service_products (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES salon_services(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity REAL NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_salon_service_products_service ON salon_service_products(service_id);
