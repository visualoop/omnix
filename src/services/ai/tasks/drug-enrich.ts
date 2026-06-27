/**
 * Drug enrichment — given a medicine product name, suggest the pharmacology
 * fields a Kenyan pharmacist needs: active ingredient, dosage form, strength,
 * drug schedule (PPB), and a typical adult dosage note. Conservative: returns
 * null for anything it isn't sure of. The pharmacist always reviews before
 * saving (human-in-the-loop via AiSuggestionDialog).
 */
import { invoke } from "../router";
import type { InvokeOptions } from "../types";

export interface DrugEnrichResult {
  active_ingredient: string | null;
  dosage_form: string | null;       // tablet, syrup, injection, cream…
  strength: string | null;          // e.g. "500mg", "250mg/5ml"
  drug_schedule: string | null;     // POM, P, GSL, controlled — Kenya PPB-style
  typical_adult_dose: string | null;
  notes: string | null;
  confidence: "high" | "medium" | "low";
}

const SYSTEM = `You are a pharmacy cataloguing assistant for a Kenyan chemist (PPB context).
Given a medicine product name, return STRICT JSON. Be conservative — null any field you're
not confident about; never guess a schedule or dose. This is decision SUPPORT for a
pharmacist who will verify everything, not medical advice.

Schema:
{
  "active_ingredient": string | null,
  "dosage_form": string | null,
  "strength": string | null,
  "drug_schedule": string | null,
  "typical_adult_dose": string | null,
  "notes": string | null,
  "confidence": "high" | "medium" | "low"
}`;

export async function enrichDrug(name: string, opts: InvokeOptions = {}): Promise<DrugEnrichResult> {
  const r = await invoke(
    "drug_enrich",
    {
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: name },
      ],
      jsonSchema: { type: "object" },
      temperature: 0.1,
      maxTokens: 350,
    },
    opts,
  );
  let raw: unknown = r.json;
  if (!raw) { try { raw = JSON.parse(r.text); } catch { raw = null; } }
  if (!raw || typeof raw !== "object") {
    return {
      active_ingredient: null, dosage_form: null, strength: null, drug_schedule: null,
      typical_adult_dose: null, notes: "Could not enrich automatically — please fill manually.",
      confidence: "low",
    };
  }
  return raw as DrugEnrichResult;
}
