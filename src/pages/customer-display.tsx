/**
 * Customer-facing display.
 *
 * Opens in a separate Tauri window (typically on a second monitor facing the
 * customer). Subscribes to cart store updates and shows the current cart with
 * running total, change due, and welcome message.
 *
 * Two states:
 *  - Idle (no cart items) → branded welcome screen with promotional space
 *  - Active sale → live cart contents + total
 *  - Payment success → "Thank you" splash with change due
 */
import { useEffect, useState } from "react";
import { useCartStore } from "@/stores/cart";
import { useActiveModule } from "@/stores/active-module";
import { Heart } from "lucide-react";
import { ModuleLogo } from "@/components/module-logos";
import { query } from "@/lib/db";

const KES = (n: number) => "KES " + n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function CustomerDisplayPage() {
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());
  const discountAmount = useCartStore((s) => s.cartDiscountAmount());
  const taxTotal = useCartStore((s) => s.taxTotal());
  const grandTotal = useCartStore((s) => s.grandTotal());
  const tip = useCartStore((s) => s.tip);
  const moduleId = useActiveModule((s) => s.active);
  const [businessName, setBusinessName] = useState("");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    query<{ value: string }>(`SELECT value FROM settings WHERE key = 'business.name'`)
      .then((rows) => setBusinessName(rows[0]?.value || "Omnix"))
      .catch((e) => { console.error("Business name fetch failed:", e); });
  }, []);

  const accent = moduleId === "dawa"
    ? "from-teal-600 via-emerald-600 to-cyan-600"
    : moduleId === "retail"
      ? "from-orange-600 via-amber-500 to-rose-500"
      : "from-amber-600 via-yellow-500 to-orange-500";

  // Idle state — welcome screen
  if (items.length === 0) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${accent} text-white flex flex-col items-center justify-center p-12`}>
        <ModuleLogo moduleId={moduleId} size={160} />
        <h1 className="text-7xl font-bold mt-8 tracking-tight">{businessName}</h1>
        <p className="text-2xl text-white/80 mt-4">Karibu — welcome</p>
        <div className="mt-16 text-lg text-white/60">
          {now.toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </div>
        <div className="mt-2 text-2xl font-mono text-white/80">
          {now.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false })}
        </div>
        <p className="mt-12 text-white/60 text-base">
          Please proceed to the cashier
        </p>
      </div>
    );
  }

  // Active sale — live cart
  return (
    <div className="min-h-screen bg-stone-900 text-white flex flex-col">
      {/* Header */}
      <div className={`bg-gradient-to-r ${accent} px-8 py-4 flex items-center justify-between flex-shrink-0`}>
        <div className="flex items-center gap-3">
          <ModuleLogo moduleId={moduleId} size={40} />
          <div>
            <div className="text-sm text-white/80">{businessName}</div>
            <div className="text-xs text-white/60">Your order</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/70">{items.length} item{items.length !== 1 ? "s" : ""}</div>
          <div className="text-sm font-mono text-white/80">
            {now.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false })}
          </div>
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone-700">
              <th className="text-left py-3 text-sm font-semibold text-stone-400">Item</th>
              <th className="text-right py-3 text-sm font-semibold text-stone-400 w-24">Qty</th>
              <th className="text-right py-3 text-sm font-semibold text-stone-400 w-32">Price</th>
              <th className="text-right py-3 text-sm font-semibold text-stone-400 w-32">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr
                key={item.id}
                className={`border-b border-stone-800 ${idx === items.length - 1 ? "bg-stone-800/50 transition-colors" : ""}`}
              >
                <td className="py-3 text-lg font-medium">{item.name}</td>
                <td className="py-3 text-right text-lg font-mono tabular-nums">{item.quantity}</td>
                <td className="py-3 text-right text-lg font-mono tabular-nums text-stone-300">{item.unit_price.toFixed(2)}</td>
                <td className="py-3 text-right text-lg font-mono tabular-nums font-semibold">{(item.unit_price * item.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals footer */}
      <div className="bg-stone-950 px-8 py-6 border-t-2 border-stone-700 flex-shrink-0">
        <div className="grid grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Left: receipts breakdown */}
          <div className="space-y-2 text-stone-300 text-base">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">{subtotal.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Discount</span>
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
                <span className="flex items-center gap-1.5">
                  <Heart className="h-4 w-4 fill-rose-400" />
                  Tip
                </span>
                <span className="font-mono tabular-nums">+{tip.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Right: big total */}
          <div className="flex flex-col items-end justify-end">
            <div className="text-stone-400 text-sm uppercase tracking-widest">Total to pay</div>
            <div className="text-7xl font-bold font-mono tabular-nums leading-none mt-2 text-white">
              {KES(grandTotal)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
