/**
 * use-background-jobs.ts — periodic automations that were previously
 * only triggered by user action or not at all. These fill gaps that
 * the offline-first Kenyan-pharmacy design requires.
 *
 *   • eTIMS retry     — every ~2min while online. If a sale was made
 *                       offline and queued for KRA signing, this loop
 *                       gets it signed the moment connectivity returns.
 *                       Previously required a user to open /etims-queue
 *                       and click Retry.
 *
 *   • Depreciation    — checked twice a day, idempotent. When today is
 *                       past the 1st of the month and last-posted period
 *                       != the previous month, runMonthlyDepreciation()
 *                       posts entries for every active fixed asset for
 *                       the completed month. Idempotent per (asset, period).
 *                       Previously required a manual button.
 *
 * Everything is offline-safe: eTIMS is skipped when navigator.onLine is
 * false; depreciation is a pure DB write. All failures log a console.warn
 * and stay silent — never surfaced to the till.
 *
 * Wired from src/App.tsx alongside the other hook-based automations.
 */
import { useEffect } from "react";

const ETIMS_RETRY_INTERVAL_MS = 2 * 60 * 1000;    // 2 min
const DEPR_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 h — twice a day

const LAST_DEPRECIATION_KEY = "depreciation.last_posted_period";

async function tryEtimsRetry(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  try {
    const { retryQueuedInvoices } = await import("@/services/etims");
    await retryQueuedInvoices();
  } catch (e) {
    console.warn("[background] etims retry failed:", e);
  }
}

async function tryDepreciationPost(): Promise<void> {
  try {
    const [{ query, execute }, { runMonthlyDepreciation }] = await Promise.all([
      import("@/lib/db"),
      import("@/services/fixed-assets"),
    ]);
    const rows = await query<{ value: string }>(
      `SELECT value FROM settings WHERE key = ?1 LIMIT 1`,
      [LAST_DEPRECIATION_KEY],
    );
    const last = rows[0]?.value || "";
    // The period we're posting for is the *previous* calendar month.
    const now = new Date();
    const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const m = now.getMonth() === 0 ? 12 : now.getMonth();
    const period = `${y}-${String(m).padStart(2, "0")}`;
    if (last === period) return;
    const posted = await runMonthlyDepreciation(period);
    await execute(
      `INSERT INTO settings (key, value) VALUES (?1, ?2)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [LAST_DEPRECIATION_KEY, period],
    );
    if (posted > 0) {
      console.info(`[background] posted ${posted} depreciation entries for ${period}`);
    }
  } catch (e) {
    console.warn("[background] depreciation post failed:", e);
  }
}

export function useBackgroundJobs(): void {
  useEffect(() => {
    let cancelled = false;

    // eTIMS retry — first attempt 30s after boot, then every 2min.
    const etimsBoot = setTimeout(() => { if (!cancelled) tryEtimsRetry(); }, 30_000);
    const etimsInterval = setInterval(() => { if (!cancelled) tryEtimsRetry(); }, ETIMS_RETRY_INTERVAL_MS);

    // Depreciation — first attempt 90s after boot, then every 12h.
    const deprBoot = setTimeout(() => { if (!cancelled) tryDepreciationPost(); }, 90_000);
    const deprInterval = setInterval(() => { if (!cancelled) tryDepreciationPost(); }, DEPR_CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(etimsBoot);
      clearInterval(etimsInterval);
      clearTimeout(deprBoot);
      clearInterval(deprInterval);
    };
  }, []);
}
