/**
 * Database maintenance — keeps the app fast after years of accumulation.
 *
 * Runs on a throttled schedule (once per ~20h, tracked in settings) from
 * an idle hook after boot. Everything here is best-effort and chunked so
 * it never blocks the till.
 *
 * Three jobs:
 *   1. rollUpSales()  — refresh the sales_daily summary for recent days
 *                       so "all-time"/"this year" reports read a few
 *                       hundred pre-aggregated rows instead of scanning
 *                       millions of sale_items. Raw sales are NEVER
 *                       deleted (legal/compliance records).
 *   2. pruneChurn()   — rolling-window delete of genuinely disposable
 *                       logs (AI call logs, resolved STK polls). Keeps
 *                       these from growing unbounded. Audit log, sales,
 *                       eTIMS, stock movements are KEPT (compliance).
 *   3. optimize()     — PRAGMA optimize + incremental_vacuum to refresh
 *                       planner stats and reclaim freed pages.
 */
import { query, execute } from "@/lib/db";

const LAST_RUN_KEY = "maintenance.last_run";
const MIN_INTERVAL_MS = 20 * 60 * 60 * 1000; // ~daily
const AI_CALL_LOG_RETENTION_DAYS = 90;

async function getSetting(key: string): Promise<string | null> {
  try {
    const rows = await query<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?1",
      [key],
    );
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

async function setSetting(key: string, value: string): Promise<void> {
  await execute(
    `INSERT INTO settings (key, value) VALUES (?1, ?2)
     ON CONFLICT(key) DO UPDATE SET value = ?2`,
    [key, value],
  ).catch(() => {});
}

/**
 * Refresh the daily rollup for the last `days` days. Idempotent — it
 * recomputes each day from the raw sales so a late void/refund is
 * reflected. Cheap because it only touches recent rows (indexed by
 * created_at).
 */
export async function rollUpSales(days = 7): Promise<void> {
  // Upsert one summary row per day over the recent window.
  await execute(
    `INSERT INTO sales_daily (day, sales_count, gross, discount, tax, items_count, updated_at)
     SELECT
       date(s.created_at)                                   AS day,
       COUNT(DISTINCT s.id)                                 AS sales_count,
       COALESCE(SUM(s.total), 0)                            AS gross,
       COALESCE(SUM(s.discount_amount), 0)                  AS discount,
       COALESCE(SUM(s.tax_amount), 0)                       AS tax,
       COALESCE((SELECT COUNT(*) FROM sale_items si
                 JOIN sales s2 ON s2.id = si.sale_id
                 WHERE date(s2.created_at) = date(s.created_at)
                   AND s2.status = 'completed'), 0)         AS items_count,
       datetime('now')                                      AS updated_at
     FROM sales s
     WHERE s.status = 'completed'
       AND s.created_at >= datetime('now', ?1)
     GROUP BY date(s.created_at)
     ON CONFLICT(day) DO UPDATE SET
       sales_count = excluded.sales_count,
       gross       = excluded.gross,
       discount    = excluded.discount,
       tax         = excluded.tax,
       items_count = excluded.items_count,
       updated_at  = excluded.updated_at`,
    [`-${days} days`],
  ).catch(() => {
    // sales_daily may not exist on a DB that hasn't migrated yet — skip.
  });
}

/** Rolling-window prune of disposable logs only. */
export async function pruneChurn(): Promise<void> {
  // AI call logs older than the retention window — pure telemetry, safe.
  await execute(
    `DELETE FROM ai_calls WHERE created_at < datetime('now', ?1)`,
    [`-${AI_CALL_LOG_RETENTION_DAYS} days`],
  ).catch(() => {});
}

/** Refresh planner stats + reclaim freed pages. */
export async function optimizeDb(): Promise<void> {
  await execute("PRAGMA optimize;").catch(() => {});
  // Reclaim up to 1000 freed pages without a full-lock VACUUM.
  await execute("PRAGMA incremental_vacuum(1000);").catch(() => {});
}

/**
 * Run all maintenance if it hasn't run recently. Call from an idle hook.
 * Throttled via settings so it's once-a-day even across many launches.
 */
export async function runMaintenanceIfDue(): Promise<void> {
  const last = await getSetting(LAST_RUN_KEY);
  if (last) {
    const elapsed = Date.now() - new Date(last).getTime();
    if (Number.isFinite(elapsed) && elapsed < MIN_INTERVAL_MS) return;
  }
  await rollUpSales(7);
  await pruneChurn();
  await optimizeDb();
  await setSetting(LAST_RUN_KEY, new Date().toISOString());
}
