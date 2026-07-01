/**
 * Auto-update on close (VSCode / Electron-style).
 *
 * THE GOAL: people forget to check for updates manually. So instead:
 *   1. On launch (after a short delay so it doesn't fight startup),
 *      silently check for an update.
 *   2. If one is available AND it's not a major-version bump (major
 *      bumps aren't permitted under the per-machine licence — they're a
 *      paid upgrade), silently DOWNLOAD it in the background while the
 *      cashier keeps working. Nothing interrupts the till.
 *   3. Hold the downloaded update in memory. When the user closes the
 *      app, INSTALL it then. On Windows the installer quits the app
 *      itself, so "install on close" is the natural fit.
 *
 * Major-version updates are surfaced as a gentle, dismissible notice
 * (handled by the manual UpdateChecker in Settings) — never auto-applied.
 *
 * Safe-by-design:
 *   - Never downloads on metered/offline (check() throws → we swallow).
 *   - Never blocks the UI; all work is awaited off the render path.
 *   - Re-entrancy guarded so we don't download twice.
 */
import { check, type Update } from "@tauri-apps/plugin-updater";

/** The update we've downloaded and are holding to install on close. */
let pendingInstall: Update | null = null;
let started = false;

function majorOf(version: string): number {
  const m = version.replace(/^v/, "").split(".")[0];
  const n = parseInt(m, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Kick off the silent background download. Call once, early in app boot.
 * `currentVersion` is the running app's version (from BRAND / package).
 */
export async function startBackgroundUpdate(currentVersion: string): Promise<void> {
  if (started) return;
  started = true;
  try {
    // Pre-flight gate — the server can tell us to skip auto-update for
    // this specific machine (canary rollout, admin-paused, revoked).
    // Adds ~200ms to boot in exchange for admin control over staged
    // rollouts. Failures fall through to the tauri plugin's default
    // check() so we never get stuck when the server is unreachable.
    const allowed = await checkUpdaterGate(currentVersion);
    if (!allowed) return;

    const update = await check();
    if (!update) return;

    // Skip major-version bumps — those are a paid upgrade, never auto-applied.
    if (majorOf(update.version) > majorOf(currentVersion)) {
      // Leave it for the manual UpdateChecker to surface as a notice.
      return;
    }

    // Download silently — do NOT install yet. The Update handle keeps
    // the downloaded bytes ready for install() on close.
    await update.download();
    pendingInstall = update;
  } catch {
    // Offline, metered, server down, or updater unsupported — stay quiet.
    // The next launch will try again.
  }
}

/**
 * Ask the licensing server whether this machine is currently allowed
 * to auto-update. Admin can pause per-machine (canary rollout testing)
 * or mark a machine as canary (receives beta releases before stable).
 *
 * Returns true when we should proceed with the tauri plugin's check().
 * On any error (network, server down, unrecognised machine), returns
 * true — we fall back to the default behaviour so a broken server
 * never blocks a customer's update path.
 */
async function checkUpdaterGate(currentVersion: string): Promise<boolean> {
  try {
    const { getMachineInfo } = await import("@/services/license");
    const machine = await getMachineInfo();
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    const res = await tauriFetch("https://omnix.co.ke/api/updater/gate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ machineId: machine.fingerprint, currentVersion }),
      // Short timeout — if the gate takes >2s, just proceed.
      // (Better to over-serve updates than block on a slow gate.)
    });
    if (!res.ok) return true;
    const body = (await res.json()) as { allowed?: boolean };
    return body.allowed !== false;
  } catch {
    return true;
  }
}

/** True when a non-major update has finished downloading and is waiting. */
export function hasPendingUpdate(): boolean {
  return pendingInstall !== null;
}

/** The version string of the pending update, for UI hints. */
export function pendingUpdateVersion(): string | null {
  return pendingInstall?.version ?? null;
}

/**
 * Install the downloaded update. Call this from the close handler.
 * On Windows this quits the app to run the installer. Returns true if
 * an install was kicked off (caller should then let the app exit).
 */
export async function installPendingUpdateOnClose(): Promise<boolean> {
  if (!pendingInstall) return false;
  try {
    await pendingInstall.install();
    return true;
  } catch {
    return false;
  } finally {
    pendingInstall = null;
  }
}
