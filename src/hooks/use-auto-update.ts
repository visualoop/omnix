import { useEffect } from "react";
import {
  startBackgroundUpdate,
  hasPendingUpdate,
  installPendingUpdateOnClose,
} from "@/services/auto-update";

declare const __APP_VERSION__: string;

/**
 * VSCode/Electron-style auto-update, wired once at the app root.
 *
 *   - ~8s after launch, silently download a non-major update in the
 *     background (startBackgroundUpdate). The till keeps working.
 *   - Intercept the window close: if an update finished downloading,
 *     install it (which quits + applies on Windows) instead of just
 *     closing. If nothing is pending, close normally.
 *
 * No-ops outside Tauri (vite preview / tests).
 */
export function useAutoUpdate(): void {
  useEffect(() => {
    const currentVersion =
      (typeof __APP_VERSION__ !== "undefined" && __APP_VERSION__) || "0.0.0";

    // 1) Background download — delayed so it never competes with the
    //    initial DB init + first paint.
    const t = setTimeout(() => {
      startBackgroundUpdate(currentVersion).catch(() => {});
    }, 8000);

    // 2) Install-on-close interceptor.
    let cancelled = false;
    let unlisten: (() => void) | null = null;
    import("@tauri-apps/api/window")
      .then(async ({ getCurrentWindow }) => {
        if (cancelled) return;
        let win;
        try {
          win = getCurrentWindow();
        } catch {
          return; // not in Tauri
        }
        // Only the main window owns the updater (not the customer display).
        if (win.label && win.label !== "main") return;
        unlisten = await win.onCloseRequested(async (event) => {
          if (!hasPendingUpdate()) return; // nothing to apply — close normally
          // Hold the close, apply the update (Windows installer quits the
          // app itself), then we're done.
          event.preventDefault();
          const ok = await installPendingUpdateOnClose();
          if (!ok) {
            // Install failed — let the close proceed so we don't trap the user.
            win.destroy().catch(() => {});
          }
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      clearTimeout(t);
      if (unlisten) unlisten();
    };
  }, []);
}
