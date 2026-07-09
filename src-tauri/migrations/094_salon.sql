-- ============================================================================
-- 094_salon.sql
-- Salon / Spa module (Sanaa). Appointment-first: the unit of work is a timed
-- booking with a named staff member, not a stock sale. Reuses Core (customers
-- = clients, products, POS/sales, GL). Services are backed by lightweight
-- `is_service` products so they carry a product_id for sale_items + tax + GL
-- + eTIMS, but never touch stock (see products.is_service + completeSale).
-- ============================================================================

-- Services are non-stock "products" — flag them so inventory/POS grids exclude
-- them and completeSale skips the stock check for their sale lines.
ALTER TABLE products ADD COLUMN is_service INTEGER NOT NULL DEFAULT 0;

-- Service catalog -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS salon_services (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES products(id),      -- backing non-stock product
    name TEXT NOT NULL,
    category TEXT,                                 -- hair | nails | massage | facial | barber ...
    duration_min INTEGER NOT NULL DEFAULT 30,
    price REAL NOT NULL DEFAULT 0,
    commission_pct REAL,                           -- overrides staff default when set
    requires_room INTEGER NOT NULL DEFAULT 0,
    color TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_salon_services_active ON salon_services(active);

-- Staff ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS salon_staff (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES employees(id),
    user_id TEXT REFERENCES users(id),
    display_name TEXT NOT NULL,
    color TEXT,
    commission_default_pct REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_salon_staff_active ON salon_staff(active);

-- Which staff can perform which service (skills matrix). --------------------
CREATE TABLE IF NOT EXISTS salon_staff_services (
    staff_id TEXT NOT NULL REFERENCES salon_staff(id) ON DELETE CASCADE,
    service_id TEXT NOT NULL REFERENCES salon_services(id) ON DELETE CASCADE,
    PRIMARY KEY (staff_id, service_id)
);

-- Weekly working hours (0=Sun..6=Sat). Absence of a row = not working. ------
CREATE TABLE IF NOT EXISTS salon_staff_hours (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL REFERENCES salon_staff(id) ON DELETE CASCADE,
    weekday INTEGER NOT NULL,                      -- 0..6
    start_time TEXT NOT NULL,                       -- 'HH:MM'
    end_time TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_salon_hours_staff ON salon_staff_hours(staff_id);

-- Appointments --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS salon_appointments (
    id TEXT PRIMARY KEY,
    appt_number TEXT NOT NULL,
    client_id TEXT REFERENCES customers(id),
    staff_id TEXT REFERENCES salon_staff(id),
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'booked'
        CHECK (status IN ('booked','confirmed','checked_in','in_service','completed','no_show','cancelled')),
    notes TEXT,
    sale_id TEXT REFERENCES sales(id),
    total REAL NOT NULL DEFAULT 0,
    branch_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_salon_appt_starts ON salon_appointments(starts_at);
CREATE INDEX IF NOT EXISTS idx_salon_appt_staff ON salon_appointments(staff_id);
CREATE INDEX IF NOT EXISTS idx_salon_appt_status ON salon_appointments(status);
CREATE INDEX IF NOT EXISTS idx_salon_appt_client ON salon_appointments(client_id);

CREATE TABLE IF NOT EXISTS salon_appointment_services (
    id TEXT PRIMARY KEY,
    appointment_id TEXT NOT NULL REFERENCES salon_appointments(id) ON DELETE CASCADE,
    service_id TEXT NOT NULL REFERENCES salon_services(id),
    staff_id TEXT REFERENCES salon_staff(id),
    name TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    duration_min INTEGER NOT NULL DEFAULT 30,
    commission_amount REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_salon_appt_services_appt ON salon_appointment_services(appointment_id);

-- Client salon profile (preferences / allergies / formulas). ----------------
CREATE TABLE IF NOT EXISTS salon_client_profiles (
    client_id TEXT PRIMARY KEY REFERENCES customers(id),
    preferences TEXT,
    allergies TEXT,
    formulas TEXT,
    notes TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Commission accrual ledger (feeds staff performance + payroll). ------------
CREATE TABLE IF NOT EXISTS salon_commissions (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL REFERENCES salon_staff(id),
    appointment_id TEXT REFERENCES salon_appointments(id),
    sale_id TEXT REFERENCES sales(id),
    kind TEXT NOT NULL DEFAULT 'service',          -- service | retail
    base_amount REAL NOT NULL DEFAULT 0,
    pct REAL NOT NULL DEFAULT 0,
    amount REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_salon_commissions_staff ON salon_commissions(staff_id);
CREATE INDEX IF NOT EXISTS idx_salon_commissions_date ON salon_commissions(created_at DESC);
