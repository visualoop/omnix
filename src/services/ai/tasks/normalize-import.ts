/**
 * Map messy supplier CSV/Excel headers to Omnix product fields.
 *
 * Input: array of header strings ("ITEM", "qty pakd", "unt price ksh", …)
 * Output: a mapping { sourceHeader → targetField | null } where targetField is
 *         one of Omnix's known product fields, or null if no good match.
 *
 * The user reviews and edits before commit — AI is a starting point, not
 * the final answer.
 */
import { invoke } from "../router";
import type { InvokeOptions } from "../types";

export type OmnixField =
  | "name"
  | "sku"
  | "barcode"
  | "category"
  | "unit"
  | "buying_price"
  | "selling_price"
  | "tax_rate"
  | "initial_stock"
  | "reorder_level"
  | "expiry_date"
  | "batch_number"
  | "supplier_code"
  | "description";

export interface ImportMapping {
  source_header: string;
  target_field: OmnixField | null;
  confidence: "high" | "medium" | "low";
}

const SYSTEM = `You are a CSV-import assistant for a Kenyan ERP (Omnix). Map each source header to
one of these Omnix fields, or null if no good match:
  name, sku, barcode, category, unit, buying_price, selling_price, tax_rate,
  initial_stock, reorder_level, expiry_date, batch_number, supplier_code, description

Rules:
  - Match conservatively. Better to return null than wrong.
  - "qty", "stock", "qty packed", "pack qty" → initial_stock
  - "buying", "cost", "wholesale", "purchase price" → buying_price
  - "selling", "retail", "rrp", "MSRP", "tag price" → selling_price
  - "vat", "tax %", "tax rate" → tax_rate
  - "expires", "exp", "exp date", "best before" → expiry_date
  - Two columns mapping to the same field is OK; user will resolve in UI.

Return a JSON object with key "mappings" containing an array, one entry per input header:
{
  "mappings": [
    { "source_header": "<original>", "target_field": "<one of above or null>", "confidence": "high"|"medium"|"low" },
    ...
  ]
}`;

export async function normalizeImport(
  headers: string[],
  opts: InvokeOptions = {},
): Promise<ImportMapping[]> {
  if (headers.length === 0) return [];
  const r = await invoke(
    "normalize_import",
    {
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify({ headers }) },
      ],
      jsonSchema: { type: "object" },
      temperature: 0,
      maxTokens: 800,
    },
    opts,
  );
  let raw: unknown = r.json;
  if (!raw) {
    try {
      raw = JSON.parse(r.text);
    } catch {
      return headers.map((h) => ({ source_header: h, target_field: null, confidence: "low" }));
    }
  }
  const wrap = raw as { mappings?: ImportMapping[] };
  if (!Array.isArray(wrap.mappings)) {
    return headers.map((h) => ({ source_header: h, target_field: null, confidence: "low" }));
  }
  return wrap.mappings;
}
