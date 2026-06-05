/**
 * Setup-wizard assistant. Owner describes the business in 1-2 sentences;
 * we suggest sensible defaults: which module to enable, common products,
 * receipt language, tax setup. The user reviews before commit.
 */
import { invoke } from "../router";
import type { InvokeOptions } from "../types";

export interface SetupSuggestion {
  /** Module recommendations, ranked. */
  modules: Array<{ id: "dawa" | "hospitality" | "hardware" | "retail" | "core"; reason: string }>;
  /** Receipt / customer-display language hint. */
  receipt_language: "en" | "sw" | "mixed";
  /** Default tax setup. */
  tax_setup: { vat_rate: number; etims_required: boolean; reason: string };
  /** Up to 5 product / category seeds the user can accept to bootstrap. */
  starter_products: Array<{ name: string; category: string; unit: string }>;
  /** One-paragraph welcome message the wizard can show. */
  welcome_note: string;
}

const SYSTEM = `You are the Omnix setup assistant. Read a 1-3 sentence business description and
return JSON with module recommendations, language hint, tax setup, and 3-5 starter products.

Modules in Omnix:
  - dawa: pharmacy / chemist (controlled drugs, prescriptions, NHIF)
  - hospitality: restaurant, cafe, bar, hotel, lodge (kitchen tickets, recipes, rooms)
  - hardware: building materials, contractor accounts, quotes/delivery notes
  - retail: general retail with laybys, special orders, brands
  - core: just POS + basic inventory (default)

Tax: Kenyan VAT is 16% standard, 8% on fuel, 0% on basic foodstuffs and most medicines.
eTIMS is required for VAT-registered businesses; not required for non-registered or essentials-only.

Schema:
{
  "modules": [{ "id": "...", "reason": "..." }, ...],
  "receipt_language": "en" | "sw" | "mixed",
  "tax_setup": { "vat_rate": 16 | 8 | 0, "etims_required": true|false, "reason": "..." },
  "starter_products": [{ "name": "...", "category": "...", "unit": "..." }, ...],
  "welcome_note": "≤180 chars, friendly"
}`;

export async function setupAssist(
  description: string,
  opts: InvokeOptions = {},
): Promise<SetupSuggestion> {
  const r = await invoke(
    "setup_assist",
    {
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: description },
      ],
      jsonSchema: { type: "object" },
      temperature: 0.4,
      maxTokens: 600,
    },
    opts,
  );
  let raw: unknown = r.json;
  if (!raw) {
    try { raw = JSON.parse(r.text); } catch { raw = null; }
  }
  if (!raw || typeof raw !== "object") {
    return {
      modules: [{ id: "core", reason: "default" }],
      receipt_language: "en",
      tax_setup: { vat_rate: 16, etims_required: true, reason: "Standard VAT for KE" },
      starter_products: [],
      welcome_note: "Karibu Omnix! Configure your business below to get started.",
    };
  }
  return raw as SetupSuggestion;
}
