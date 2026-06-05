/**
 * Translate a KRA eTIMS error into plain English with a suggested fix.
 *
 * Inputs are inherently low-sensitivity (just a code + message). The
 * audience is the cashier or business owner, not a technician.
 */
import { invoke } from "../router";
import type { InvokeOptions } from "../types";

export interface EtimsExplanation {
  /** ≤80 chars; what went wrong, in everyday words. */
  summary: string;
  /** 2-4 bullet steps the user can follow. */
  steps: string[];
  /** Likely owner of the fix: "cashier" | "owner" | "kra_support" | "admin". */
  owner: "cashier" | "owner" | "kra_support" | "admin";
  /** "low" = retry; "medium" = something to fix; "high" = compliance issue. */
  severity: "low" | "medium" | "high";
}

const SYSTEM = `You are a KRA eTIMS support assistant. Given a Kenya KRA eTIMS / VSCU error code
and message, explain it for a non-technical Kenyan SME owner. Use simple English (Swahili
words OK if natural). Always return JSON with this exact schema:

{
  "summary": "≤80 chars, plain language",
  "steps": ["step 1", "step 2", ...],
  "owner": "cashier" | "owner" | "kra_support" | "admin",
  "severity": "low" | "medium" | "high"
}

Rules:
  - "low": transient (retry will work); 1-2 short steps.
  - "medium": user must do something (re-enter data, restart device); 2-4 steps.
  - "high": compliance/auth (control unit expired, PIN mismatch); 2-4 steps + "kra_support".`;

export async function explainEtims(
  code: string,
  message: string,
  opts: InvokeOptions = {},
): Promise<EtimsExplanation> {
  const r = await invoke(
    "explain_etims",
    {
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `code: ${code}\nmessage: ${message}` },
      ],
      jsonSchema: { type: "object" },
      temperature: 0.2,
      maxTokens: 400,
    },
    opts,
  );
  let raw: unknown = r.json;
  if (!raw) {
    try { raw = JSON.parse(r.text); } catch { raw = null; }
  }
  if (!raw || typeof raw !== "object") {
    return {
      summary: "Could not interpret the error automatically. Please retry, then contact KRA support if it persists.",
      steps: ["Try the action again in a minute.", "If it fails again, copy the error code and contact KRA support."],
      owner: "kra_support",
      severity: "medium",
    };
  }
  return raw as EtimsExplanation;
}
