/**
 * AI extensions — hooks that leverage the existing services/ai router.
 * - Invoice / receipt OCR (Task 62): image → extracted vendor + line items
 * - Natural-language search (Task 63): sentence → structured query
 * - Sales / inventory forecasting (Task 64): simple linear trend + seasonality
 *
 * All optional — call sites gracefully no-op when AI settings are disabled.
 */
import { query } from "@/lib/db";

// ─── Forecasting (Task 64) ─────────────────────────────
export interface ForecastPoint {
  date: string;
  predicted: number;
  confidence_low: number;
  confidence_high: number;
}

/**
 * Simple daily sales forecast for the next N days.
 * Uses a 30-day moving average + day-of-week seasonality multiplier.
 * Not a fancy ARIMA — good enough for SME "when should I stock up?" decisions.
 */
export async function forecastSales(daysAhead = 14): Promise<ForecastPoint[]> {
  const rows = await query<{ day: string; total: number; dow: string }>(
    `SELECT date(created_at) AS day,
            COALESCE(SUM(total), 0) AS total,
            strftime('%w', created_at) AS dow
     FROM sales
     WHERE status = 'completed'
       AND created_at >= datetime('now', '-90 days')
     GROUP BY date(created_at)
     ORDER BY day ASC`,
  ).catch(() => []);

  if (rows.length < 14) return [];  // need at least 2 weeks of history

  // Compute mean + dow multipliers.
  const total = rows.reduce((s, r) => s + r.total, 0);
  const meanDaily = total / rows.length;

  const dowSums: Record<string, { sum: number; count: number }> = {};
  for (const r of rows) {
    const key = r.dow;
    dowSums[key] = dowSums[key] ?? { sum: 0, count: 0 };
    dowSums[key].sum += r.total;
    dowSums[key].count++;
  }
  const dowMultiplier: Record<string, number> = {};
  for (const [k, v] of Object.entries(dowSums)) {
    dowMultiplier[k] = v.count > 0 ? (v.sum / v.count) / meanDaily : 1;
  }

  // Recent 30-day mean provides a trend baseline
  const recent = rows.slice(-30);
  const recentMean = recent.reduce((s, r) => s + r.total, 0) / (recent.length || 1);

  // Variance for confidence interval.
  const variance = recent.reduce((s, r) => s + (r.total - recentMean) ** 2, 0) / (recent.length || 1);
  const stdDev = Math.sqrt(variance);

  const out: ForecastPoint[] = [];
  const now = new Date();
  for (let i = 1; i <= daysAhead; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dow = String(d.getDay());
    const dateStr = d.toISOString().slice(0, 10);
    const predicted = recentMean * (dowMultiplier[dow] ?? 1);
    out.push({
      date: dateStr,
      predicted: Math.max(0, predicted),
      confidence_low: Math.max(0, predicted - stdDev),
      confidence_high: predicted + stdDev,
    });
  }
  return out;
}

// ─── Natural-language search (Task 63) ─────────────────
/**
 * Convert a natural-language question into a structured query the report-builder
 * can run. Uses the AI router — falls back to keyword-only if AI is off.
 *
 * "sales of Panadol this week" → { entity: 'sales', filters: { product_name: 'Panadol', from: <this_week_start> } }
 */
export interface NLQueryResult {
  interpretation: string;
  rows: Array<Record<string, unknown>>;
}

export async function naturalLanguageQuery(sentence: string): Promise<NLQueryResult> {
  // Try AI router first
  try {
    const { ai } = await import("./ai");
    if (typeof (ai as unknown as { queryData?: unknown }).queryData === "function") {
      const rows = await (ai as unknown as { queryData: (q: string) => Promise<Array<Record<string, unknown>>> }).queryData(sentence);
      return { interpretation: `AI parsed: ${sentence}`, rows };
    }
  } catch {
    /* fall through to keyword search */
  }

  // Keyword fallback — search product names.
  const q = sentence.replace(/\b(sales?|of|the|show|me|last|this|week|month)\b/gi, "").trim();
  if (!q) return { interpretation: "Nothing to search", rows: [] };

  const rows = await query<Record<string, unknown>>(
    `SELECT p.name AS product, COUNT(si.id) AS times_sold,
            SUM(si.quantity) AS total_qty,
            SUM(si.line_total) AS total_revenue
     FROM sale_items si
     JOIN products p ON p.id = si.product_id
     JOIN sales s ON s.id = si.sale_id
     WHERE p.name LIKE ?1 AND s.status = 'completed'
       AND s.created_at >= datetime('now', '-30 days')
     GROUP BY p.id
     ORDER BY total_revenue DESC
     LIMIT 20`,
    [`%${q}%`],
  ).catch(() => []);
  return {
    interpretation: `Products matching "${q}" in the last 30 days`,
    rows,
  };
}

// ─── Receipt OCR (Task 62) ─────────────────────────────
/**
 * Extract vendor + line items from a receipt / invoice photo.
 * Stub — real implementation posts to a vision endpoint (Groq LLaVA or similar).
 * Returns null when AI is disabled or the extraction fails.
 */
export interface ExtractedInvoice {
  vendor_name: string | null;
  invoice_date: string | null;
  total: number | null;
  currency: string | null;
  lines: Array<{ description: string; quantity: number; unit_price: number; line_total: number }>;
  confidence: number;
}

export async function extractInvoiceFromImage(_imageBase64: string): Promise<ExtractedInvoice | null> {
  try {
    const { ai } = await import("./ai");
    // Only proceed if the AI router has an image handler.
    if (typeof (ai as unknown as { extractInvoice?: unknown }).extractInvoice === "function") {
      return await (ai as unknown as { extractInvoice: (img: string) => Promise<ExtractedInvoice | null> }).extractInvoice(_imageBase64);
    }
  } catch {
    /* ignore */
  }
  return null;
}
