-- ============================================================================
-- 092_service_jobs.sql
-- Equipment DMS Phase 2 — service / workshop.
--
-- A service job is a repair/maintenance order against a tracked equipment
-- unit. It records the reported fault + diagnosis, consumes parts from stock,
-- captures labour lines, and knows whether it falls under the unit's active
-- warranty (warranty jobs are zero-charge). Non-warranty jobs can be billed
-- via a standard invoice (invoice_id links back).
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_jobs (
    id TEXT PRIMARY KEY,
    job_number TEXT NOT NULL,
    unit_id TEXT NOT NULL REFERENCES equipment_units(id),
    customer_id TEXT REFERENCES customers(id),
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open','in_progress','awaiting_parts','completed','cancelled','invoiced')),
    reported_fault TEXT,
    diagnosis TEXT,
    is_warranty INTEGER NOT NULL DEFAULT 0,
    technician_id TEXT REFERENCES users(id),
    meter_in REAL,                                   -- hours/km reading at intake
    labour_total REAL NOT NULL DEFAULT 0,
    parts_total REAL NOT NULL DEFAULT 0,
    invoice_id TEXT REFERENCES invoices(id),         -- set when billed
    opened_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    branch_id TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_service_jobs_unit ON service_jobs(unit_id);
CREATE INDEX IF NOT EXISTS idx_service_jobs_status ON service_jobs(status);
CREATE INDEX IF NOT EXISTS idx_service_jobs_customer ON service_jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_jobs_opened ON service_jobs(opened_at DESC);

-- Parts consumed on the job (stock is decremented when a part is added). ------
CREATE TABLE IF NOT EXISTS service_job_parts (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES service_jobs(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    batch_id TEXT REFERENCES batches(id),
    quantity REAL NOT NULL DEFAULT 1,
    unit_cost REAL NOT NULL DEFAULT 0,
    unit_price REAL NOT NULL DEFAULT 0,
    line_total REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_service_job_parts_job ON service_job_parts(job_id);

-- Labour lines. ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_job_labour (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES service_jobs(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    hours REAL NOT NULL DEFAULT 0,
    rate REAL NOT NULL DEFAULT 0,
    line_total REAL NOT NULL DEFAULT 0,
    technician_id TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_service_job_labour_job ON service_job_labour(job_id);
