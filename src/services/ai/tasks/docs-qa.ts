/**
 * Answer a user question about how to use Omnix, with the current page's
 * context as a hint. We pass the page route + a hand-curated topic outline,
 * not the full docs corpus — keeps prompts cheap and free-tier-friendly.
 *
 * For now this is "few-shot Q&A" rather than full RAG; we can layer in
 * embedding-based retrieval over /docs in v0.3.1 once the basic flow is
 * validated.
 */
import { invoke } from "../router";
import type { InvokeOptions } from "../types";

export interface DocsAnswer {
  /** 1-3 paragraph answer, plain text, max ~600 chars. */
  answer: string;
  /** Suggested next steps the user can click — page paths or shortcut hints. */
  suggestions: Array<{ label: string; route?: string; shortcut?: string }>;
  /** Confidence — "low" prompts the user to consult /docs directly. */
  confidence: "high" | "medium" | "low";
}

// Concise outline of where things live in Omnix — fits in a free-tier prompt.
const OUTLINE = `Omnix is a Tauri desktop ERP for Kenyan SMEs. Modules:
  - Core (always on): POS (/pos), inventory (/inventory), sales history (/sales-history),
    customers (/customers), suppliers (/suppliers), purchase orders (/purchase-orders),
    accounting (/expenses, /pnl, /banking), KRA eTIMS (/etims-queue, /etims-settings),
    reports (/reports, /vat-report, /zreport, /daily-operations).
  - Dawa (Pharmacy): /pharmacy, /doctors, /patient-profile, /controlled-register, /cold-chain, /amr-report.
  - Hospitality: /hospitality (orders, kitchen, menu, recipes, rooms, folios).
  - Hardware: /hardware (quotes, delivery notes, contractor accounts).
  - Retail extensions: /retail-laybys, /retail-special-orders, /retail-shrinkage, /retail-brands.

Common shortcuts: Ctrl+K command palette, F1 help, F8 Z-report, Ctrl+S save.

Settings live under /settings (general, hardware, taxes, roles, customer-display,
hospitality, payments, network, license, branches, employees, eTIMS, insurance).

Cloud backup: /cloud-backup. Local backup: /backup. Setup: /setup.`;

const SYSTEM = `You are the in-app help assistant for Omnix. Use the outline below to point users
to the right page or shortcut. Never invent menu items. Keep answers under 3 short paragraphs.

If unsure, say so honestly and suggest the user open /docs.

Outline:
${OUTLINE}

Return JSON:
{
  "answer": "plain text",
  "suggestions": [{ "label": "...", "route": "/pos" } | { "label": "...", "shortcut": "Ctrl+K" }, ...],
  "confidence": "high" | "medium" | "low"
}`;

export async function docsQa(
  question: string,
  context: { route?: string } = {},
  opts: InvokeOptions = {},
): Promise<DocsAnswer> {
  const userMsg = context.route
    ? `[user is on ${context.route}]\n${question}`
    : question;
  const r = await invoke(
    "docs_qa",
    {
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userMsg },
      ],
      jsonSchema: { type: "object" },
      temperature: 0.3,
      maxTokens: 500,
    },
    opts,
  );
  let raw: unknown = r.json;
  if (!raw) {
    try { raw = JSON.parse(r.text); } catch { raw = null; }
  }
  if (!raw || typeof raw !== "object") {
    return {
      answer: r.text || "Sorry, I couldn't generate an answer. Try opening the docs at /docs.",
      suggestions: [{ label: "Open docs", route: "/docs" }],
      confidence: "low",
    };
  }
  return raw as DocsAnswer;
}
