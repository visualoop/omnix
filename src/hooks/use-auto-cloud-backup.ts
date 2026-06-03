/**
 * Auto cloud-backup scheduler.
 *
 * Strategy: while the owner is signed in AND the in-memory backup key is set,
 * a setInterval ticks every minute. On each tick it:
 *   1. Reads `cloud_backup_auto.enabled` + `interval_hours` from local settings
 *   2. Reads `cloud_backup_auto.last_run` timestamp
 *   3. If overdue (now - last_run >= interval_hours), invokes
 *      cloud_backup_auto_upload (uses the in-memory key — no password prompt)
 *   4. Persists the new last-run timestamp on success.
 *
 * Persists schedule prefs to the `settings` SQLite table (key/value).
 * Lives on the auth/owner shell so a non-owner login won't trigger uploads.
 */
import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { query, execute } from "@/lib/db";
import { useAuthStore } from "@/stores/auth";

const TICK_MS = 60_000; // check every minute
const SETTINGS_KEY_PREFIX = "cloud_backup_auto.";
const API_BASE = "https://omnix.co.ke";

interface ScheduleConfig {
  enabled: boolean;
  intervalHours: number;
  lastRun: number; // epoch ms; 0 = never
}

export async function getScheduleConfig(): Promise<ScheduleConfig> {
  const rows = await query<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key LIKE ?1`,
    [`${SETTINGS_KEY_PREFIX}%`],
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const intRaw = parseInt(map.get(`${SETTINGS_KEY_PREFIX}interval_hours`) ?? "24", 10);
  const lastRaw = parseInt(map.get(`${SETTINGS_KEY_PREFIX}last_run`) ?? "0", 10);
  return {
    enabled: map.get(`${SETTINGS_KEY_PREFIX}enabled`) === "1",
    intervalHours: Number.isFinite(intRaw) && intRaw > 0 ? intRaw : 24,
    lastRun: Number.isFinite(lastRaw) && lastRaw >= 0 ? lastRaw : 0,
  };
}

export async function setScheduleConfig(patch: Partial<ScheduleConfig>): Promise<void> {
  const writes: Array<[string, string]> = [];
  if (patch.enabled !== undefined) writes.push([`${SETTINGS_KEY_PREFIX}enabled`, patch.enabled ? "1" : "0"]);
  if (patch.intervalHours !== undefined) writes.push([`${SETTINGS_KEY_PREFIX}interval_hours`, String(patch.intervalHours)]);
  if (patch.lastRun !== undefined) writes.push([`${SETTINGS_KEY_PREFIX}last_run`, String(patch.lastRun)]);
  for (const [k, v] of writes) {
    await execute(
      `INSERT INTO settings(key, value, category, updated_at) VALUES(?1, ?2, 'cloud_backup', datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`,
      [k, v],
    );
  }
}

export function nextRunAt(cfg: ScheduleConfig): number {
  if (!cfg.enabled) return 0;
  const last = cfg.lastRun || Date.now() - cfg.intervalHours * 3600 * 1000; // first run "due now"
  return last + cfg.intervalHours * 3600 * 1000;
}

/**
 * Hook: runs the scheduler tick whenever the user is signed in.
 * Mount once near the app shell.
 */
export function useAutoCloudBackup() {
  const user = useAuthStore((s) => s.user);
  const running = useRef(false);

  useEffect(() => {
    if (!user || user.role !== "owner") return;

    let cancelled = false;

    const tick = async () => {
      if (running.current || cancelled) return;
      try {
        const cfg = await getScheduleConfig();
        if (!cfg.enabled) return;
        if (Date.now() < nextRunAt(cfg)) return;

        // Verify session key + auth token are present
        const hasKey = await invoke<boolean>("cloud_backup_has_session_key");
        if (!hasKey) return;
        const authToken = localStorage.getItem("omnix-machine-auth-token") ?? "";
        if (!authToken) return;

        running.current = true;
        try {
          await invoke("cloud_backup_auto_upload", {
            apiBase: API_BASE,
            authToken,
            desktopVersion: __APP_VERSION__,
          });
          await setScheduleConfig({ lastRun: Date.now() });
          // Quiet success — sonner toast for transparency without being noisy.
          import("sonner").then(({ toast }) =>
            toast.success("Cloud backup uploaded", { duration: 4000 }),
          );
        } catch (e) {
          // Loud failure — owner needs to know if backups are silently failing.
          const msg = String(e);
          import("sonner").then(({ toast }) => {
            if (msg.includes("no-key")) return; // benign — key just isn't loaded
            toast.error("Auto cloud-backup failed", {
              description: msg.includes("402")
                ? "Cloud backup not active on your licence."
                : msg.includes("403")
                  ? "Cloud backup is disabled site-wide."
                  : msg.slice(0, 120),
              duration: 8000,
            });
          });
          // eslint-disable-next-line no-console
          console.warn("auto-backup failed:", e);
        }
      } finally {
        running.current = false;
      }
    };

    // Run once on mount + on interval
    tick();
    const handle = setInterval(tick, TICK_MS);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [user]);
}

declare const __APP_VERSION__: string | undefined;
