/**
 * WindowTitlebar — themed replacement for the native window decorations.
 *
 * We turn off native `decorations` in tauri.conf.json for every variant and
 * draw our own titlebar. Reasons:
 *   1. The native titlebar is stuck to the OS colour scheme regardless of
 *      the theme the user picked in /settings/appearance. Cream light mode
 *      with a stark-white Windows titlebar looks jarring.
 *   2. Same custom titlebar means the six palettes actually own the entire
 *      chrome, edge to edge. Linear, VS Code, Discord, Slack all take the
 *      same trade-off.
 *
 * Height stays at 32px (Windows default) so muscle-memory for hitting
 * close/max/min doesn't change. Buttons match Fluent 2 sizing.
 *
 * Drag region: any element with `data-tauri-drag-region` is grabbable by
 * the OS. The buttons opt out via their own click handlers.
 */
import { useEffect, useState } from "react";
import { Minus, Square, X, CopySimple } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const H = 32; // matches Windows default titlebar height

type WinApi = {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onResized: (cb: () => void) => Promise<() => void>;
  title?: string;
};

async function getWindowApi(): Promise<WinApi | null> {
  try {
    // Prefer getCurrentWebviewWindow — it resolves to the specific
    // WebView that made the call (works for main + every secondary
    // window we spawn via openCustomerDisplay / openKitchenDisplay).
    // getCurrentWindow from `@tauri-apps/api/window` should also work
    // but the webview flavour is the recommended API for v2.
    const mod = await import("@tauri-apps/api/webviewWindow");
    const w = mod.getCurrentWebviewWindow();
    return {
      minimize: () => w.minimize(),
      toggleMaximize: () => w.toggleMaximize(),
      close: () => w.close(),
      isMaximized: () => w.isMaximized(),
      onResized: (cb) => w.onResized(cb),
    };
  } catch (e) {
    console.warn("[titlebar] window API unavailable — running outside Tauri?", e);
    return null;
  }
}

interface Props {
  /** Optional label for the centre — falls back to nothing.
   *  Main app leaves this empty; customer-display / KDS pass a short label. */
  title?: string;
  /** When true, hide the titlebar (fullscreen mode). */
  hidden?: boolean;
  /** Extra content aligned to the right of the drag region, left of the
   *  window control buttons. Used for the connectivity indicator etc. */
  extras?: React.ReactNode;
}

export function WindowTitlebar({ title, hidden, extras }: Props) {
  const [api, setApi] = useState<WinApi | null>(null);
  const [maxed, setMaxed] = useState(false);

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      const a = await getWindowApi();
      if (cancelled || !a) return;
      setApi(a);
      try {
        setMaxed(await a.isMaximized());
        cleanup = await a.onResized(async () => setMaxed(await a.isMaximized()));
      } catch {
        /* non-Tauri (Vite dev preview in browser) — silently skip */
      }
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  if (hidden) return null;
  // Non-Tauri (Vite browser preview) — no window controls to show, but
  // keep a placeholder so layout doesn't shift.
  const isTauri = api !== null;

  return (
    <div
      data-tauri-drag-region
      className={cn(
        "fixed top-0 inset-x-0 z-[100] flex items-center bg-background border-b border-border/60 select-none",
        "text-foreground",
      )}
      style={{ height: H }}
    >
      {/* Left — spacer so title stays centered when there's no logo yet */}
      <div className="w-24 shrink-0" data-tauri-drag-region />

      {/* Centre — title (optional). Draggable. */}
      <div
        data-tauri-drag-region
        className="flex-1 text-center text-[11px] font-medium tracking-wide text-muted-foreground truncate px-3"
      >
        {title ?? ""}
      </div>

      {/* Right — extras + window controls */}
      <div className="flex items-center shrink-0">
        {extras ? (
          <div className="flex items-center gap-1 pr-2 pointer-events-auto">
            {extras}
          </div>
        ) : null}

        {isTauri ? (
          <div className="flex items-stretch">
            <TitlebarButton
              onClick={() => api!.minimize().catch((e) => console.error("[titlebar] minimize failed", e))}
              label="Minimize"
            >
              <Minus className="h-3 w-3" />
            </TitlebarButton>
            <TitlebarButton
              onClick={() => api!.toggleMaximize().catch((e) => console.error("[titlebar] toggleMaximize failed", e))}
              label={maxed ? "Restore" : "Maximize"}
            >
              {maxed ? <CopySimple className="h-3 w-3" /> : <Square className="h-3 w-3" />}
            </TitlebarButton>
            <TitlebarButton
              onClick={() => api!.close().catch((e) => console.error("[titlebar] close failed", e))}
              label="Close"
              danger
            >
              <X className="h-3.5 w-3.5" />
            </TitlebarButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TitlebarButton({
  onClick,
  label,
  danger,
  children,
}: {
  onClick: () => void;
  label: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center h-8 w-[46px]",
        "text-muted-foreground hover:text-foreground",
        danger ? "hover:bg-destructive hover:text-destructive-foreground" : "hover:bg-accent",
        "transition-colors",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Height helper — every layout that renders below the titlebar needs
 * a matching top padding. Keeps a single source of truth.
 */
export const TITLEBAR_HEIGHT_PX = H;
