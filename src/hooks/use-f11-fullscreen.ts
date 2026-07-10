import { useEffect } from "react";
import { useFullscreenStore } from "@/stores/fullscreen";

type WinLike = {
  isFullscreen: () => Promise<boolean>;
  setFullscreen: (v: boolean) => Promise<void>;
  onResized: (cb: () => void) => Promise<() => void>;
};

/**
 * Wire F11 (or Fn+F11 on laptops) to toggle Tauri-window fullscreen on
 * whichever window the user is currently focused in, and publish the current
 * fullscreen state to the shared store so the shell can hide its custom
 * titlebar + drop the titlebar's top offset (otherwise fullscreen leaves a
 * chrome strip / clipped content).
 *
 * Call ONCE per window (root of each window's tree). Esc exits fullscreen.
 * Returns the current fullscreen boolean (always false in the browser build).
 */
export function useF11Fullscreen(): boolean {
  const isFullscreen = useFullscreenStore((s) => s.isFullscreen);
  const setFullscreenState = useFullscreenStore((s) => s.setFullscreen);

  useEffect(() => {
    let cancelled = false;
    let win: WinLike | null = null;
    let unlisten: (() => void) | null = null;

    const sync = async () => {
      if (!win || cancelled) return;
      try {
        const fs = await win.isFullscreen();
        if (!cancelled) setFullscreenState(fs);
      } catch {
        /* ignore */
      }
    };

    import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => {
        if (cancelled) return;
        try {
          win = getCurrentWindow() as unknown as WinLike;
          void sync();
          win.onResized(() => void sync())
            .then((u) => { if (cancelled) u(); else unlisten = u; })
            .catch(() => {});
        } catch {
          /* not inside Tauri */
        }
      })
      .catch(() => {});

    const handler = async (e: KeyboardEvent) => {
      if (!win) return;
      if (e.key === "F11") {
        e.preventDefault();
        try {
          const fs = await win.isFullscreen();
          await win.setFullscreen(!fs);
          if (!cancelled) setFullscreenState(!fs);
        } catch {
          /* best-effort */
        }
        return;
      }
      if (e.key === "Escape") {
        try {
          const fs = await win.isFullscreen();
          if (fs) {
            e.preventDefault();
            await win.setFullscreen(false);
            if (!cancelled) setFullscreenState(false);
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
      if (unlisten) unlisten();
    };
  }, [setFullscreenState]);

  return isFullscreen;
}

