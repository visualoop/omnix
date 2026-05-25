import { query } from "@/lib/db";

export interface DrugInteraction {
  id: string;
  drug_a: string;
  drug_b: string;
  severity: "contraindicated" | "major" | "moderate" | "minor";
  description: string;
  clinical_effect: string | null;
  management: string | null;
  // Joined fields when checking
  product_a_name?: string;
  product_b_name?: string;
}

export interface InteractionWarning {
  interaction: DrugInteraction;
  product_a: { id: string; name: string; generic: string };
  product_b: { id: string; name: string; generic: string };
}

/**
 * Check for interactions between a list of products in a cart/prescription.
 * Returns all detected interactions sorted by severity (worst first).
 */
export async function checkInteractions(
  productIds: string[]
): Promise<InteractionWarning[]> {
  if (productIds.length < 2) return [];

  // Fetch generic names from pharmacy_products for the given product IDs
  const products = await query<{ product_id: string; product_name: string; generic_name: string }>(
    `SELECT pp.product_id, p.name as product_name, LOWER(TRIM(pp.generic_name)) as generic_name
     FROM pharmacy_products pp
     JOIN products p ON p.id = pp.product_id
     WHERE pp.product_id IN (${productIds.map((_, i) => `?${i + 1}`).join(",")})
       AND pp.generic_name IS NOT NULL AND TRIM(pp.generic_name) != ''`,
    productIds
  );

  if (products.length < 2) return [];

  // Check all pairs
  const warnings: InteractionWarning[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      const a = products[i];
      const b = products[j];

      // Query interactions where (drug_a matches a.generic AND drug_b matches b.generic) or vice versa
      // Use LIKE to match partial generics (e.g., "fluoxetine HCl" matches "fluoxetine")
      const matches = await query<DrugInteraction>(
        `SELECT * FROM drug_interactions
         WHERE (
           (?1 LIKE '%' || drug_a || '%' AND ?2 LIKE '%' || drug_b || '%')
           OR (?1 LIKE '%' || drug_b || '%' AND ?2 LIKE '%' || drug_a || '%')
         )`,
        [a.generic_name, b.generic_name]
      );

      for (const m of matches) {
        const key = [m.id, a.product_id, b.product_id].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        warnings.push({
          interaction: m,
          product_a: { id: a.product_id, name: a.product_name, generic: a.generic_name },
          product_b: { id: b.product_id, name: b.product_name, generic: b.generic_name },
        });
      }
    }
  }

  // Sort: contraindicated > major > moderate > minor
  const order = { contraindicated: 0, major: 1, moderate: 2, minor: 3 };
  warnings.sort((x, y) => order[x.interaction.severity] - order[y.interaction.severity]);

  return warnings;
}

export async function listInteractions(): Promise<DrugInteraction[]> {
  return query<DrugInteraction>(
    "SELECT * FROM drug_interactions ORDER BY severity, drug_a"
  );
}

export function getSeverityColor(severity: DrugInteraction["severity"]): {
  badge: string;
  border: string;
  bg: string;
  text: string;
  label: string;
} {
  switch (severity) {
    case "contraindicated":
      return {
        badge: "bg-red-700 text-white",
        border: "border-red-700",
        bg: "bg-red-50",
        text: "text-red-900",
        label: "CONTRAINDICATED",
      };
    case "major":
      return {
        badge: "bg-red-600 text-white",
        border: "border-red-500/50",
        bg: "bg-red-500/5",
        text: "text-red-700",
        label: "MAJOR",
      };
    case "moderate":
      return {
        badge: "bg-amber-500 text-white",
        border: "border-amber-500/50",
        bg: "bg-amber-500/5",
        text: "text-amber-700",
        label: "MODERATE",
      };
    case "minor":
      return {
        badge: "bg-blue-500 text-white",
        border: "border-blue-500/50",
        bg: "bg-blue-500/5",
        text: "text-blue-700",
        label: "MINOR",
      };
  }
}
