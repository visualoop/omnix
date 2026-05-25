-- Phase 10: Drug interactions
-- Stores known clinically significant drug-drug interactions.
-- Match against products by generic_name (case-insensitive).

CREATE TABLE IF NOT EXISTS drug_interactions (
    id TEXT PRIMARY KEY,
    drug_a TEXT NOT NULL,                    -- generic name (lowercase)
    drug_b TEXT NOT NULL,                    -- generic name (lowercase)
    severity TEXT NOT NULL CHECK (severity IN ('contraindicated', 'major', 'moderate', 'minor')),
    description TEXT NOT NULL,
    clinical_effect TEXT,
    management TEXT,
    source TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_interactions_drug_a ON drug_interactions(drug_a);
CREATE INDEX IF NOT EXISTS idx_interactions_drug_b ON drug_interactions(drug_b);

-- Custom interaction overrides (pharmacist-added)
CREATE TABLE IF NOT EXISTS interaction_overrides (
    id TEXT PRIMARY KEY,
    interaction_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    note TEXT,
    suppress_warning INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed with clinically significant interactions
-- Source: Common pharmacy references (BNF, Stockley's). Severity follows DDInter classification.
INSERT OR IGNORE INTO drug_interactions (id, drug_a, drug_b, severity, description, clinical_effect, management) VALUES
    -- Contraindicated
    ('di-001', 'warfarin', 'aspirin', 'major', 'Increased bleeding risk', 'Both drugs increase bleeding risk; combination significantly raises GI bleed and intracranial hemorrhage risk', 'Avoid combination unless prescribed by physician. Monitor INR closely.'),
    ('di-002', 'warfarin', 'ibuprofen', 'major', 'Increased bleeding risk and decreased anticoagulation control', 'NSAIDs displace warfarin from protein binding and impair platelet function', 'Use paracetamol instead. If NSAID required, monitor INR weekly.'),
    ('di-003', 'simvastatin', 'erythromycin', 'major', 'Increased risk of rhabdomyolysis', 'CYP3A4 inhibition raises simvastatin levels; muscle breakdown risk', 'Avoid combination. Consider azithromycin instead.'),
    ('di-004', 'simvastatin', 'clarithromycin', 'major', 'Increased risk of rhabdomyolysis', 'CYP3A4 inhibition raises simvastatin levels significantly', 'Stop statin during antibiotic course or use azithromycin.'),
    ('di-005', 'metformin', 'iodinated contrast', 'major', 'Risk of lactic acidosis', 'Contrast can impair kidney function leading to metformin accumulation', 'Hold metformin 48h before and after contrast imaging.'),
    ('di-006', 'metoclopramide', 'haloperidol', 'major', 'Increased risk of extrapyramidal effects', 'Both block dopamine receptors', 'Avoid combination. Use ondansetron for nausea instead.'),
    ('di-007', 'tramadol', 'ssri', 'major', 'Serotonin syndrome risk', 'Both increase serotonin; combination can cause hyperthermia, agitation, seizures', 'Avoid combination. Use codeine or paracetamol instead.'),
    ('di-008', 'tramadol', 'fluoxetine', 'major', 'Serotonin syndrome risk', 'Combined serotonergic effect', 'Avoid; use alternative analgesic'),
    ('di-009', 'tramadol', 'sertraline', 'major', 'Serotonin syndrome risk', 'Combined serotonergic effect', 'Avoid; use alternative analgesic'),
    ('di-010', 'sildenafil', 'nitroglycerin', 'contraindicated', 'Severe hypotension - life threatening', 'Both lower blood pressure; combination can cause profound hypotension', 'Never combine. Wait 24h after sildenafil before nitrates (48h for tadalafil).'),
    ('di-011', 'sildenafil', 'isosorbide', 'contraindicated', 'Severe hypotension - life threatening', 'PDE5 inhibitors plus nitrates causes dangerous BP drop', 'Never combine.'),
    -- Major
    ('di-020', 'ciprofloxacin', 'tizanidine', 'major', 'Excessive sedation and hypotension', 'CYP1A2 inhibition raises tizanidine levels 10x', 'Avoid combination. Use levofloxacin if fluoroquinolone needed.'),
    ('di-021', 'amoxicillin', 'methotrexate', 'major', 'Methotrexate toxicity', 'Penicillins reduce methotrexate clearance', 'Use alternative antibiotic or monitor MTX levels.'),
    ('di-022', 'paracetamol', 'warfarin', 'moderate', 'Increased INR with high doses', 'Long-term high-dose paracetamol can increase warfarin effect', 'Limit paracetamol to <2g/day if on warfarin. Monitor INR.'),
    ('di-023', 'enalapril', 'spironolactone', 'major', 'Hyperkalemia risk', 'Both raise potassium; combination can cause cardiac arrhythmia', 'Monitor K+ weekly initially, then monthly.'),
    ('di-024', 'enalapril', 'potassium', 'major', 'Severe hyperkalemia', 'ACE inhibitors retain potassium', 'Avoid potassium supplements unless specifically directed by physician.'),
    -- Moderate
    ('di-030', 'metformin', 'alcohol', 'moderate', 'Lactic acidosis risk', 'Alcohol increases metformin-induced lactic acidosis risk', 'Avoid heavy alcohol use.'),
    ('di-031', 'omeprazole', 'clopidogrel', 'moderate', 'Reduced antiplatelet effect', 'PPIs reduce clopidogrel activation via CYP2C19', 'Use pantoprazole instead, or H2 blocker.'),
    ('di-032', 'amoxicillin', 'oral contraceptive', 'moderate', 'Reduced contraceptive effect', 'Antibiotics may reduce gut flora and contraceptive absorption', 'Use barrier method during antibiotic course and 7 days after.'),
    ('di-033', 'metronidazole', 'alcohol', 'major', 'Disulfiram-like reaction', 'Causes flushing, nausea, vomiting, severe headache', 'Avoid alcohol during and 48h after metronidazole course.'),
    ('di-034', 'tetracycline', 'antacid', 'moderate', 'Reduced antibiotic absorption', 'Calcium/magnesium chelate tetracyclines', 'Take tetracycline 2h before or 4h after antacids.'),
    ('di-035', 'ciprofloxacin', 'antacid', 'moderate', 'Reduced antibiotic absorption', 'Polyvalent cations chelate fluoroquinolones', 'Take ciprofloxacin 2h before or 6h after antacids.'),
    ('di-036', 'levothyroxine', 'calcium', 'moderate', 'Reduced thyroid hormone absorption', 'Calcium binds levothyroxine in gut', 'Separate doses by at least 4 hours.'),
    -- Minor
    ('di-040', 'ibuprofen', 'paracetamol', 'minor', 'Generally safe combination', 'Combined analgesia is safe in normal doses', 'Stagger doses for pain control. Watch total daily limits.'),
    ('di-041', 'amoxicillin', 'clavulanic acid', 'minor', 'Combination product (Augmentin)', 'These are designed to be co-administered', 'No action needed - typically dispensed together.');
