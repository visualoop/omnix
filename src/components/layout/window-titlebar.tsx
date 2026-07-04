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
import { useLocation } from "react-router-dom";
import { Minus, Square, X, CopySimple, Pill, Storefront, ForkKnife, Wrench, Sparkle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { VARIANT, VARIANT_ACCENT } from "@/lib/variant";
import { useActiveModule } from "@/stores/active-module";

const H = 32; // matches Windows default titlebar height

/**
 * Route → human label map for the titlebar.
 *
 * Only the first path segment is looked up (so /hospitality/menu/abc
 * and /hospitality both resolve to "Hospitality").
 */
const ROUTE_LABEL_MAP: Record<string, string> = {
  "": "Dashboard",
  "dashboard": "Dashboard",
  "hospitality": "Hospitality",
  "pos": "POS",
  "inventory": "Inventory",
  "products": "Products",
  "customers": "Customers",
  "suppliers": "Suppliers",
  "purchase-orders": "Purchase Orders",
  "sales-history": "Sales",
  "sales": "Sales",
  "reports": "Reports",
  "insights": "Insights",
  "settings": "Settings",
  "invoicing": "Invoicing",
  "expenses": "Expenses",
  "banking": "Banking",
  "petty-cash": "Petty Cash",
  "receivables": "Receivables",
  "stock-transfers": "Transfers",
  "stock-take": "Stock Take",
  "returns": "Returns",
  "employees": "Employees",
  "users": "Users",
  "audit-log": "Audit Log",
  "etims-queue": "eTIMS Queue",
  "prescriptions": "Prescriptions",
  "refills": "Refills",
  "claims": "Claims",
  "brands": "Brands",
  "laybys": "Laybys",
  "special-orders": "Special Orders",
  "shrinkage": "Shrinkage",
  "hardware": "Hardware",
  "quotations": "Quotations",
  "delivery-notes": "Delivery Notes",
  "contractors": "Contractors",
  "ai": "AI",
  "hub": "Hub",
  "hub-modules": "Modules",
  "hub-inventory": "Inventory Hub",
  "hub-sales": "Sales Hub",
  "hub-people": "People Hub",
  "hub-finance": "Finance Hub",
  "hub-operations": "Operations Hub",
};

function routeLabelFromPath(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean)[0] ?? "";
  return ROUTE_LABEL_MAP[seg] ?? "";
}

/**
 * Icon for the currently-active module. Trade variants pick from VARIANT;
 * Pro reads the useActiveModule store so switching modules refreshes.
 */
function ModuleIcon({ moduleId, size = 14 }: { moduleId: string; size?: number }) {
  const cls = "shrink-0";
  const style = { color: VARIANT_ACCENT };
  switch (moduleId) {
    case "dawa":
      return <Pill className={cls} size={size} weight="fill" style={style} />;
    case "retail":
      return <Storefront className={cls} size={size} weight="fill" style={style} />;
    case "hospitality":
      return <ForkKnife className={cls} size={size} weight="fill" style={style} />;
    case "hardware":
      return <Wrench className={cls} size={size} weight="fill" style={style} />;
    default:
      return <Sparkle className={cls} size={size} weight="fill" style={style} />;
  }
}

/** Resolves the module id to render, whether trade-locked or Pro-active. */
function useCurrentModuleId(): string {
  const active = useActiveModule((s) => s.active);
  return VARIANT === "pro" ? active : VARIANT;
}

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
      {/* Left — module identity: [icon] BRAND.name · <route label>.
       *  Always shown so secondary windows (KDS / Customer Display /
       *  Order Board) also carry the branding. When the caller passes
       *  a `title` (e.g. "Kitchen Display"), it becomes the route
       *  label suffix so the strip reads
       *  "Omnix Hospitality · Kitchen Display". */}
      <ModuleIdentity title={title} />

      {/* Centre — draggable spacer. The route label already lives on the
       *  left inside ModuleIdentity, so keep the centre empty for a
       *  cleaner strip. */}
      <div data-tauri-drag-region className="flex-1 min-w-0" />

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

/**
 * Left-side module identity block on the custom titlebar.
 * Shows the variant/module icon (tinted with the variant accent) then
 * the product name + current top-level route label.
 *
 * If `title` is passed by the caller (secondary windows like KDS /
 * Customer Display / Order Board), it wins over the derived route
 * label. If the label duplicates the trailing word of BRAND.name
 * (e.g. "Hospitality" on an "Omnix Hospitality" build), the suffix is
 * dropped to avoid "Omnix Hospitality · Hospitality".
 */
function ModuleIdentity({ title }: { title?: string }) {
  const location = useLocation();
  const moduleId = useCurrentModuleId();
  const derived = routeLabelFromPath(location.pathname);
  const label = title ?? derived;
  const brandTail = BRAND.name.split(/\s+/).pop() ?? "";
  const suppress = label && brandTail && label.toLowerCase() === brandTail.toLowerCase();
  const showLabel = label && !suppress;
  return (
    <div
      data-tauri-drag-region
      className="flex items-center gap-2 pl-3 pr-2 shrink-0 min-w-[180px]"
    >
      <ModuleIcon moduleId={moduleId} size={14} />
      <span className="text-[11px] font-medium tracking-wide text-foreground/85 truncate">
        {BRAND.name}
      </span>
      {showLabel ? (
        <>
          <span className="text-[11px] text-muted-foreground/70">·</span>
          <span className="text-[11px] text-muted-foreground truncate">
            {label}
          </span>
        </>
      ) : null}
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
