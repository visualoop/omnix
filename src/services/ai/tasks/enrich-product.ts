/**
 * Enrich a product name into typed fields the user can review and accept.
 * Output is conservative — no fabrications; if the model isn't sure of a
 * field it returns null. The user always reviews before commit.
 */
import { invoke } from "../router";
import type { InvokeOptions } from "../types";

export interface EnrichProductResult {
  /** The canonical full name (e.g. "Paracetamol 500mg" not "panadol"). */
  name: string;
  /** Generic category (e.g. "Analgesic", "Cooking & Edibles"). */
  category: string | null;
  /** Selling unit (e.g. "tablet", "ml", "kg"). */
  unit: string | null;
  /** Default Kenya VAT rate as decimal percent (16, 8, 0). */
  tax_rate: number | null;
  /** Pharmacy-only: active ingredient if obvious (paracetamol, amoxicillin). */
  active_ingredient: string | null;
  /** Free-text confidence ("high", "medium", "low"). */
  confidence: "high" | "medium" | "low";
  /** One-sentence rationale for the cashier. */
  notes: string | null;
}

const SYSTEM = `You are a product cataloging assistant for a Kenyan SME ERP.
Given a brand or colloquial product name (often Sheng / Swahili / English mix), return strict JSON
matching the schema below. Be conservative: if you're unsure, return null for that field rather
than guessing. Use Kenyan tax rates: 16 (default VAT), 8 (fuel), 0 (zero-rated essentials/medicines).

Schema:
{
  "name": string,                       // canonical full name
  "category": string | null,            // e.g. "Analgesic", "Dairy", "Cooking & Edibles"
  "unit": string | null,                // e.g. "tablet","ml","kg","pcs","bottle"
  "tax_rate": number | null,            // 16, 8, 0
  "active_ingredient": string | null,   // pharmacy products only; null otherwise
  "confidence": "high" | "medium" | "low",
  "notes": string | null                // one-sentence reason; max 80 chars
}`;

export async function enrichProduct(
  query: string,
  opts: InvokeOptions = {},
): Promise<EnrichProductResult> {
  const r = await invoke(
    "enrich_product",
    {
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: query },
      ],
      jsonSchema: { type: "object" }, // signals JSON output to the router
      temperature: 0.1,
      maxTokens: 300,
    },
    opts,
  );
  if (!r.json) {
    // Some providers return text only; try to parse it
    try {
      const parsed = JSON.parse(r.text);
      return parsed as EnrichProductResult;
    } catch {
      return {
        name: query,
        category: null,
        unit: null,
        tax_rate: null,
        active_ingredient: null,
        confidence: "low",
        notes: "AI output was not parseable; review manually.",
      };
    }
  }
  return r.json as EnrichProductResult;
}
