/**
 * Version-aware cache bust.
 *
 * Tauri's WebView2 caches HTML / JS aggressively. When the auto-updater
 * swaps the binary, the webview can keep serving the old assets until
 * a full Windows restart. This forces a one-time refresh after every
 * upgrade so users see the new UI immediately.
 *
 * Approach:
 *   1. On app mount, compare the in-memory __APP_VERSION__ (defined at
 *      compile time via vite.config.ts) against the version we last
 *      noted in localStorage.
 *   2. If they differ, the user just upgraded. Clear caches and reload.
 *   3. Update the stored version so the check is one-shot per upgrade.
 *
 * The reload is safe — Vite's content-hashed asset names mean the
 * fresh fetch always pulls the new bundle. Without this, customers
 * reported 'I downloaded the new version but nothing changed' after
 * auto-updates.
 */

const STORAGE_KEY = "omnix:installed-version";

// __APP_VERSION__ is wired by vite's `define` in vite.config.ts.
declare const __APP_VERSION__: string;

export async function bustOnVersionChange(): Promise<void> {
  if (typeof window === "undefined") return;
  let storedVersion: string | null = null;
  try {
    storedVersion = localStorage.getItem(STORAGE_KEY);
  } catch {
    return; // localStorage disabled — nothing to do
  }

  const currentVersion = (typeof __APP_VERSION__ !== "undefined" && __APP_VERSION__) || "0.0.0";

  if (storedVersion === currentVersion) return; // no change

  // Update marker first so a reload doesn't loop.
  try {
    localStorage.setItem(STORAGE_KEY, currentVersion);
  } catch {
    // ignore
  }

  // Skip cache bust on first install (no stored version means clean
  // install; nothing to bust).
  if (!storedVersion) return;

  // Try Tauri's clearAllBrowsingData — only available inside the
  // Tauri webview. Falls back gracefully in browser dev mode.
  try {
    const tauriWebview = await import("@tauri-apps/api/webview").catch(() => null);
    const win = tauriWebview && (tauriWebview as { getCurrentWebview?: () => unknown }).getCurrentWebview;
    if (win) {
      const wv = (win as () => { clearAllBrowsingData?: () => Promise<void> })();
      if (wv && typeof wv.clearAllBrowsingData === "function") {
        await wv.clearAllBrowsingData();
      }
    }
  } catch {
    // No Tauri runtime — that's fine. Plain browser reload below
    // is enough.
  }

  // Hard reload bypassing HTTP cache. location.reload(true) is
  // deprecated; the modern way is to navigate to the same URL with
  // a cache-busting query string then strip it.
  const url = new URL(window.location.href);
  url.searchParams.set("__v", currentVersion);
  window.location.replace(url.toString());
}
