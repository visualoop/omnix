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
  Package,
} from "@phosphor-icons/react";
import { useCartStore } from "@/stores/cart";
import { useActiveModule, MODULE_DEFINITIONS, type ModuleId } from "@/stores/active-module";
import { ModuleLogo } from "@/components/module-logos";
import { OmnixLogo } from "@/components/omnix-logo";
import { getDisplayConfig } from "@/lib/display-registry";
import { query } from "@/lib/db";
import { money as KES } from "@/lib/money";
import { intlLocale } from "@/lib/intl";

/**
 * Live hospitality order context fetched once + polled while the cart is
 * bound to a hospitality_order. Drives course grouping, per-line status
 * chips, table number, server name on the customer display.
 */
type KotItemStatus = "new" | "sent" | "preparing" | "ready" | "served" | "voided";
interface HospOrderItem {
  id: string;
  name: string;
  quantity: number;
  status: KotItemStatus;
  category: string | null;       // course (Starters / Mains / …)
  station_name: string | null;   // kitchen station that owns it
  sent_at: string | null;
  ready_at: string | null;
  served_at: string | null;
}
interface HospitalityContext {
  orderNumber: string;
  tableCode: string | null;
  tableName: string | null;
  waiterName: string | null;
  orderStatus: string;
  items: HospOrderItem[];
}


export function CustomerDisplayPage() {
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());
  const discountAmount = useCartStore((s) => s.cartDiscountAmount());
  const promoLabel = useCartStore((s) => s.promoLabel);
  const taxTotal = useCartStore((s) => s.taxTotal());
  const customerId = useCartStore((s) => s.customerId);
  const sourceType = useCartStore((s) => s.sourceType);
  const sourceId = useCartStore((s) => s.sourceId);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [productImages, setProductImages] = useState<Record<string, string | null>>({});
  const [hospContext, setHospContext] = useState<HospitalityContext | null>(null);

  // Resolve customer name when the cashier sets a customer on the sale.
  useEffect(() => {
    if (!customerId) { setCustomerName(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const { query } = await import("@/lib/db");
        const rows = await query<{ name: string }>(
          `SELECT name FROM customers WHERE id = ?1 LIMIT 1`,
          [customerId],
        );
        if (!cancelled) setCustomerName(rows[0]?.name ?? null);
      } catch { /* table may not exist on cold boot */ }
    })();
    return () => { cancelled = true; };
  }, [customerId]);

  // Resolve product images for the current cart so the customer sees a
  // thumbnail next to each line. Re-queries when product ids change.
  useEffect(() => {
    const ids = Array.from(new Set(items.map((i) => i.product_id))).filter(Boolean);
    if (ids.length === 0) { setProductImages({}); return; }
    // Skip a refetch if all current ids already in the map.
    const missing = ids.filter((id) => !(id in productImages));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const { query } = await import("@/lib/db");
        const placeholders = missing.map((_, i) => `?${i + 1}`).join(",");
        const rows = await query<{ id: string; image_path: string | null }>(
          `SELECT id, image_path FROM products WHERE id IN (${placeholders})`,
          missing,
        );
        if (cancelled) return;
        setProductImages((prev) => {
          const next = { ...prev };
          for (const r of rows) next[r.id] = r.image_path ?? null;
          // Mark queried-but-missing as null so we don't loop.
          for (const id of missing) if (!(id in next)) next[id] = null;
          return next;
        });
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
    // Intentionally depend on items.length + the joined id key, not the
    // map itself (which would self-trigger).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.product_id).join("|")]);

  // Hospitality enrichment: when the cart is bound to a hospitality_order
  // pull the live order + items every 2s. Drives the table/waiter header,
  // course grouping and per-line KOT status chips so the customer can see
  // exactly where their food is in the kitchen. The polling tear-down is
  // synchronous to avoid double-firing on fast source changes.
  useEffect(() => {
    if (sourceType !== "hospitality_order" || !sourceId) {
      setHospContext(null);
      return;
    }
    let cancelled = false;
    let timer: number | undefined;
    const fetchOnce = async () => {
      try {
        const orderRows = await query<{
          order_number: string; table_id: string | null; waiter_id: string | null; status: string;
        }>(
          `SELECT order_number, table_id, waiter_id, status FROM hospitality_orders WHERE id = ?1 LIMIT 1`,
          [sourceId],
        );
        if (!orderRows[0]) return;
        const o = orderRows[0];
        const [tableRow] = o.table_id
          ? await query<{ table_code: string; name: string }>(
              `SELECT table_code, name FROM dining_tables WHERE id = ?1 LIMIT 1`, [o.table_id])
          : [];
        const [waiterRow] = o.waiter_id
          ? await query<{ full_name: string }>(
              `SELECT full_name FROM employees WHERE id = ?1 LIMIT 1`, [o.waiter_id])
          : [];
        // Items + their menu category (course) + station name. LEFT JOINs
        // because not every line is a menu item (manual additions exist).
        const itemRows = await query<HospOrderItem & { menu_category: string | null; station_name: string | null }>(
          `SELECT oi.id, oi.name, oi.quantity, oi.status,
                  oi.sent_at, oi.ready_at, oi.served_at,
                  mi.category AS menu_category,
                  ks.name AS station_name
             FROM hospitality_order_items oi
             LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
             LEFT JOIN kitchen_stations ks ON ks.id = oi.station_id
            WHERE oi.order_id = ?1
              AND oi.status != 'voided'
            ORDER BY oi.sent_at NULLS LAST, oi.id ASC`,
          [sourceId],
        );
        if (cancelled) return;
        setHospContext({
          orderNumber: o.order_number,
          tableCode: tableRow?.table_code ?? null,
          tableName: tableRow?.name ?? null,
          waiterName: waiterRow?.full_name ?? null,
          orderStatus: o.status,
          items: itemRows.map((r) => ({
            id: r.id, name: r.name, quantity: r.quantity, status: r.status as KotItemStatus,
            category: r.menu_category, station_name: r.station_name,
            sent_at: r.sent_at, ready_at: r.ready_at, served_at: r.served_at,
          })),
        });
      } catch { /* table missing on cold boot — ignore */ }
    };
    fetchOnce();
    timer = window.setInterval(fetchOnce, 2000);
    return () => { cancelled = true; if (timer) window.clearInterval(timer); };
  }, [sourceType, sourceId]);
  const grandTotal = useCartStore((s) => s.grandTotal());
  const tip = useCartStore((s) => s.tip);
  const sourceLabel = useCartStore((s) => s.sourceLabel);
  const moduleId = useActiveModule((s) => s.active);
  const cfg = getDisplayConfig(moduleId);
  // Module display label for the customer-facing branding (e.g. "Dawa
  // Pharmacy", "Retail", "Hardware", "Hospitality").
  const moduleLabel = MODULE_DEFINITIONS[(moduleId as ModuleId)]?.shortName ?? "POS";

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
      <div className="relative min-h-[100dvh] bg-background text-foreground flex flex-col items-center justify-center p-12 overflow-hidden">
        {/* Atmospheric ambient glow — module-tinted */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[60vmin] w-[60vmin] rounded-full ${cfg.accentLine} opacity-20 blur-[140px]`} />
        </div>
        <div className="relative z-10 glass-thick rounded-glass-xl px-16 py-14 flex flex-col items-center bg-white/5 dark:bg-white/[0.02]">
          <div className={`h-1 w-24 ${cfg.accentLine} rounded-full mb-10`} />
          <CheckCircle2 className={`h-24 w-24 ${cfg.accentText}`} strokeWidth={1.5} />
          <div className="text-2xl text-muted-foreground mt-8">Paid</div>
          <div className="text-7xl font-bold font-mono tabular-nums mt-2 tracking-tight">{KES(paidTotal)}</div>
          <div className="text-xl text-foreground/75 mt-8">{cfg.successMessage}</div>
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
        <div className="relative min-h-[100dvh] bg-background text-foreground/85 overflow-hidden">
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
          <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/80 to-transparent flex items-start justify-between">
            <BusinessNameBadge name={businessName} />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent flex items-end justify-between">
            <OmnixBrandBlock moduleLabel={moduleLabel} size="md" />
            <span className="font-mono text-sm text-muted-foreground tabular-nums">{clock}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="relative min-h-[100dvh] bg-background text-foreground/85 flex flex-col items-center justify-center p-12 overflow-hidden">
        {/* Ambient module-tinted glow */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className={`absolute top-[15%] left-[15%] h-[40vmin] w-[40vmin] rounded-full ${cfg.accentLine} opacity-10 blur-[160px]`} />
          <div className={`absolute bottom-[10%] right-[15%] h-[36vmin] w-[36vmin] rounded-full ${cfg.accentLine} opacity-10 blur-[180px]`} />
        </div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="glass-thick rounded-glass-xl bg-white/5 dark:bg-white/[0.02] p-8 mb-2">
            <ModuleLogo moduleId={moduleId} size={120} />
          </div>
          <h1 className="text-5xl font-bold mt-6 text-foreground tracking-tight">{businessName}</h1>
          <p className="text-xl text-muted-foreground mt-3">{cfg.idleSubtitle}</p>
          <div className={`mt-12 h-1 w-24 ${cfg.accentLine} rounded-full`} />
          <div className="mt-8 text-base text-muted-foreground">
            {now.toLocaleDateString(intlLocale(), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div className="mt-1 text-3xl font-mono tabular-nums text-foreground/75">{clock}</div>
          {privacyMode && (
            <p className="mt-10 text-muted-foreground text-sm">Privacy mode · item names hidden</p>
          )}
          <p className="mt-8 text-muted-foreground/70 text-sm">{cfg.idleHint}</p>
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
    <div className="min-h-[100dvh] bg-background text-foreground/85 flex flex-col">
      <div className="flex-shrink-0">
        <div className={`h-1 ${cfg.accentLine}`} />
        <div className="px-10 py-5 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-3">
            <BusinessNameBadge name={businessName} />
            <div className="text-sm text-muted-foreground">
              {cfg.activeLabels.orderTitle}
              {sourceLabel && <span className="ml-2 text-muted-foreground">· {sourceLabel}</span>}
            </div>
          </div>
          <div className="flex items-center gap-6">
            {hospContext?.tableCode && (
              <div className="text-right leading-tight">
                <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Table
                </div>
                <div className="text-base font-medium text-foreground">
                  {hospContext.tableCode}
                  {hospContext.tableName && hospContext.tableName !== hospContext.tableCode && (
                    <span className="text-muted-foreground ml-1.5 text-sm">· {hospContext.tableName}</span>
                  )}
                </div>
              </div>
            )}
            {hospContext?.waiterName && (
              <div className="text-right leading-tight">
                <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Server
                </div>
                <div className="text-base font-medium text-foreground">{hospContext.waiterName}</div>
              </div>
            )}
            {customerName && (
              <div className="text-right leading-tight">
                <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Customer
                </div>
                <div className="text-base font-medium text-foreground">{customerName}</div>
              </div>
            )}
            <div className="text-right">
              <div className="text-sm text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""}</div>
              <div className="text-base font-mono tabular-nums text-muted-foreground">{clock}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-10 py-6">
        {hospContext ? (
          <HospitalityItemList
            cartItems={items}
            kotItems={hospContext.items}
            images={productImages}
            accent={cfg.accentLine}
            itemName={itemName}
          />
        ) : (
          <table className="w-full">
          <thead>
            <tr className="border-b border-border text-sm font-semibold text-muted-foreground">
              <th className="text-left py-3">Item</th>
              <th className="text-right py-3 w-24">Qty</th>
              <th className="text-right py-3 w-36">Price</th>
              <th className="text-right py-3 w-36">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const meta = cfg.lineMetadata?.(item);
              const img = productImages[item.product_id];
              return (
                <tr key={item.id} className={`border-b border-border/50 ${idx === items.length - 1 ? "bg-card/40" : ""}`}>
                  <td className="py-3.5">
                    <div className="flex items-center gap-4">
                      <LineThumb image={img} accent={cfg.accentLine} />
                      <div className="min-w-0">
                        <div className="text-xl font-medium text-foreground truncate">{itemName(item.name)}</div>
                        {meta && <div className="text-sm text-muted-foreground">{meta}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 text-right text-xl font-mono tabular-nums">{item.quantity}</td>
                  <td className="py-3.5 text-right text-xl font-mono tabular-nums text-muted-foreground">{item.unit_price.toFixed(2)}</td>
                  <td className="py-3.5 text-right text-xl font-mono tabular-nums font-semibold text-foreground">{(item.unit_price * item.quantity).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
          </table>
        )}
      </div>

      <div className="bg-card px-10 py-7 border-t border-border flex-shrink-0">
        <div className="grid grid-cols-2 gap-10 max-w-5xl mx-auto">
          <div className="space-y-2.5 text-muted-foreground text-lg self-center">
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
            <div className="text-muted-foreground text-sm uppercase tracking-widest">{cfg.activeLabels.totalLabel}</div>
            <div className={`text-7xl font-bold font-mono tabular-nums leading-none mt-2 text-foreground`}>{KES(grandTotal)}</div>
          </div>
        </div>
        {/* Omnix branding strip — our shop window on the live sale */}
        <div className="max-w-5xl mx-auto mt-6 pt-4 border-t border-border/60 flex items-center justify-between">
          <OmnixBrandBlock moduleLabel={moduleLabel} size="sm" />
        </div>
      </div>
    </div>
  );
}

/** Our public domain, shown in the customer-facing Omnix branding. */
const OMNIX_DOMAIN = "www.omnix.co.ke";

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
          <span className={`font-semibold tracking-tight text-foreground ${wordmark}`}>Omnix</span>
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {moduleLabel}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground">POS • Inventory • Accounting</div>
        <div className="text-[11px] font-mono text-muted-foreground">{OMNIX_DOMAIN}</div>
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
      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Welcome to
      </div>
      <div className="text-base font-semibold text-foreground">{name}</div>
    </div>
  );
}

/**
 * Line-item thumbnail. Shows the product image when one is set, otherwise
 * an accent-tinted package icon. 56×56 well so it reads cleanly at the
 * 19-inch customer-facing display distance.
 */
function LineThumb({ image, accent }: { image: string | null | undefined; accent: string }) {
  // accent is a tailwind class like "bg-emerald-500" — strip "bg-" so we
  // can use it as a ring + glow source.
  const ringClass = accent.replace(/^bg-/, "ring-").replace(/\/\d+$/, "/40");
  if (image) {
    return (
      <div className={`h-14 w-14 shrink-0 rounded-md overflow-hidden ring-1 ${ringClass} bg-card`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt=""
          className="h-full w-full object-cover"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      </div>
    );
  }
  return (
    <div className={`h-14 w-14 shrink-0 rounded-md grid place-items-center ring-1 ${ringClass} bg-card/60`}>
      <Package className="size-7 text-muted-foreground" strokeWidth={1.25} />
    </div>
  );
}

/**
 * Course-grouped item list with live KOT status chips for hospitality.
 * Items are merged with the cart line (which has price + quantity) by
 * name match — KOT mirrors the order_items at send-time so names align.
 * If a KOT line has no matching cart line (because the customer is
 * viewing an open ticket before checkout) we still render the row.
 */
interface CartLineLike {
  id: string;
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

function HospitalityItemList({
  cartItems, kotItems, images, accent, itemName,
}: {
  cartItems: CartLineLike[];
  kotItems: HospOrderItem[];
  images: Record<string, string | null>;
  accent: string;
  itemName: (n: string) => string;
}) {
  // Course buckets (fallback "Other") — insertion order preserved by Map.
  const buckets = new Map<string, HospOrderItem[]>();
  for (const k of kotItems) {
    const key = k.category && k.category.trim() ? k.category : "Other";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(k);
  }
  return (
    <div className="space-y-7">
      {Array.from(buckets.entries()).map(([course, lines]) => (
        <section key={course}>
          <header className="flex items-baseline justify-between border-b border-border pb-2 mb-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{course}</h3>
            <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
              {lines.length} item{lines.length !== 1 ? "s" : ""}
            </span>
          </header>
          <ul className="divide-y divide-border/60">
            {lines.map((line) => {
              const cartMatch = cartItems.find((c) => c.name === line.name);
              const img = cartMatch ? images[cartMatch.product_id] : null;
              const unit = cartMatch?.unit_price;
              const total = cartMatch ? cartMatch.unit_price * cartMatch.quantity : null;
              return (
                <li key={line.id} className="py-3.5 flex items-center gap-4">
                  <LineThumb image={img} accent={accent} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl font-medium text-foreground truncate">{itemName(line.name)}</span>
                      <KotStatusChip status={line.status} />
                    </div>
                    {line.station_name && (
                      <div className="text-xs text-muted-foreground mt-0.5">{line.station_name}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-mono tabular-nums text-foreground/75">×{line.quantity}</div>
                    {total != null && (
                      <div className="text-sm font-mono tabular-nums text-muted-foreground">
                        {unit?.toFixed(2)} · <span className="text-foreground/75 font-semibold">{total.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * Per-line KOT status chip — matches the colour language of make-line
 * displays at QSR chains (amber while cooking, green when ready, dim
 * once served so attention stays on what's still cooking).
 */
function KotStatusChip({ status }: { status: KotItemStatus }) {
  const map: Record<KotItemStatus, { label: string; cls: string; pulse?: boolean }> = {
    new:        { label: "Queued",    cls: "bg-muted/40 text-foreground/75 ring-muted-foreground/30" },
    sent:       { label: "In kitchen", cls: "bg-amber-500/15 text-amber-200 ring-amber-500/40" },
    preparing:  { label: "Cooking",   cls: "bg-amber-500/20 text-amber-100 ring-amber-400/60", pulse: true },
    ready:      { label: "Ready",     cls: "bg-emerald-500/25 text-emerald-100 ring-emerald-400/70", pulse: true },
    served:     { label: "Served",    cls: "bg-muted/60 text-muted-foreground ring-muted-foreground/40" },
    voided:     { label: "Cancelled", cls: "bg-rose-500/15 text-rose-200 ring-rose-500/40" },
  };
  const v = map[status];
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ring-1 " +
        v.cls
      }
    >
      <span
        className={
          "inline-block h-1.5 w-1.5 rounded-full bg-current " + (v.pulse ? "animate-pulse" : "")
        }
      />
      {v.label}
    </span>
  );
}
