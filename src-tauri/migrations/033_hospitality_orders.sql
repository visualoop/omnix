-- ============================================================================
-- 033_hospitality_orders.sql — Restaurant order lifecycle (plan 08 Batch 3)
-- Orders → send to kitchen → bump → served. A Core sale is created only on
-- payment (Task 24). Extends Core (products, customers, employees, users).
-- ============================================================================

CREATE TABLE IF NOT EXISTS hospitality_orders (
    id TEXT PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    branch_id TEXT,
    table_id TEXT REFERENCES dining_tables(id),
    customer_id TEXT REFERENCES customers(id),
    order_type TEXT NOT NULL DEFAULT 'dine_in'
      CHECK (order_type IN ('dine_in','takeaway','delivery','room_service')),
    status TEXT NOT NULL DEFAULT 'open'
      CHECK (status IN ('open','sent','preparing','ready','served','paid','voided')),
    waiter_id TEXT REFERENCES employees(id),
    sale_id TEXT REFERENCES sales(id),
    opened_by TEXT REFERENCES users(id),
    opened_at TEXT NOT NULL DEFAULT (datetime('now')),
    closed_at TEXT,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS hospitality_order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES hospitality_orders(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id),
    menu_item_id TEXT REFERENCES menu_items(id),
    station_id TEXT REFERENCES kitchen_stations(id),
    name TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0,
    modifier_total REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    tax_rate REAL NOT NULL DEFAULT 0,
    line_total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'new'
      CHECK (status IN ('new','sent','preparing','ready','served','voided')),
    notes TEXT,
    sent_at TEXT,
    ready_at TEXT,
    served_at TEXT
);

CREATE TABLE IF NOT EXISTS hospitality_order_item_modifiers (
    id TEXT PRIMARY KEY,
    order_item_id TEXT NOT NULL REFERENCES hospitality_order_items(id) ON DELETE CASCADE,
    modifier_name TEXT NOT NULL,
    option_name TEXT NOT NULL,
    price_delta REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_hosp_orders_status ON hospitality_orders(status);
CREATE INDEX IF NOT EXISTS idx_hosp_orders_table ON hospitality_orders(table_id);
CREATE INDEX IF NOT EXISTS idx_hosp_order_items_order ON hospitality_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_hosp_order_items_status ON hospitality_order_items(status);
