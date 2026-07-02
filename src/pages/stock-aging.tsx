import { useEffect, useState, useCallback } from "react";
import { Clock, Package as PackageX } from "@phosphor-icons/react";
import { stockAging, deadStock, type AgingBatch, type DeadStockItem } from "@/services/inventory-quality";
import { intlLocale } from "@/lib/intl";

import { BackButton } from "@/components/ui/back-button";
export function StockAgingPage() {
  const [items, setItems] = useState<AgingBatch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await stockAging()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmt = (n: number) => n.toLocaleString(intlLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="max-w-4xl space-y-4">
      <header>
        <BackButton fallback="/reports" />
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" /> Stock aging
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          How long each batch has been on the shelf. Oldest first — good candidates for discount clearance.
        </p>
      </header>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center">
          <Clock className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <div className="text-sm text-muted-foreground">No aging batches.</div>
        </div>
      ) : (
        <table className="w-full text-[13px] border border-border rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-3 py-2">Product</th>
              <th className="text-left px-3 py-2">Batch</th>
              <th className="text-right px-3 py-2">Qty</th>
              <th className="text-right px-3 py-2">Age (days)</th>
              <th className="text-right px-3 py-2">Value at cost</th>
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.batch_id} className="border-t border-border/50">
                <td className="px-3 py-2">{b.product_name}</td>
                <td className="px-3 py-2 font-mono text-[11.5px]">{b.batch_number}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{b.quantity}</td>
                <td className={`px-3 py-2 text-right font-mono tabular-nums ${b.age_days > 90 ? "text-red-600 font-semibold" : b.age_days > 30 ? "text-amber-700" : ""}`}>
                  {b.age_days}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(b.cost_value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function DeadStockPage() {
  const [items, setItems] = useState<DeadStockItem[]>([]);
  const [threshold, setThreshold] = useState(60);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await deadStock(threshold)); } finally { setLoading(false); }
  }, [threshold]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n: number) => n.toLocaleString(intlLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="max-w-4xl space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <PackageX className="h-5 w-5 text-primary" /> Dead stock
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            SKUs with stock but no sales in the last {threshold} days. Total cost tied up is money you could recover.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <label className="text-muted-foreground">Threshold (days)</label>
          <input
            type="number"
            min={7}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value) || 60)}
            className="w-20 rounded border border-border px-2 py-1 bg-background"
          />
        </div>
      </header>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center">
          <PackageX className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <div className="text-sm text-muted-foreground">No dead stock — everything moves.</div>
        </div>
      ) : (
        <table className="w-full text-[13px] border border-border rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-3 py-2">SKU</th>
              <th className="text-left px-3 py-2">Product</th>
              <th className="text-right px-3 py-2">On hand</th>
              <th className="text-right px-3 py-2">Cost value</th>
              <th className="text-right px-3 py-2">Days since sold</th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.product_id} className="border-t border-border/50">
                <td className="px-3 py-2 font-mono text-[11.5px]">{d.sku}</td>
                <td className="px-3 py-2">{d.product_name}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{d.qty_on_hand}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold">{fmt(d.cost_value)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-red-600">
                  {d.days_since_sold ?? "never"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
