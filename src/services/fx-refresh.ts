/**
 * fx-refresh.ts — auto-refresh KES exchange rates once a day.
 *
 * Uses open.er-api.com (free, no key, HTTPS). Fetch base=KES; server returns
 * KES→X rates for every supported currency. We store those pairs into
 * exchange_rates with source='auto'.
 *
 * Offline-safe: aborts if navigator.onLine is false. Uses a 5s fetch timeout
 * so a hung network doesn't stall the background loop.
 *
 * Rate limit: only fires once every 20h, tracked in the settings table under
 * 'fx.last_refresh_at'. On boot, if last-refresh is older than 20h we try.
 */
import { query, execute } from "@/lib/db";
import { setRate, listCurrencies } from "@/services/currencies";

const FX_ENDPOINT = "https://open.er-api.com/v6/latest";
const LAST_REFRESH_KEY = "fx.last_refresh_at";
const REFRESH_INTERVAL_MS = 20 * 60 * 60 * 1000; // 20 hours

interface OpenErApiResponse {
  result: string;
  base_code: string;
  time_last_update_unix: number;
  rates: Record<string, number>;
}

async function fetchWithTimeout(url: string, ms = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function isDue(): Promise<boolean> {
  const rows = await query<{ value: string }>(
    `SELECT value FROM settings WHERE key = ?1 LIMIT 1`,
    [LAST_REFRESH_KEY],
  );
  const last = rows[0]?.value;
  if (!last) return true;
  const lastMs = Date.parse(last);
  if (Number.isNaN(lastMs)) return true;
  return Date.now() - lastMs > REFRESH_INTERVAL_MS;
}

async function markRefreshed(): Promise<void> {
  await execute(
    `INSERT INTO settings (key, value) VALUES (?1, ?2)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [LAST_REFRESH_KEY, new Date().toISOString()],
  );
}

/**
 * Try to refresh FX rates from a public source. Silent on failure — this is
 * a nice-to-have; the app's manual entry path always works.
 *
 * Returns the number of pairs written, or 0 when skipped/failed.
 */
export async function refreshFxRates(opts: { force?: boolean } = {}): Promise<number> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;
  if (!opts.force && !(await isDue())) return 0;

  try {
    const res = await fetchWithTimeout(`${FX_ENDPOINT}/KES`, 6000);
    if (!res.ok) return 0;
    const data = (await res.json()) as OpenErApiResponse;
    if (data.result !== "success" || !data.rates) return 0;

    // Only pull rates for currencies the user has enabled — no point saving
    // 160 pairs when the user only cares about USD/EUR/UGX.
    const enabled = await listCurrencies(true);
    if (enabled.length <= 1) {
      // Only KES enabled → nothing to fetch.
      await markRefreshed();
      return 0;
    }

    const asOf = new Date(data.time_last_update_unix * 1000).toISOString().slice(0, 10);
    let written = 0;
    for (const c of enabled) {
      if (c.code === "KES") continue;
      const rate = data.rates[c.code];
      if (typeof rate !== "number" || rate <= 0) continue;
      // KES → foreign at this rate; and foreign → KES as inverse
      await setRate("KES", c.code, rate, asOf, "auto");
      await setRate(c.code, "KES", 1 / rate, asOf, "auto");
      written += 2;
    }

    await markRefreshed();
    console.info(`[fx] refreshed ${written} rate pairs`);
    return written;
  } catch (e) {
    console.warn("[fx] refresh failed:", e);
    return 0;
  }
}
