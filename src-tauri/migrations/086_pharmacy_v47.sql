-- ============================================================================
-- 086_pharmacy_v47.sql
-- Non-scope items promoted to first-class features in v0.47:
--   • SHA claim retry queue (async submission with exponential backoff)
--   • DHA e-prescription staging (imported from AfyaLink HIE)
--   • Cold-chain root-cause analysis output
--   • Counselling templates + patient encounter tracking
--   • PPB e-Portal automatic quarterly submissions
-- ============================================================================

-- ─── SHA claim retry queue ─────────────────────────────────────────────
-- When submitClaimToSha() fails against AfyaLink, the claim is stashed
-- here with next_retry_at + backoff so a background worker can pick it
-- up later. A 4xx response (member number rejected, invalid diagnosis
-- code) stops retries — attempts = -1 flags manual review. A 5xx or
-- network error retries up to 10 times with exponential backoff.
CREATE TABLE IF NOT EXISTS sha_claim_queue (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL REFERENCES insurance_claims(id) ON DELETE CASCADE,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 10,
    next_retry_at TEXT NOT NULL,
    last_error TEXT,
    last_status_code INTEGER,
    last_attempt_at TEXT,
    resolved_at TEXT,
    resolved_status TEXT CHECK (resolved_status IN ('submitted', 'rejected', 'manual_review', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sha_claim_queue_pending ON sha_claim_queue(next_retry_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sha_claim_queue_claim ON sha_claim_queue(claim_id);

-- ─── DHA e-prescription staging ────────────────────────────────────────
-- E-scripts imported from AfyaLink live here until the pharmacist
-- promotes them to a prescription row via importEprescription().
-- Once promoted, `imported_prescription_id` links to the created rx and
-- `status` moves to 'imported'.
CREATE TABLE IF NOT EXISTS dha_eprescriptions (
    id TEXT PRIMARY KEY,
    dha_id TEXT NOT NULL UNIQUE,           -- upstream identifier from AfyaLink
    provider_id TEXT REFERENCES insurance_providers(id),
    patient_name TEXT NOT NULL,
    patient_id_number TEXT,
    patient_phone TEXT,
    patient_dob TEXT,
    patient_gender TEXT,
    prescriber_name TEXT,
    prescriber_license TEXT,
    facility_code TEXT,
    diagnosis_code TEXT,
    diagnosis_text TEXT,
    issued_at TEXT NOT NULL,
    valid_until TEXT,
    payload_json TEXT NOT NULL,             -- full upstream payload for audit
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'imported', 'rejected', 'expired')),
    imported_prescription_id TEXT REFERENCES prescriptions(id),
    imported_at TEXT,
    rejection_reason TEXT,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dha_erx_status ON dha_eprescriptions(status);
CREATE INDEX IF NOT EXISTS idx_dha_erx_issued ON dha_eprescriptions(issued_at DESC);

CREATE TABLE IF NOT EXISTS dha_eprescription_items (
    id TEXT PRIMARY KEY,
    eprescription_id TEXT NOT NULL REFERENCES dha_eprescriptions(id) ON DELETE CASCADE,
    drug_name TEXT NOT NULL,
    strength TEXT,
    dosage TEXT,
    frequency TEXT,
    duration TEXT,
    quantity REAL NOT NULL,
    instructions TEXT,
    matched_product_id TEXT REFERENCES products(id)
);
CREATE INDEX IF NOT EXISTS idx_dha_erx_items_erx ON dha_eprescription_items(eprescription_id);

-- ─── Cold-chain RCA output ─────────────────────────────────────────────
-- One row per identified excursion event. Rooted at a cold_chain_logs
-- row that had in_range = 0. The analyzer surveys the surrounding data
-- and writes a classification + confidence + recommended actions.
CREATE TABLE IF NOT EXISTS cold_chain_analyses (
    id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL REFERENCES cold_chain_units(id),
    trigger_log_id TEXT NOT NULL REFERENCES cold_chain_logs(id),
    excursion_start TEXT NOT NULL,
    excursion_end TEXT,
    duration_minutes INTEGER,
    peak_temperature_c REAL NOT NULL,
    root_cause TEXT NOT NULL CHECK (root_cause IN (
        'power_outage',              -- other units affected at same time
        'unit_failure',              -- only this unit affected, sustained excursion
        'door_left_open',            -- brief spike, self-corrects
        'overload',                  -- gradual warming, correlates with restock event
        'sensor_error',              -- reading conflicts with adjacent logs
        'unknown'
    )),
    confidence REAL NOT NULL DEFAULT 0.5,   -- 0..1 score
    suggested_actions TEXT,                  -- newline-separated bullets
    affected_products TEXT,                  -- comma-separated product names
    reviewed_by TEXT REFERENCES users(id),
    reviewed_at TEXT,
    resolution_notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cc_analyses_unit ON cold_chain_analyses(unit_id, excursion_start DESC);
CREATE INDEX IF NOT EXISTS idx_cc_analyses_open ON cold_chain_analyses(reviewed_at) WHERE reviewed_at IS NULL;

-- ─── Counselling templates + encounters ─────────────────────────────────
-- Templates seed the checklist shown at dispense time. Each row is a
-- reusable script keyed by drug_class OR product_id (product-level
-- override wins over class-level default). Encounters capture what was
-- actually covered + who counselled + patient acknowledgement.
CREATE TABLE IF NOT EXISTS counselling_templates (
    id TEXT PRIMARY KEY,
    drug_class TEXT,                        -- matches pharmacy_products.drug_class
    product_id TEXT REFERENCES products(id),
    name TEXT NOT NULL,
    dose_instructions TEXT,
    timing TEXT,
    food_interaction TEXT,
    side_effects TEXT,
    storage TEXT,
    missed_dose TEXT,
    warnings TEXT,                          -- red-flag warnings to stress verbally
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_counselling_templates_class ON counselling_templates(drug_class);
CREATE INDEX IF NOT EXISTS idx_counselling_templates_product ON counselling_templates(product_id);

CREATE TABLE IF NOT EXISTS counselling_encounters (
    id TEXT PRIMARY KEY,
    prescription_id TEXT REFERENCES prescriptions(id),
    sale_id TEXT REFERENCES sales(id),
    customer_id TEXT REFERENCES customers(id),
    patient_name TEXT NOT NULL,
    pharmacist_id TEXT REFERENCES users(id),
    templates_used TEXT,                    -- JSON array of template ids covered
    checklist_json TEXT,                    -- captured tick-boxes + notes
    patient_acknowledged INTEGER NOT NULL DEFAULT 0,
    counselled_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_counselling_prescription ON counselling_encounters(prescription_id);
CREATE INDEX IF NOT EXISTS idx_counselling_customer ON counselling_encounters(customer_id);

-- Seed 8 core counselling templates covering the most-dispensed drug classes.
INSERT OR IGNORE INTO counselling_templates
    (id, drug_class, name, dose_instructions, timing, food_interaction, side_effects, storage, missed_dose, warnings)
VALUES
    ('ct-penicillins', 'Penicillins', 'Penicillin-class antibiotics',
     'Complete the FULL course even if symptoms improve. Stopping early risks resistance.',
     'Every 8 hours (or as prescribed). Space doses evenly.',
     'Can be taken with or without food. Avoid alcohol during treatment.',
     'Nausea, diarrhoea, mild rash. STOP and contact a doctor if breathing difficulty or swelling occurs.',
     'Room temperature. Keep the bottle sealed.',
     'Take as soon as remembered unless the next dose is < 4 hours away. Do not double-dose.',
     'Life-threatening allergy risk. Confirm no penicillin allergy before dispensing.'),

    ('ct-cephalosporins', 'Cephalosporins', 'Cephalosporin antibiotics',
     'Complete the FULL course. Take exactly as prescribed.',
     'Every 12 or 24 hours as prescribed.',
     'Take with food to reduce stomach upset. Avoid alcohol.',
     'Nausea, diarrhoea, oral thrush. Watch for allergic reaction.',
     'Room temperature. Suspensions in fridge — check the label.',
     'Take as soon as remembered unless close to next dose.',
     'Cross-reactivity with penicillin allergy in ~10% of patients. Verify.'),

    ('ct-macrolides', 'Macrolides', 'Macrolide antibiotics',
     'Complete the course. Azithromycin is often a short 3–5 day course.',
     'Once daily is typical for azithromycin. Others every 8-12h.',
     'Take on an empty stomach (1h before or 2h after meals) for best absorption.',
     'GI upset, taste changes, rare QT prolongation.',
     'Room temperature.',
     'Take as soon as remembered.',
     'Interacts with warfarin, statins, and some heart medications. Review current meds.'),

    ('ct-hypertension', 'Antihypertensives', 'Blood pressure medication',
     'Take EVERY day even when feeling well. Blood pressure is silent.',
     'Same time each day. Morning is common.',
     'Some (e.g. amlodipine) with or without food. Avoid grapefruit juice with certain BP drugs.',
     'Dizziness (especially when standing up), ankle swelling, cough (ACE inhibitors), tiredness.',
     'Room temperature, away from moisture.',
     'Take as soon as remembered. If more than 12 hours late, skip and resume next day.',
     'Do NOT stop suddenly — rebound hypertension. Monitor BP weekly.'),

    ('ct-insulin', 'Insulin', 'Insulin injection',
     'Rotate injection sites (abdomen, thigh, upper arm). Match dose to meal + activity.',
     'Fast-acting: 15 min before meals. Long-acting: same time daily.',
     'Match dose to carbohydrate intake. Discuss with clinician.',
     'Hypoglycemia symptoms: shakiness, sweating, confusion. Keep glucose tablets or juice nearby.',
     'Unopened: fridge (2–8°C). Opened pen/vial: room temperature, use within 28 days.',
     'Never double-dose. Test blood sugar and take usual dose next time.',
     'COLD-CHAIN sensitive. Check that vials/pens have been stored correctly. Confirm expiry date.'),

    ('ct-warfarin', 'Anticoagulants', 'Warfarin / anticoagulant',
     'Take exactly the prescribed dose. Even small overdoses cause bleeding.',
     'Same time each day, usually evening.',
     'Keep vitamin K intake (green leafy vegetables) CONSISTENT day to day. Avoid alcohol binges.',
     'Bleeding gums, blood in urine, unusual bruising, black stools — contact clinician immediately.',
     'Room temperature.',
     'Take as soon as remembered same day. If missed a full day, skip and record.',
     'Requires regular INR monitoring. Confirm next INR appointment.'),

    ('ct-inhalers', 'Inhalers', 'Asthma / COPD inhaler',
     'Shake well. Exhale, seal lips, inhale slowly + deeply while pressing canister. Hold 10 sec.',
     'Preventer (steroid): daily as prescribed. Reliever (blue): as needed for symptoms.',
     'Rinse mouth after steroid inhaler to prevent oral thrush.',
     'Steroid: hoarseness, thrush. Reliever: tremor, palpitations.',
     'Room temperature. Do not store above 30°C.',
     'Preventer: take next dose on time. Reliever: use as symptoms need.',
     'Frequent reliever use (>3 times/week) means asthma is uncontrolled. Review with clinician.'),

    ('ct-antimalarials', 'Antimalarials', 'Antimalarial (ACT / others)',
     'Complete the FULL course even if fever resolves.',
     'Artemether-lumefantrine (Coartem): 6 doses over 3 days, at 0h, 8h, 24h, 36h, 48h, 60h.',
     'TAKE WITH FATTY FOOD (milk, groundnuts, avocado) — improves absorption significantly.',
     'Nausea, dizziness, headache. Report worsening fever or new symptoms.',
     'Room temperature, away from moisture.',
     'Take as soon as remembered, then adjust remaining schedule.',
     'Not for severe malaria (send to hospital). Vomiting within 30 min → repeat the dose.');
CREATE INDEX IF NOT EXISTS idx_counselling_templates_active ON counselling_templates(active);

-- ─── PPB automatic submissions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ppb_submissions (
    id TEXT PRIMARY KEY,
    period_type TEXT NOT NULL CHECK (period_type IN ('quarterly', 'monthly', 'annual')),
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    submission_ref TEXT,                    -- PPB-side reference on success
    payload_json TEXT NOT NULL,             -- serialized report body
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'queued', 'submitted', 'acknowledged', 'rejected', 'manual_review'
    )),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    submitted_at TEXT,
    acknowledged_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(period_type, period_start, period_end)
);
CREATE INDEX IF NOT EXISTS idx_ppb_submissions_status ON ppb_submissions(status);
CREATE INDEX IF NOT EXISTS idx_ppb_submissions_period ON ppb_submissions(period_end DESC);

-- PPB settings — single-row config table.
CREATE TABLE IF NOT EXISTS ppb_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled INTEGER NOT NULL DEFAULT 0,
    api_endpoint TEXT,
    api_key_encrypted TEXT,
    facility_code TEXT,
    superintendent_pharmacist_id TEXT REFERENCES employees(id),
    superintendent_license_number TEXT,
    auto_submit_day INTEGER NOT NULL DEFAULT 10  -- day of month after quarter end
);
INSERT OR IGNORE INTO ppb_settings (id) VALUES (1);
