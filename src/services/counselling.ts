/**
 * Structured patient counselling scripts + encounter tracking.
 *
 * At dispense time the pharmacist should counsel the patient on each
 * drug. This service resolves the applicable counselling template(s)
 * for a set of products (product-level override wins over drug-class
 * default), assembles a checklist, and records the encounter with the
 * pharmacist signature + patient acknowledgement.
 */
import { query, execute } from "@/lib/db";

export interface CounsellingTemplate {
  id: string;
  drug_class: string | null;
  product_id: string | null;
  name: string;
  dose_instructions: string | null;
  timing: string | null;
  food_interaction: string | null;
  side_effects: string | null;
  storage: string | null;
  missed_dose: string | null;
  warnings: string | null;
  active: number;
  created_at: string;
}

export interface CounsellingEncounter {
  id: string;
  prescription_id: string | null;
  sale_id: string | null;
  customer_id: string | null;
  patient_name: string;
  pharmacist_id: string | null;
  templates_used: string | null;
  checklist_json: string | null;
  patient_acknowledged: number;
  counselled_at: string;
}

/**
 * Resolve the applicable templates for a set of products. Product-level
 * templates win; otherwise the drug_class template applies. Pure-ish
 * (one query) so the resolution logic is testable via resolveTemplates.
 */
export async function templatesForProducts(productIds: string[]): Promise<CounsellingTemplate[]> {
  if (productIds.length === 0) return [];
  const placeholders = productIds.map((_, i) => `?${i + 1}`).join(",");

  // Product-level overrides.
  const productLevel = await query<CounsellingTemplate>(
    `SELECT * FROM counselling_templates
      WHERE active = 1 AND product_id IN (${placeholders})`,
    productIds,
  );

  // Drug classes for the products lacking a product-level template.
  const coveredProductIds = new Set(productLevel.map((t) => t.product_id));
  const uncovered = productIds.filter((id) => !coveredProductIds.has(id));
  let classLevel: CounsellingTemplate[] = [];
  if (uncovered.length > 0) {
    const up = uncovered.map((_, i) => `?${i + 1}`).join(",");
    const classes = await query<{ drug_class: string | null }>(
      `SELECT DISTINCT drug_class FROM pharmacy_products
        WHERE product_id IN (${up}) AND drug_class IS NOT NULL`,
      uncovered,
    );
    const classNames = classes.map((c) => c.drug_class).filter(Boolean) as string[];
    if (classNames.length > 0) {
      const cp = classNames.map((_, i) => `?${i + 1}`).join(",");
      classLevel = await query<CounsellingTemplate>(
        `SELECT * FROM counselling_templates
          WHERE active = 1 AND product_id IS NULL AND drug_class IN (${cp})`,
        classNames,
      );
    }
  }

  return dedupeTemplates([...productLevel, ...classLevel]);
}

/** Pure de-dupe by id — keeps the resolution order stable. */
export function dedupeTemplates(templates: CounsellingTemplate[]): CounsellingTemplate[] {
  const seen = new Set<string>();
  const out: CounsellingTemplate[] = [];
  for (const t of templates) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}

/**
 * Render a template into an ordered checklist of {label, text} lines
 * for the counselling UI. Skips empty fields. Pure + testable.
 */
export function renderChecklist(template: CounsellingTemplate): Array<{ field: string; label: string; text: string }> {
  const fields: Array<{ field: keyof CounsellingTemplate; label: string }> = [
    { field: "dose_instructions", label: "How to take" },
    { field: "timing", label: "When" },
    { field: "food_interaction", label: "Food / drink" },
    { field: "side_effects", label: "Side effects" },
    { field: "storage", label: "Storage" },
    { field: "missed_dose", label: "Missed dose" },
    { field: "warnings", label: "Warnings" },
  ];
  const out: Array<{ field: string; label: string; text: string }> = [];
  for (const f of fields) {
    const text = template[f.field];
    if (typeof text === "string" && text.trim()) {
      out.push({ field: String(f.field), label: f.label, text });
    }
  }
  return out;
}

export async function listTemplates(): Promise<CounsellingTemplate[]> {
  return query<CounsellingTemplate>(
    `SELECT * FROM counselling_templates WHERE active = 1 ORDER BY drug_class, name`,
  );
}

export async function recordEncounter(input: {
  prescriptionId?: string | null;
  saleId?: string | null;
  customerId?: string | null;
  patientName: string;
  pharmacistId: string;
  templateIds: string[];
  checklist: Record<string, boolean>;
  patientAcknowledged: boolean;
}): Promise<string> {
  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO counselling_encounters
       (id, prescription_id, sale_id, customer_id, patient_name, pharmacist_id,
        templates_used, checklist_json, patient_acknowledged)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    [
      id, input.prescriptionId ?? null, input.saleId ?? null, input.customerId ?? null,
      input.patientName, input.pharmacistId,
      JSON.stringify(input.templateIds), JSON.stringify(input.checklist),
      input.patientAcknowledged ? 1 : 0,
    ],
  );
  return id;
}

export async function listEncounters(customerId?: string): Promise<CounsellingEncounter[]> {
  return query<CounsellingEncounter>(
    `SELECT * FROM counselling_encounters ${customerId ? "WHERE customer_id = ?1" : ""} ORDER BY counselled_at DESC LIMIT 100`,
    customerId ? [customerId] : [],
  );
}
