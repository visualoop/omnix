-- ============================================================================
-- 032_hospitality_core.sql — Hospitality module foundation (plan 08 Batch 2)
-- Dining areas/tables, kitchen stations, menu items + modifiers. Extends Core
-- (products) via FKs. Gated by the `hospitality` entitlement.
-- ============================================================================

CREATE TABLE IF NOT EXISTS dining_areas (
    id TEXT PRIMARY KEY,
    branch_id TEXT,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dining_tables (
    id TEXT PRIMARY KEY,
    branch_id TEXT,
    area_id TEXT REFERENCES dining_areas(id),
    table_code TEXT NOT NULL,
    name TEXT NOT NULL,
    seats INTEGER NOT NULL DEFAULT 2,
    x REAL,
    y REAL,
    status TEXT NOT NULL DEFAULT 'available'
      CHECK (status IN ('available','occupied','reserved','cleaning','inactive')),
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS kitchen_stations (
    id TEXT PRIMARY KEY,
    branch_id TEXT,
    name TEXT NOT NULL,
    printer_name TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES products(id),
    branch_id TEXT,
    menu_name TEXT NOT NULL,
    category TEXT,
    station_id TEXT REFERENCES kitchen_stations(id),
    prep_minutes INTEGER,
    dine_in_price REAL,
    takeaway_price REAL,
    delivery_price REAL,
    active INTEGER NOT NULL DEFAULT 1,
    available_from TEXT,
    available_to TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS menu_modifiers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('single','multiple')),
    required INTEGER NOT NULL DEFAULT 0,
    min_select INTEGER NOT NULL DEFAULT 0,
    max_select INTEGER,
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS menu_modifier_options (
    id TEXT PRIMARY KEY,
    modifier_id TEXT NOT NULL REFERENCES menu_modifiers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price_delta REAL NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_item_modifiers (
    menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    modifier_id TEXT NOT NULL REFERENCES menu_modifiers(id) ON DELETE CASCADE,
    PRIMARY KEY (menu_item_id, modifier_id)
);

CREATE INDEX IF NOT EXISTS idx_dining_tables_area ON dining_tables(area_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_active ON menu_items(active);
