import { useEffect } from "react";

/**
 * Wire F11 (or Fn+F11 on laptops) to toggle Tauri-window fullscreen on
 * whichever window the user is currently focused in.
 *
 * The hook scopes to a single window — call it once near the root of
 * each window's tree (main `App.tsx` + `customer-display.tsx`) so the
 * shortcut works the way it does in any normal Windows app.
 *
 * Esc exits fullscreen — matches the OS behaviour the user expects.
 */
export function useF11Fullscreen(): void {
  useEffect(() => {
    let cancelled = false;
    let win: { isFullscreen: () => Promise<boolean>; setFullscreen: (v: boolean) => Promise<void> } | null = null;
    // Resolve the current window asynchronously — tauri APIs are dynamic
    // imports on the desktop build, browser build just no-ops.
    import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => {
        if (cancelled) return;
        try {
          win = getCurrentWindow();
        } catch {
          // Not running inside Tauri (e.g. vite preview) — skip.
        }
      })
      .catch(() => {
        /* not in Tauri context */
      });

    const handler = async (e: KeyboardEvent) => {
      if (!win) return;
      // Toggle on F11
      if (e.key === "F11") {
        e.preventDefault();
        try {
          const fs = await win.isFullscreen();
          await win.setFullscreen(!fs);
        } catch {
          // best-effort — different webview engines silently reject
        }
        return;
      }
      // Exit fullscreen on Esc — only when we're actually fullscreen so
      // we don't intercept Esc for dialog dismissal etc.
      if (e.key === "Escape") {
        try {
          const fs = await win.isFullscreen();
          if (fs) {
            e.preventDefault();
            await win.setFullscreen(false);
          }
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", handler);
    };
  }, []);
}
