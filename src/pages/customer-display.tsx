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
import { CheckCircle2, Heart } from "lucide-react";
import { useCartStore } from "@/stores/cart";
import { useActiveModule } from "@/stores/active-module";
import { ModuleLogo } from "@/components/module-logos";
import { getDisplayConfig } from "@/lib/display-registry";
import { query } from "@/lib/db";

const KES = (n: number) =>
  "KES " + n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  const [businessName, setBusinessName] = useState("Omnix");
  const [privacyMode, setPrivacyMode] = useState(cfg.privacyMode);
  const [now, setNow] = useState(new Date());
  const [paidTotal, setPaidTotal] = useState<number | null>(null);
  const prevCount = useRef(items.length);
  const prevTotal = useRef(grandTotal);

  useEffect(() => {
    useActiveModule.getState().load().catch(() => {});
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Per-module privacy: setting key is `customer_display.privacy.<moduleId>`
  // (e.g. `customer_display.privacy.dawa`). If the per-module key isn't set,
  // fall back to the registry default — privacyMode is OFF for retail /
  // hospitality / hardware so customers see real item names. Only Dawa
  // defaults to ON for medication-name privacy.
  useEffect(() => {
    Promise.all([
      query<{ value: string }>(`SELECT value FROM settings WHERE key = 'business.name'`),
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

  const clock = now.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false });
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
            {now.toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div className="mt-1 text-3xl font-mono tabular-nums text-stone-300">{clock}</div>
          {privacyMode && (
            <p className="mt-10 text-stone-500 text-sm">Privacy mode · item names hidden</p>
          )}
          <p className="mt-8 text-stone-600 text-sm">{cfg.idleHint}</p>
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
            <ModuleLogo moduleId={moduleId} size={40} />
            <div>
              <div className="text-base font-medium text-white">{businessName}</div>
              <div className="text-sm text-stone-500">
                {cfg.activeLabels.orderTitle}
                {sourceLabel && <span className="ml-2 text-stone-400">· {sourceLabel}</span>}
              </div>
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
      </div>
    </div>
  );
}
