/**
 * AMR (Antimicrobial Resistance) surveillance report.
 *
 * Tracks antibiotic dispensing volumes by class to support the National AMR
 * Surveillance Strategy. Pharmacies are expected to flag misuse patterns.
 *
 * Detection: prefers `pharmacy_products.drug_class` (migration 084) when
 * populated. Falls back to the legacy pattern-matching for products
 * without a class tag so the report doesn't drop rows on partially-tagged
 * inventories.
 */
import { query } from "@/lib/db";

const ANTIBIOTIC_CLASSES = [
  { class: "Penicillins", patterns: ["penicillin", "amoxicillin", "ampicillin", "co-amoxiclav", "augmentin", "flucloxacillin"] },
  { class: "Cephalosporins", patterns: ["cefuroxime", "ceftriaxone", "cefixime", "cefpodoxime", "cephalexin", "cefaclor", "cefdinir"] },
  { class: "Macrolides", patterns: ["azithromycin", "erythromycin", "clarithromycin", "zithromax"] },
  { class: "Fluoroquinolones", patterns: ["ciprofloxacin", "levofloxacin", "moxifloxacin", "norfloxacin", "ofloxacin"] },
  { class: "Tetracyclines", patterns: ["doxycycline", "tetracycline", "minocycline"] },
  { class: "Aminoglycosides", patterns: ["gentamicin", "amikacin", "tobramycin"] },
  { class: "Sulfonamides", patterns: ["cotrimoxazole", "bactrim", "sulfamethoxazole", "trimethoprim"] },
  { class: "Nitroimidazoles", patterns: ["metronidazole", "tinidazole", "flagyl"] },
  { class: "Carbapenems", patterns: ["meropenem", "imipenem", "ertapenem"] },
  { class: "Glycopeptides", patterns: ["vancomycin", "teicoplanin"] },
  { class: "Antifungals", patterns: ["fluconazole", "itraconazole", "ketoconazole", "nystatin", "clotrimazole"] },
  { class: "Antimalarials", patterns: ["artemether", "lumefantrine", "coartem", "quinine", "sulfadoxine", "pyrimethamine"] },
  { class: "Anti-TB", patterns: ["isoniazid", "rifampicin", "ethambutol", "pyrazinamide"] },
];

export interface AntibioticClassReport {
  class: string;
  units_dispensed: number;
  unique_patients: number;
  total_revenue: number;
  pattern_count: number;
}

export interface AntibioticTopProduct {
  product_name: string;
  product_class: string;
  units_dispensed: number;
  revenue: number;
  unique_patients: number;
}

export async function getAntibioticByClass(opts?: {
  startDate?: string;
  endDate?: string;
  branchId?: string;
}): Promise<AntibioticClassReport[]> {
  const conditions: string[] = ["s.status != 'voided'"];
  const params: any[] = [];
  if (opts?.startDate) { conditions.push(`s.created_at >= ?${params.length + 1}`); params.push(opts.startDate); }
  if (opts?.endDate) { conditions.push(`s.created_at <= ?${params.length + 1}`); params.push(opts.endDate + " 23:59:59"); }
  if (opts?.branchId) { conditions.push(`s.branch_id = ?${params.length + 1}`); params.push(opts.branchId); }
  const where = `WHERE ${conditions.join(" AND ")}`;

  // Get all sale items in period, joined to pharmacy_products so the
  // drug_class tag (migration 084) is preferred over name-pattern matching.
  const items = await query<{
    product_name: string;
    quantity: number;
    total: number;
    customer_id: string | null;
    drug_class: string | null;
    is_antimicrobial: number | null;
  }>(
    `SELECT si.product_name, si.quantity, si.total, s.customer_id,
            pp.drug_class, pp.is_antimicrobial
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     LEFT JOIN pharmacy_products pp ON pp.product_id = si.product_id
     ${where}`,
    params,
  );

  // Classify each item: prefer the tagged drug_class, fall back to name pattern.
  const classMap = new Map<string, { units: number; revenue: number; patients: Set<string>; patterns: number }>();
  for (const item of items) {
    let cls: string | null = null;

    // Preferred path — explicit tag.
    if (item.drug_class && (item.is_antimicrobial === 1 || ANTIBIOTIC_CLASSES.some((c) => c.class === item.drug_class))) {
      cls = item.drug_class;
    } else {
      // Fallback pattern match for untagged rows.
      const lower = item.product_name.toLowerCase();
      const matched = ANTIBIOTIC_CLASSES.find((c) => c.patterns.some((p) => lower.includes(p)));
      if (matched) cls = matched.class;
    }

    if (!cls) continue;
    if (!classMap.has(cls)) {
      classMap.set(cls, { units: 0, revenue: 0, patients: new Set(), patterns: 0 });
    }
    const entry = classMap.get(cls)!;
    entry.units += item.quantity;
    entry.revenue += item.total;
    entry.patterns++;
    if (item.customer_id) entry.patients.add(item.customer_id);
  }

  return Array.from(classMap.entries())
    .map(([cls, data]) => ({
      class: cls,
      units_dispensed: data.units,
      unique_patients: data.patients.size,
      total_revenue: data.revenue,
      pattern_count: data.patterns,
    }))
    .sort((a, b) => b.units_dispensed - a.units_dispensed);
}

export async function getTopAntibiotics(opts?: {
  startDate?: string;
  endDate?: string;
  branchId?: string;
  limit?: number;
}): Promise<AntibioticTopProduct[]> {
  const conditions: string[] = ["s.status != 'voided'"];
  const params: any[] = [];
  if (opts?.startDate) { conditions.push(`s.created_at >= ?${params.length + 1}`); params.push(opts.startDate); }
  if (opts?.endDate) { conditions.push(`s.created_at <= ?${params.length + 1}`); params.push(opts.endDate + " 23:59:59"); }
  if (opts?.branchId) { conditions.push(`s.branch_id = ?${params.length + 1}`); params.push(opts.branchId); }
  const where = `WHERE ${conditions.join(" AND ")}`;

  const items = await query<{
    product_name: string;
    quantity: number;
    total: number;
    customer_id: string | null;
    drug_class: string | null;
    is_antimicrobial: number | null;
  }>(
    `SELECT si.product_name, si.quantity, si.total, s.customer_id,
            pp.drug_class, pp.is_antimicrobial
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     LEFT JOIN pharmacy_products pp ON pp.product_id = si.product_id
     ${where}`,
    params,
  );

  const productMap = new Map<string, { class: string; units: number; revenue: number; patients: Set<string> }>();
  for (const item of items) {
    let cls: string | null = null;
    if (item.drug_class && (item.is_antimicrobial === 1 || ANTIBIOTIC_CLASSES.some((c) => c.class === item.drug_class))) {
      cls = item.drug_class;
    } else {
      const lower = item.product_name.toLowerCase();
      const matched = ANTIBIOTIC_CLASSES.find((c) => c.patterns.some((p) => lower.includes(p)));
      if (matched) cls = matched.class;
    }
    if (!cls) continue;
    if (!productMap.has(item.product_name)) {
      productMap.set(item.product_name, { class: cls, units: 0, revenue: 0, patients: new Set() });
    }
    const entry = productMap.get(item.product_name)!;
    entry.units += item.quantity;
    entry.revenue += item.total;
    if (item.customer_id) entry.patients.add(item.customer_id);
  }

  return Array.from(productMap.entries())
    .map(([name, data]) => ({
      product_name: name,
      product_class: data.class,
      units_dispensed: data.units,
      revenue: data.revenue,
      unique_patients: data.patients.size,
    }))
    .sort((a, b) => b.units_dispensed - a.units_dispensed)
    .slice(0, opts?.limit || 20);
}

export interface AmrSummary {
  total_antibiotic_units: number;
  total_dispenses: number;
  unique_classes: number;
  with_prescription_pct: number;
}

export async function getAmrSummary(opts?: {
  startDate?: string;
  endDate?: string;
  branchId?: string;
}): Promise<AmrSummary> {
  const byClass = await getAntibioticByClass(opts);

  // Compute the % of antibiotic dispenses that were tied to a prescription.
  // Approach: count antibiotic sale_items whose sale_id appears in
  // prescription_dispenses, vs. the total antibiotic sale_items.
  let withPrescriptionPct = 0;
  try {
    const start = opts?.startDate ?? "1970-01-01";
    const end = opts?.endDate ?? new Date().toISOString();
    const branchClause = opts?.branchId ? " AND s.branch_id = ?3" : "";
    const params = opts?.branchId ? [start, end, opts.branchId] : [start, end];

    const totalRows = await query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       JOIN sales s   ON s.id = si.sale_id
       WHERE p.is_antibiotic = 1
         AND s.status NOT IN ('voided','refunded')
         AND s.created_at >= ?1 AND s.created_at < ?2${branchClause}`,
      params,
    );

    const linkedRows = await query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       JOIN sales s   ON s.id = si.sale_id
       JOIN prescription_dispenses pd ON pd.sale_id = s.id
       WHERE p.is_antibiotic = 1
         AND s.status NOT IN ('voided','refunded')
         AND s.created_at >= ?1 AND s.created_at < ?2${branchClause}`,
      params,
    );

    const total = totalRows[0]?.total ?? 0;
    const linked = linkedRows[0]?.total ?? 0;
    withPrescriptionPct = total > 0 ? Math.round((linked / total) * 100) : 0;
  } catch {
    // prescription_dispenses or is_antibiotic may not exist yet on older DBs.
    withPrescriptionPct = 0;
  }

  return {
    total_antibiotic_units: byClass.reduce((s, c) => s + c.units_dispensed, 0),
    total_dispenses: byClass.reduce((s, c) => s + c.pattern_count, 0),
    unique_classes: byClass.length,
    with_prescription_pct: withPrescriptionPct,
  };
}
