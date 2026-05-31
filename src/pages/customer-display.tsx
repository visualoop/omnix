/**
 * Customer-facing display.
 *
 * Opens in a separate Tauri window (typically on a second monitor facing the
 * customer). Subscribes to cart store and shows the current cart with
 * running total and welcome message.
 *
 * Design per Plan 09: flat dark canvas, module-aware accent, no gradients.
 * Dawa privacy mode hides product names when configured via settings.
 */
import { useEffect, useState } from "react";
import { useCartStore } from "@/stores/cart";
import { useActiveModule } from "@/stores/active-module";
import { Heart } from "lucide-react";
import { ModuleLogo } from "@/components/module-logos";
import { query } from "@/lib/db";

const KES = (n: number) => "KES " + n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ACCENT_BORDER: Record<string, string> = {
  dawa: "border-teal-500/50 bg-teal-500",
  retail: "border-amber-500/50 bg-amber-500",
};

export function CustomerDisplayPage() {
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());
  const discountAmount = useCartStore((s) => s.cartDiscountAmount());
  const taxTotal = useCartStore((s) => s.taxTotal());
  const grandTotal = useCartStore((s) => s.grandTotal());
  const tip = useCartStore((s) => s.tip);
  const moduleId = useActiveModule((s) => s.active);
  const [businessName, setBusinessName] = useState("");
  const [privacyMode, setPrivacyMode] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    Promise.all([
      query<{ value: string }>(`SELECT value FROM settings WHERE key = 'business.name'`),
      query<{ value: string }>(`SELECT value FROM settings WHERE key = 'display.privacy'`),
    ]).then(([nameRows, privacyRows]) => {
      setBusinessName(nameRows[0]?.value || "Omnix");
      setPrivacyMode(privacyRows[0]?.value === "1");
    }).catch(() => {});
  }, []);

  const accentLine = ACCENT_BORDER[moduleId] || "border-primary/50 bg-primary";

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-200 flex flex-col items-center justify-center p-12">
        <ModuleLogo moduleId={moduleId} size={120} />
        <h1 className="text-5xl font-bold mt-6 text-white tracking-tight">{businessName}</h1>
        <p className="text-xl text-stone-400 mt-3">Karibu — welcome</p>
        <div className={`mt-12 w-32 h-0.5 ${accentLine}`} />
        <div className="mt-8 text-base text-stone-500">
          {now.toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </div>
        <div className="mt-1 text-3xl font-mono text-stone-300">
          {now.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false })}
        </div>
        {privacyMode && moduleId === "dawa" && (
          <p className="mt-10 text-stone-500 text-sm">Privacy mode · Product names hidden</p>
        )}
        <p className="mt-8 text-stone-600 text-sm">Please proceed to the cashier</p>
      </div>
    );
  }

  const displayName = (name: string) => privacyMode && moduleId === "dawa" ? "Pharmacy item" : name;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-200 flex flex-col">
      <div className="flex-shrink-0 border-b border-stone-800">
        <div className={`h-0.5 ${accentLine}`} />
        <div className="px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ModuleLogo moduleId={moduleId} size={36} />
            <div>
              <div className="text-sm text-stone-400">{businessName}</div>
              <div className="text-xs text-stone-500">Your order</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-stone-500">{items.length} item{items.length !== 1 ? "s" : ""}</div>
            <div className="text-sm font-mono text-stone-400">
              {now.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-5">
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone-800">
              <th className="text-left py-3 text-sm font-semibold text-stone-500">Item</th>
              <th className="text-right py-3 text-sm font-semibold text-stone-500 w-20">Qty</th>
              <th className="text-right py-3 text-sm font-semibold text-stone-500 w-32">Price</th>
              <th className="text-right py-3 text-sm font-semibold text-stone-500 w-32">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr
                key={item.id}
                className={`border-b border-stone-800/50 ${idx === items.length - 1 ? "bg-stone-900/50" : ""}`}
              >
                <td className="py-3 text-lg font-medium text-white">{displayName(item.name)}</td>
                <td className="py-3 text-right text-lg font-mono tabular-nums">{item.quantity}</td>
                <td className="py-3 text-right text-lg font-mono tabular-nums text-stone-400">{item.unit_price.toFixed(2)}</td>
                <td className="py-3 text-right text-lg font-mono tabular-nums font-semibold text-white">{(item.unit_price * item.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-stone-900 px-8 py-6 border-t border-stone-800 flex-shrink-0">
        <div className="grid grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="space-y-2 text-stone-400 text-base">
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
          <div className="flex flex-col items-end justify-end">
            <div className="text-stone-500 text-sm uppercase tracking-widest">Total to pay</div>
            <div className="text-7xl font-bold font-mono tabular-nums leading-none mt-2 text-white">
              {KES(grandTotal)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
