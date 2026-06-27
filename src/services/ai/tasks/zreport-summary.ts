/**
 * Z-report summary — turn end-of-day numbers into a short, plain-language
 * shift summary the owner can read at a glance (and the manager can paste
 * into a WhatsApp group). The numbers are computed deterministically by the
 * Z-report; the LLM only narrates them.
 */
import { invoke } from "../router";
import type { InvokeOptions } from "../types";

export interface ZReportFacts {
  date: string;
  total_sales: number;
  transaction_count: number;
  cash: number;
  mpesa: number;
  card: number;
  other: number;
  refunds: number;
  expected_drawer: number;
  counted_drawer?: number;
  variance?: number;
  top_products?: Array<{ name: string; qty: number }>;
}

const SYSTEM = `You write a concise end-of-day shift summary for a Kenyan SME owner from the
Z-report figures provided. 3-4 sentences max, plain English (a little Swahili is fine).
Lead with the headline (total + transactions), call out the payment mix, and flag anything
that needs attention (cash variance, high refunds, a standout product). Don't list every
number — interpret. No greeting, no sign-off.`;

export async function summarizeZReport(facts: ZReportFacts, opts: InvokeOptions = {}): Promise<string> {
  const r = await invoke(
    "zreport_summary",
    {
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify(facts) },
      ],
      temperature: 0.4,
      maxTokens: 250,
    },
    opts,
  );
  return r.text.trim();
}
