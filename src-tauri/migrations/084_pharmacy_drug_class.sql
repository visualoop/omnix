-- ============================================================================
-- 084_pharmacy_drug_class.sql
-- Explicit drug_class tag on pharmacy_products so the AMR surveillance report
-- doesn't need to guess an antibiotic family from the product name pattern.
-- Also adds a helper flag so newly-added pharmacy products can indicate
-- whether they are antimicrobial without needing a full class map.
-- ============================================================================

ALTER TABLE pharmacy_products ADD COLUMN drug_class TEXT;
ALTER TABLE pharmacy_products ADD COLUMN is_antimicrobial INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_pharmacy_products_drug_class ON pharmacy_products(drug_class);
CREATE INDEX IF NOT EXISTS idx_pharmacy_products_is_antimicrobial ON pharmacy_products(is_antimicrobial);

-- Seed drug_class for common generics already in the database. Uses the same
-- pattern-matching heuristic that services/amr-report.ts used previously so
-- existing products get a class assigned automatically. New products entered
-- after this migration can be tagged explicitly via the product-detail page.
UPDATE pharmacy_products
   SET drug_class = 'Penicillins', is_antimicrobial = 1
 WHERE drug_class IS NULL
   AND (
     LOWER(COALESCE(generic_name, '')) LIKE '%amoxicillin%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%ampicillin%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%penicillin%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%co-amoxiclav%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%flucloxacillin%'
   );

UPDATE pharmacy_products
   SET drug_class = 'Cephalosporins', is_antimicrobial = 1
 WHERE drug_class IS NULL
   AND (
     LOWER(COALESCE(generic_name, '')) LIKE '%cef%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%ceph%'
   );

UPDATE pharmacy_products
   SET drug_class = 'Macrolides', is_antimicrobial = 1
 WHERE drug_class IS NULL
   AND (
     LOWER(COALESCE(generic_name, '')) LIKE '%azithromycin%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%clarithromycin%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%erythromycin%'
   );

UPDATE pharmacy_products
   SET drug_class = 'Fluoroquinolones', is_antimicrobial = 1
 WHERE drug_class IS NULL
   AND (
     LOWER(COALESCE(generic_name, '')) LIKE '%ciprofloxacin%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%levofloxacin%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%moxifloxacin%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%ofloxacin%'
   );

UPDATE pharmacy_products
   SET drug_class = 'Tetracyclines', is_antimicrobial = 1
 WHERE drug_class IS NULL
   AND (
     LOWER(COALESCE(generic_name, '')) LIKE '%doxycycline%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%tetracycline%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%minocycline%'
   );

UPDATE pharmacy_products
   SET drug_class = 'Aminoglycosides', is_antimicrobial = 1
 WHERE drug_class IS NULL
   AND (
     LOWER(COALESCE(generic_name, '')) LIKE '%gentamicin%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%amikacin%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%streptomycin%'
   );

UPDATE pharmacy_products
   SET drug_class = 'Sulfonamides', is_antimicrobial = 1
 WHERE drug_class IS NULL
   AND (
     LOWER(COALESCE(generic_name, '')) LIKE '%cotrimoxazole%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%sulfamethoxazole%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%bactrim%'
   );

UPDATE pharmacy_products
   SET drug_class = 'Nitroimidazoles', is_antimicrobial = 1
 WHERE drug_class IS NULL
   AND (
     LOWER(COALESCE(generic_name, '')) LIKE '%metronidazole%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%tinidazole%'
   );

UPDATE pharmacy_products
   SET drug_class = 'Carbapenems', is_antimicrobial = 1
 WHERE drug_class IS NULL
   AND (
     LOWER(COALESCE(generic_name, '')) LIKE '%meropenem%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%imipenem%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%ertapenem%'
   );

UPDATE pharmacy_products
   SET drug_class = 'Glycopeptides', is_antimicrobial = 1
 WHERE drug_class IS NULL
   AND (
     LOWER(COALESCE(generic_name, '')) LIKE '%vancomycin%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%teicoplanin%'
   );

UPDATE pharmacy_products
   SET drug_class = 'Antifungals', is_antimicrobial = 1
 WHERE drug_class IS NULL
   AND (
     LOWER(COALESCE(generic_name, '')) LIKE '%fluconazole%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%itraconazole%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%ketoconazole%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%clotrimazole%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%nystatin%'
   );

UPDATE pharmacy_products
   SET drug_class = 'Antimalarials', is_antimicrobial = 1
 WHERE drug_class IS NULL
   AND (
     LOWER(COALESCE(generic_name, '')) LIKE '%artemether%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%lumefantrine%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%quinine%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%doxycycline%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%chloroquine%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%mefloquine%'
   );

UPDATE pharmacy_products
   SET drug_class = 'Anti-TB', is_antimicrobial = 1
 WHERE drug_class IS NULL
   AND (
     LOWER(COALESCE(generic_name, '')) LIKE '%rifampicin%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%isoniazid%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%ethambutol%'
     OR LOWER(COALESCE(generic_name, '')) LIKE '%pyrazinamide%'
   );
