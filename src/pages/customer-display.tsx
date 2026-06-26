/**
 * Customer-facing display.
 *
 * Runs in a separate Tauri window on a screen facing the customer. Renders
 * three states — idle, active order, and a brief payment-success panel — all
 * driven by the per-module display registry (Plan 09 §8).
 *
 * Design: flat premium dark canvas, module-aware accent line, big distance-
 * legible totals. No gradients, no glass. Cart syncs cross-window via the
 * zustand-persist cart store (shared localStorage + storage events).
 */
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle as CheckCircle2,
  Heart,
} from "@phosphor-icons/react";
import { useCartStore } from "@/stores/cart";
import { useActiveModule, MODULE_DEFINITIONS, type ModuleId } from "@/stores/active-module";
import { ModuleLogo } from "@/components/module-logos";
import { OmnixLogo } from "@/components/omnix-logo";
import { getDisplayConfig } from "@/lib/display-registry";
import { query } from "@/lib/db";
import { money as KES } from "@/lib/money";
import { intlLocale } from "@/lib/intl";


export function CustomerDisplayPage() {
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());
  const discountAmount = useCartStore((s) => s.cartDiscountAmount());
  const promoLabel = useCartStore((s) => s.promoLabel);
  const taxTotal = useCartStore((s) => s.taxTotal());
  const grandTotal = useCartStore((s) => s.grandTotal());
  const tip = useCartStore((s) => s.tip);
  const sourceLabel = useCartStore((s) => s.sourceLabel);
  const moduleId = useActiveModule((s) => s.active);
  const cfg = getDisplayConfig(moduleId);
  // Module display label for the customer-facing branding (e.g. "Dawa
  // Pharmacy", "Retail", "Hardware", "Hospitality").
  const moduleLabel = MODULE_DEFINITIONS[(moduleId as ModuleId)]?.name ?? "POS";

  const [businessName, setBusinessName] = useState("Omnix");
  const [privacyMode, setPrivacyMode] = useState(cfg.privacyMode);
  const [now, setNow] = useState(new Date());
  const [paidTotal, setPaidTotal] = useState<number | null>(null);
  const [playlist, setPlaylist] = useState<Array<{ type: "image" | "video" | "iframe"; url: string; durationSeconds: number }>>([]);
  const [slideIdx, setSlideIdx] = useState(0);
  const prevCount = useRef(items.length);
  const prevTotal = useRef(grandTotal);

  useEffect(() => {
    useActiveModule.getState().load().catch(() => {});
    // Same boot init the main window does — without this the money
    // formatter falls back to '$' because useCountry.code is null.
    import("@/stores/country")
      .then(({ useCountry }) => useCountry.getState().load().catch(() => {}))
      .catch(() => {});
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Load idle playlist (rotation slides shown when cart is empty)
  useEffect(() => {
    query<{ value: string }>(
      `SELECT value FROM settings WHERE key = 'customer_display.playlist'`,
    )
      .then((rows) => {
        if (rows[0]?.value) {
          try {
            const raw = JSON.parse(rows[0].value) as Array<{
              type: "image" | "video" | "iframe"
              url: string
              durationSeconds: number
            }>
            // Normalise any saved YouTube /watch URLs to /embed so the
            // iframe doesn't get refused by X-Frame-Options. We do this
            // on every load (cheap) instead of migrating the DB row so
            // settings-side edits don't need to know about it.
            setPlaylist(raw.map((s) => ({ ...s, url: normalizePlaylistUrl(s.url) })))
          } catch {
            setPlaylist([])
          }
        }
      })
      .catch(() => {})
  }, [])

  // (Duplicate of the helper in settings-customer-display.tsx; kept inline
  // so this file stays free of cross-page imports. If the rules diverge
  // we'll lift it to a shared module.)
  function normalizePlaylistUrl(raw: string): string {
    const ytPatterns: Array<RegExp> = [
      /youtube\.com\/watch\?(?:.*&)?v=([\w-]{6,})/i,
      /youtu\.be\/([\w-]{6,})/i,
      /youtube\.com\/shorts\/([\w-]{6,})/i,
    ]
    for (const re of ytPatterns) {
      const m = raw.match(re)
      if (m && m[1]) {
        const id = m[1]
        return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=0&modestbranding=1&playsinline=1&rel=0&loop=1&playlist=${id}`
      }
    }
    const vimeo = raw.match(/(?:^|\/)vimeo\.com\/(\d+)/i)
    if (vimeo) {
      return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1&muted=1&loop=1`
    }
    return raw
  }

  // Rotate playlist when idle
  useEffect(() => {
    if (items.length > 0 || playlist.length === 0) return;
    const dur = (playlist[slideIdx]?.durationSeconds ?? 15) * 1000;
    const t = setTimeout(() => setSlideIdx((i) => (i + 1) % playlist.length), dur);
    return () => clearTimeout(t);
  }, [slideIdx, items.length, playlist]);

  // Per-module privacy: setting key is `customer_display.privacy.<moduleId>`
  // (e.g. `customer_display.privacy.dawa`). If the per-module key isn't set,
  // fall back to the registry default — privacyMode is OFF for retail /
  // hospitality / hardware so customers see real item names. Only Dawa
  // defaults to ON for medication-name privacy.
  useEffect(() => {
    Promise.all([
      query<{ value: string }>(`SELECT name AS value FROM business LIMIT 1`),
      query<{ value: string }>(
        `SELECT value FROM settings WHERE key = ?1`,
        [`customer_display.privacy.${moduleId}`],
      ),
    ]).then(([nameRows, privacyRows]) => {
      if (nameRows[0]?.value) setBusinessName(nameRows[0].value);
      if (privacyRows[0]) setPrivacyMode(privacyRows[0].value === "1");
      else setPrivacyMode(cfg.privacyMode);
    }).catch(() => {});
  }, [moduleId, cfg.privacyMode]);

  // Detect order completion: cart drops from non-empty to empty → show success.
  useEffect(() => {
    if (prevCount.current > 0 && items.length === 0) {
      setPaidTotal(prevTotal.current);
      const t = setTimeout(() => setPaidTotal(null), 6000);
      prevCount.current = 0;
      return () => clearTimeout(t);
    }
    prevCount.current = items.length;
    if (grandTotal > 0) prevTotal.current = grandTotal;
  }, [items.length, grandTotal]);

  const clock = now.toLocaleTimeString(intlLocale(), { hour: "2-digit", minute: "2-digit", hour12: false });
  const itemName = (name: string) => (privacyMode ? cfg.privacyLabel : name);

  // ── Payment success ──────────────────────────────────────────────
  if (paidTotal !== null) {
    return (
      <div className="relative min-h-screen bg-stone-950 text-white flex flex-col items-center justify-center p-12 overflow-hidden">
        {/* Atmospheric ambient glow — module-tinted */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[60vmin] w-[60vmin] rounded-full ${cfg.accentLine} opacity-20 blur-[140px]`} />
        </div>
        <div className="relative z-10 glass-thick rounded-glass-xl px-16 py-14 flex flex-col items-center bg-white/5 dark:bg-white/[0.02]">
          <div className={`h-1 w-24 ${cfg.accentLine} rounded-full mb-10`} />
          <CheckCircle2 className={`h-24 w-24 ${cfg.accentText}`} strokeWidth={1.5} />
          <div className="text-2xl text-stone-400 mt-8">Paid</div>
          <div className="text-7xl font-bold font-mono tabular-nums mt-2 tracking-tight">{KES(paidTotal)}</div>
          <div className="text-xl text-stone-300 mt-8">{cfg.successMessage}</div>
        </div>
      </div>
    );
  }

  // ── Idle ─────────────────────────────────────────────────────────
  if (items.length === 0) {
    // If a playlist is configured, take over the idle screen with the
    // current slide. Falls through to the default logo screen otherwise.
    const slide = playlist[slideIdx];
    if (slide) {
      return (
        <div className="relative min-h-screen bg-stone-950 text-stone-200 overflow-hidden">
          {slide.type === "image" ? (
            <img src={slide.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : slide.type === "video" || slide.type === "iframe" ? (
            <iframe
              src={slide.url}
              title={`Slide ${slideIdx + 1}`}
              className="absolute inset-0 h-full w-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : null}
          <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-stone-950/80 to-transparent flex items-start justify-between">
            <BusinessNameBadge name={businessName} />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-stone-950/90 to-transparent flex items-end justify-between">
            <OmnixBrandBlock moduleLabel={moduleLabel} size="md" />
            <span className="font-mono text-sm text-stone-400 tabular-nums">{clock}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="relative min-h-screen bg-stone-950 text-stone-200 flex flex-col items-center justify-center p-12 overflow-hidden">
        {/* Ambient module-tinted glow */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className={`absolute top-[15%] left-[15%] h-[40vmin] w-[40vmin] rounded-full ${cfg.accentLine} opacity-10 blur-[160px]`} />
          <div className={`absolute bottom-[10%] right-[15%] h-[36vmin] w-[36vmin] rounded-full ${cfg.accentLine} opacity-10 blur-[180px]`} />
        </div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="glass-thick rounded-glass-xl bg-white/5 dark:bg-white/[0.02] p-8 mb-2">
            <ModuleLogo moduleId={moduleId} size={120} />
          </div>
          <h1 className="text-5xl font-bold mt-6 text-white tracking-tight">{businessName}</h1>
          <p className="text-xl text-stone-400 mt-3">{cfg.idleSubtitle}</p>
          <div className={`mt-12 h-1 w-24 ${cfg.accentLine} rounded-full`} />
          <div className="mt-8 text-base text-stone-500">
            {now.toLocaleDateString(intlLocale(), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div className="mt-1 text-3xl font-mono tabular-nums text-stone-300">{clock}</div>
          {privacyMode && (
            <p className="mt-10 text-stone-500 text-sm">Privacy mode · item names hidden</p>
          )}
          <p className="mt-8 text-stone-600 text-sm">{cfg.idleHint}</p>
        </div>
        {/* Omnix branding — bottom-left on the idle canvas */}
        <div className="absolute bottom-6 left-6 z-10">
          <OmnixBrandBlock moduleLabel={moduleLabel} size="md" />
        </div>
      </div>
    );
  }

  // ── Active order ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-stone-950 text-stone-200 flex flex-col">
      <div className="flex-shrink-0">
        <div className={`h-1 ${cfg.accentLine}`} />
        <div className="px-10 py-5 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3">
            <BusinessNameBadge name={businessName} />
            <div className="text-sm text-stone-500">
              {cfg.activeLabels.orderTitle}
              {sourceLabel && <span className="ml-2 text-stone-400">· {sourceLabel}</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-stone-500">{items.length} item{items.length !== 1 ? "s" : ""}</div>
            <div className="text-base font-mono tabular-nums text-stone-400">{clock}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-10 py-6">
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone-800 text-sm font-semibold text-stone-500">
              <th className="text-left py-3">Item</th>
              <th className="text-right py-3 w-24">Qty</th>
              <th className="text-right py-3 w-36">Price</th>
              <th className="text-right py-3 w-36">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const meta = cfg.lineMetadata?.(item);
              return (
                <tr key={item.id} className={`border-b border-stone-800/50 ${idx === items.length - 1 ? "bg-stone-900/40" : ""}`}>
                  <td className="py-3.5">
                    <div className="text-xl font-medium text-white">{itemName(item.name)}</div>
                    {meta && <div className="text-sm text-stone-500">{meta}</div>}
                  </td>
                  <td className="py-3.5 text-right text-xl font-mono tabular-nums">{item.quantity}</td>
                  <td className="py-3.5 text-right text-xl font-mono tabular-nums text-stone-400">{item.unit_price.toFixed(2)}</td>
                  <td className="py-3.5 text-right text-xl font-mono tabular-nums font-semibold text-white">{(item.unit_price * item.quantity).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-stone-900 px-10 py-7 border-t border-stone-800 flex-shrink-0">
        <div className="grid grid-cols-2 gap-10 max-w-5xl mx-auto">
          <div className="space-y-2.5 text-stone-400 text-lg self-center">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">{subtotal.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>{promoLabel ? `Promo · ${promoLabel}` : "Discount"}</span>
                <span className="font-mono tabular-nums">-{discountAmount.toFixed(2)}</span>
              </div>
            )}
            {taxTotal > 0 && (
              <div className="flex justify-between">
                <span>Tax</span>
                <span className="font-mono tabular-nums">{taxTotal.toFixed(2)}</span>
              </div>
            )}
            {tip > 0 && (
              <div className="flex justify-between text-rose-400">
                <span className="flex items-center gap-1.5"><Heart className="h-4 w-4 fill-rose-400" /> Tip</span>
                <span className="font-mono tabular-nums">+{tip.toFixed(2)}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end justify-end">
            <div className="text-stone-500 text-sm uppercase tracking-widest">{cfg.activeLabels.totalLabel}</div>
            <div className={`text-7xl font-bold font-mono tabular-nums leading-none mt-2 text-white`}>{KES(grandTotal)}</div>
          </div>
        </div>
        {/* Omnix branding strip — our shop window on the live sale */}
        <div className="max-w-5xl mx-auto mt-6 pt-4 border-t border-stone-800/60 flex items-center justify-between">
          <OmnixBrandBlock moduleLabel={moduleLabel} size="sm" />
        </div>
      </div>
    </div>
  );
}

/** Our public domain, shown in the customer-facing Omnix branding. */
const OMNIX_DOMAIN = "www.blyss.co.ke";

/**
 * Omnix branding block for the customer display.
 *
 * Replaces the old "module icon + business name" bottom-left cluster.
 * Now reads as OUR brand: the Omnix mark, the "Omnix" wordmark, a short
 * capability tagline, the active module name, and our domain. This is
 * the block the customer sees while watching idle videos and during a
 * live sale — it's our shop window on every till in the country.
 */
function OmnixBrandBlock({
  moduleLabel,
  size = "md",
}: {
  moduleLabel: string;
  size?: "sm" | "md" | "lg";
}) {
  const logoSize = size === "lg" ? 44 : size === "sm" ? 28 : 36;
  const wordmark = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg";
  return (
    <div className="flex items-center gap-3">
      <OmnixLogo size={logoSize} />
      <div className="leading-tight">
        <div className="flex items-baseline gap-2">
          <span className={`font-semibold tracking-tight text-white ${wordmark}`}>Omnix</span>
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400">
            {moduleLabel}
          </span>
        </div>
        <div className="text-[11px] text-stone-500">POS • Inventory • Accounting</div>
        <div className="text-[11px] font-mono text-stone-500">{OMNIX_DOMAIN}</div>
      </div>
    </div>
  );
}

/**
 * The customer's own business name — shown top-left so the customer
 * sees who they're buying from. Sourced from the `business` table
 * (Settings → Business Profile / setup wizard).
 */
function BusinessNameBadge({ name }: { name: string }) {
  if (!name || name === "Omnix") return null;
  return (
    <div className="leading-tight">
      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone-500">
        Welcome to
      </div>
      <div className="text-base font-semibold text-white">{name}</div>
    </div>
  );
}
