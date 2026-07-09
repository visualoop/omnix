-- ============================================================================
-- 096_salon_packages.sql
-- Salon Phase B — prepaid packages / memberships. A client buys N sessions of
-- a service up front (e.g. "10 massages"); sessions are redeemed against
-- appointments at checkout (the covered service line becomes zero-charge).
-- The package sale itself goes through the normal POS/GL path via a backing
-- is_service product.
-- ============================================================================

CREATE TABLE IF NOT EXISTS salon_packages (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES products(id),      -- backing non-stock product for the sale
    name TEXT NOT NULL,
    service_id TEXT REFERENCES salon_services(id),-- the service these sessions cover
    sessions INTEGER NOT NULL DEFAULT 1,
    price REAL NOT NULL DEFAULT 0,
    validity_days INTEGER,                         -- null = no expiry
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_salon_packages_active ON salon_packages(active);

CREATE TABLE IF NOT EXISTS client_packages (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES customers(id),
    package_id TEXT NOT NULL REFERENCES salon_packages(id),
    service_id TEXT REFERENCES salon_services(id),
    sessions_total INTEGER NOT NULL,
    sessions_remaining INTEGER NOT NULL,
    purchased_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT,
    purchase_sale_id TEXT REFERENCES sales(id),
    active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_client_packages_client ON client_packages(client_id);
CREATE INDEX IF NOT EXISTS idx_client_packages_service ON client_packages(service_id);
