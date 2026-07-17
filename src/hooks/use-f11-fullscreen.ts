import { useEffect } from "react";
import { useFullscreenStore } from "@/stores/fullscreen";

type WinLike = {
  isFullscreen: () => Promise<boolean>;
  setFullscreen: (v: boolean) => Promise<void>;
  onResized?: (cb: () => void) => Promise<() => void>;
};

/**
 * F11 toggles Tauri-window fullscreen on the focused window; Esc exits.
 * Publishes the live fullscreen state to the shared store so the shell can
 * hide the custom titlebar strip + drop its top offset (otherwise fullscreen
 * leaves a chrome strip). Call once per window.
 */
export function useF11Fullscreen(): void {
  const setFullscreen = useFullscreenStore((s) => s.setFullscreen);

  useEffect(() => {
    let cancelled = false;
    let win: WinLike | null = null;
    let unlisten: (() => void) | null = null;

    const sync = async () => {
      if (!win || cancelled) return;
      try { const fs = await win.isFullscreen(); if (!cancelled) setFullscreen(fs); } catch { /* ignore */ }
    };

    import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => {
        if (cancelled) return;
        try {
          win = getCurrentWindow() as unknown as WinLike;
          void sync();
          // Keep our flag in sync if the OS changes fullscreen out from under us.
          win.onResized?.(() => void sync())
            .then((u) => { if (cancelled) u(); else unlisten = u; })
            .catch(() => {});
        } catch { /* not in Tauri */ }
      })
      .catch(() => {});

    const handler = async (e: KeyboardEvent) => {
      if (!win) return;
      if (e.key === "F11") {
        e.preventDefault();
        try {
          const fs = await win.isFullscreen();
          await win.setFullscreen(!fs);
          if (!cancelled) setFullscreen(!fs);
        } catch { /* best-effort */ }
        return;
      }
      if (e.key === "Escape") {
        try {
          const fs = await win.isFullscreen();
          if (fs) { e.preventDefault(); await win.setFullscreen(false); if (!cancelled) setFullscreen(false); }
        } catch { /* ignore */ }
      }
    };
    window.addEventListener("keydown", handler);
    return () => { cancelled = true; window.removeEventListener("keydown", handler); if (unlisten) unlisten(); };
  }, [setFullscreen]);
}
