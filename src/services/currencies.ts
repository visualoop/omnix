/**
 * Multi-currency support.
 *
 * Base currency = KES. Every money field defaults to KES; opting-in on an
 * invoice / expense / etc. means storing (amount, currency, fx_rate_at_capture).
 * Reports convert everything back to KES using the recorded fx_rate.
 *
 * Rate source: 'manual' (owner types it) or 'cbk' (CBK daily rate, fetched
 * by a scheduled task — not yet wired). Historic rates persist so reports
 * can recompute a period even if today's rate changes.
 */
import { execute, query } from "@/lib/db";

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  active: number;
}

export interface ExchangeRate {
  id: string;
  from_code: string;
  to_code: string;
  rate: number;
  as_of_date: string;
  source: string | null;
}

function newId(): string { return crypto.randomUUID().replace(/-/g, "").slice(0, 16); }

export async function listCurrencies(activeOnly = true): Promise<Currency[]> {
  return query<Currency>(
    `SELECT code, name, symbol, decimals, active FROM currencies ${activeOnly ? "WHERE active = 1" : ""} ORDER BY code`,
  );
}

/**
 * Set today's exchange rate (or a specific date). If rate is 1 for from == to,
 * we ignore. Upserts on (from, to, as_of_date).
 */
export async function setRate(fromCode: string, toCode: string, rate: number, asOfDate?: string, source = "manual"): Promise<void> {
  if (fromCode === toCode) return;
  const date = asOfDate ?? new Date().toISOString().slice(0, 10);
  await execute(
    `INSERT INTO exchange_rates (id, from_code, to_code, rate, as_of_date, source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT(from_code, to_code, as_of_date) DO UPDATE
       SET rate = excluded.rate, source = excluded.source`,
    [newId(), fromCode, toCode, rate, date, source],
  );
}

/**
 * Get the most recent rate ≤ asOfDate for from → to. Returns null if none.
 * Symmetric: if only the inverse pair exists, returns 1 / that rate.
 */
export async function getRate(fromCode: string, toCode: string, asOfDate?: string): Promise<number | null> {
  if (fromCode === toCode) return 1;
  const date = asOfDate ?? new Date().toISOString().slice(0, 10);

  const [direct] = await query<{ rate: number }>(
    `SELECT rate FROM exchange_rates WHERE from_code = ?1 AND to_code = ?2 AND as_of_date <= ?3
     ORDER BY as_of_date DESC LIMIT 1`,
    [fromCode, toCode, date],
  );
  if (direct) return direct.rate;

  const [inverse] = await query<{ rate: number }>(
    `SELECT rate FROM exchange_rates WHERE from_code = ?2 AND to_code = ?1 AND as_of_date <= ?3
     ORDER BY as_of_date DESC LIMIT 1`,
    [fromCode, toCode, date],
  );
  if (inverse && inverse.rate > 0) return 1 / inverse.rate;

  return null;
}

/**
 * Convert amount from fromCode to toCode. Throws if no rate exists.
 */
export async function convert(amount: number, fromCode: string, toCode: string, asOfDate?: string): Promise<number> {
  const rate = await getRate(fromCode, toCode, asOfDate);
  if (rate === null) {
    throw new Error(`No exchange rate for ${fromCode} → ${toCode} on ${asOfDate ?? "today"}`);
  }
  return amount * rate;
}

export async function listRates(fromCode?: string, toCode?: string): Promise<ExchangeRate[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let i = 0;
  if (fromCode) { clauses.push(`from_code = ?${++i}`); params.push(fromCode); }
  if (toCode) { clauses.push(`to_code = ?${++i}`); params.push(toCode); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return query<ExchangeRate>(
    `SELECT * FROM exchange_rates ${where} ORDER BY as_of_date DESC LIMIT 500`,
    params,
  );
}

export async function toggleActive(code: string, active: boolean): Promise<void> {
  await execute(`UPDATE currencies SET active = ?2 WHERE code = ?1`, [code, active ? 1 : 0]);
}
