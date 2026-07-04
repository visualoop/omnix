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

async function tryFxRefresh(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  try {
    const { refreshFxRates } = await import("@/services/fx-refresh");
    await refreshFxRates();
  } catch (e) {
    console.warn("[background] fx refresh failed:", e);
  }
}

async function tryShaClaimFlush(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  try {
    const { flushShaClaimQueue } = await import("@/services/insurance");
    const summary = await flushShaClaimQueue();
    if (summary.submitted > 0) {
      console.info(`[background] flushed ${summary.submitted} SHA claims`);
    }
  } catch (e) {
    console.warn("[background] sha claim flush failed:", e);
  }
}

async function tryRefillReminders(): Promise<void> {
  try {
    const { queueRefillReminders } = await import("@/services/refill-reminders");
    const summary = await queueRefillReminders(3);
    if (summary.queued > 0) {
      console.info(`[background] queued ${summary.queued} refill reminders`);
    }
  } catch (e) {
    console.warn("[background] refill reminders failed:", e);
  }
}

async function tryPpbAutoSubmit(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  try {
    const { runPpbAutoSubmission } = await import("@/services/ppb-submissions");
    await runPpbAutoSubmission();
  } catch (e) {
    console.warn("[background] ppb auto-submit failed:", e);
  }
}

async function tryLaybyExpiry(): Promise<void> {
  try {
    const { expireOverdueLaybys } = await import("@/services/retail");
    const n = await expireOverdueLaybys();
    if (n > 0) console.info(`[background] expired ${n} overdue laybys`);
  } catch (e) {
    console.warn("[background] layby expiry failed:", e);
  }
}

async function tryLoyaltyExpiry(): Promise<void> {
  try {
    const { expireLoyaltyPoints } = await import("@/services/loyalty");
    const n = await expireLoyaltyPoints();
    if (n > 0) console.info(`[background] expired loyalty points for ${n} customers`);
  } catch (e) {
    console.warn("[background] loyalty expiry failed:", e);
  }
}

async function tryRetailNotifications(): Promise<void> {
  try {
    const { queueRetailNotifications } = await import("@/services/retail-notifications");
    const r = await queueRetailNotifications();
    if (r.layby + r.specialOrder > 0) console.info(`[background] queued ${r.layby} layby + ${r.specialOrder} special-order notifications`);
  } catch (e) {
    console.warn("[background] retail notifications failed:", e);
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

    // FX refresh — first attempt 120s after boot, then every 12h. Silent-fail
    // when offline. The service itself rate-limits to once every 20h.
    const fxBoot = setTimeout(() => { if (!cancelled) tryFxRefresh(); }, 120_000);
    const fxInterval = setInterval(() => { if (!cancelled) tryFxRefresh(); }, DEPR_CHECK_INTERVAL_MS);

    // SHA claim queue flush — 150s after boot, then every 15 min. Retries
    // any claim whose backoff window has elapsed. Offline-safe.
    const shaBoot = setTimeout(() => { if (!cancelled) tryShaClaimFlush(); }, 150_000);
    const shaInterval = setInterval(() => { if (!cancelled) tryShaClaimFlush(); }, 15 * 60 * 1000);

    // Refill reminders — 180s after boot, then every 12h. Stages SMS
    // reminders for prescriptions due within 3 days.
    const refillBoot = setTimeout(() => { if (!cancelled) tryRefillReminders(); }, 180_000);
    const refillInterval = setInterval(() => { if (!cancelled) tryRefillReminders(); }, DEPR_CHECK_INTERVAL_MS);

    // PPB auto-submit — 240s after boot, then every 12h. Assembles +
    // submits the prior quarter's return once we're past the configured
    // auto_submit_day. Idempotent per period. No-op when disabled.
    const ppbBoot = setTimeout(() => { if (!cancelled) tryPpbAutoSubmit(); }, 240_000);
    const ppbInterval = setInterval(() => { if (!cancelled) tryPpbAutoSubmit(); }, DEPR_CHECK_INTERVAL_MS);

    // Layby expiry — 200s after boot, then every 12h. Flags active laybys
    // past their expiry date (moved out of the listLaybys read path).
    const laybyBoot = setTimeout(() => { if (!cancelled) tryLaybyExpiry(); }, 200_000);
    const laybyInterval = setInterval(() => { if (!cancelled) tryLaybyExpiry(); }, DEPR_CHECK_INTERVAL_MS);

    // Loyalty points expiry — 220s after boot, then every 12h.
    const loyBoot = setTimeout(() => { if (!cancelled) tryLoyaltyExpiry(); }, 220_000);
    const loyInterval = setInterval(() => { if (!cancelled) tryLoyaltyExpiry(); }, DEPR_CHECK_INTERVAL_MS);

    // Retail customer notifications — 260s after boot, then every 12h.
    const rnBoot = setTimeout(() => { if (!cancelled) tryRetailNotifications(); }, 260_000);
    const rnInterval = setInterval(() => { if (!cancelled) tryRetailNotifications(); }, DEPR_CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(etimsBoot);
      clearInterval(etimsInterval);
      clearTimeout(deprBoot);
      clearInterval(deprInterval);
      clearTimeout(fxBoot);
      clearInterval(fxInterval);
      clearTimeout(shaBoot);
      clearInterval(shaInterval);
      clearTimeout(refillBoot);
      clearInterval(refillInterval);
      clearTimeout(ppbBoot);
      clearInterval(ppbInterval);
      clearTimeout(laybyBoot);
      clearInterval(laybyInterval);
      clearTimeout(loyBoot);
      clearInterval(loyInterval);
      clearTimeout(rnBoot);
      clearInterval(rnInterval);
    };
  }, []);
}
