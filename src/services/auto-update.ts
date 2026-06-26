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
