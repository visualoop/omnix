-- ============================================================================
-- 035_hospitality_rooms.sql — Hotel rooms + bookings (plan 08 Batch 5)
-- ============================================================================

CREATE TABLE IF NOT EXISTS room_types (
    id TEXT PRIMARY KEY,
    branch_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    base_occupancy INTEGER NOT NULL DEFAULT 1,
    max_occupancy INTEGER NOT NULL DEFAULT 2,
    base_rate REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    branch_id TEXT,
    room_type_id TEXT NOT NULL REFERENCES room_types(id),
    room_number TEXT NOT NULL,
    floor TEXT,
    status TEXT NOT NULL DEFAULT 'available'
      CHECK (status IN ('available','occupied','reserved','dirty','maintenance','out_of_order')),
    active INTEGER NOT NULL DEFAULT 1,
    UNIQUE(branch_id, room_number)
);

CREATE TABLE IF NOT EXISTS rate_plans (
    id TEXT PRIMARY KEY,
    branch_id TEXT,
    room_type_id TEXT NOT NULL REFERENCES room_types(id),
    name TEXT NOT NULL,
    rate REAL NOT NULL,
    meal_plan TEXT CHECK (meal_plan IN ('room_only','bed_breakfast','half_board','full_board')),
    starts_at TEXT,
    ends_at TEXT,
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS guests (
    id TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES customers(id),
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    id_number TEXT,
    nationality TEXT,
    address TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    booking_number TEXT UNIQUE NOT NULL,
    branch_id TEXT,
    guest_id TEXT NOT NULL REFERENCES guests(id),
    room_id TEXT REFERENCES rooms(id),
    room_type_id TEXT NOT NULL REFERENCES room_types(id),
    rate_plan_id TEXT REFERENCES rate_plans(id),
    check_in_date TEXT NOT NULL,
    check_out_date TEXT NOT NULL,
    adults INTEGER NOT NULL DEFAULT 1,
    children INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'reserved'
      CHECK (status IN ('reserved','checked_in','checked_out','cancelled','no_show')),
    rate_per_night REAL NOT NULL DEFAULT 0,
    deposit_amount REAL NOT NULL DEFAULT 0,
    source TEXT,
    notes TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in_date, check_out_date);
