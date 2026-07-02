import { useEffect, useState, useCallback } from "react";
import { ArrowCircleUp as ReorderIcon, ArrowClockwise as Refresh, Package } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  regenerateSuggestions,
  listSuggestions,
  markOrdered,
  dismiss,
  type ReorderSuggestion,
} from "@/services/reorder-suggestions";
import { intlLocale } from "@/lib/intl";

import { BackButton } from "@/components/ui/back-button";
const REASON_LABEL: Record<string, string> = {
  stockout: "Stockout",
  below_reorder: "Below reorder level",
  expected_stockout: "Expected stockout",
};

const REASON_COLOR: Record<string, string> = {
  stockout: "bg-red-500/10 text-red-700",
  below_reorder: "bg-amber-500/10 text-amber-700",
  expected_stockout: "bg-blue-500/10 text-blue-700",
};

export function ReorderSuggestionsPage() {
  const [items, setItems] = useState<ReorderSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await listSuggestions("pending")); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const n = await regenerateSuggestions();
      toast.success(`Generated ${n} suggestion${n === 1 ? "" : "s"}`);
      await load();
    } catch (e) {
      toast.error(String(e));
    } finally { setRegenerating(false); }
  };

  const fmt = (n: number | null) => n === null || !isFinite(n) ? "—" : n.toLocaleString(intlLocale(), { maximumFractionDigits: 1 });

  return (
    <div className="max-w-4xl space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <BackButton fallback="/inventory" />
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <ReorderIcon className="h-5 w-5 text-primary" /> Reorder suggestions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Velocity-based reorder recommendations. Regenerate any time — usually run daily.
          </p>
        </div>
        <Button onClick={handleRegenerate} disabled={regenerating}>
          <Refresh className={`h-4 w-4 mr-1.5 ${regenerating ? "animate-spin" : ""}`} />
          {regenerating ? "Regenerating…" : "Regenerate now"}
        </Button>
      </header>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center">
          <Package className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <div className="text-sm text-muted-foreground">
            No reorder suggestions right now. Click Regenerate to run the algorithm.
          </div>
        </div>
      ) : (
        <table className="w-full text-[13px] border border-border rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-3 py-2">SKU</th>
              <th className="text-left px-3 py-2">Product</th>
              <th className="text-right px-3 py-2">On hand</th>
              <th className="text-right px-3 py-2">Reorder at</th>
              <th className="text-right px-3 py-2">Velocity 30d</th>
              <th className="text-right px-3 py-2">Days cover</th>
              <th className="text-right px-3 py-2">Suggested qty</th>
              <th className="text-left px-3 py-2">Reason</th>
              <th className="w-32"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className="border-t border-border/50">
                <td className="px-3 py-2 font-mono text-[11.5px]">{s.sku}</td>
                <td className="px-3 py-2">{s.product_name}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{s.current_stock}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{s.reorder_level ?? "—"}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(s.velocity_30d)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(s.days_of_cover)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold">{s.suggested_qty}</td>
                <td className="px-3 py-2">
                  <span className={`text-[10.5px] px-2 py-0.5 rounded-full uppercase tracking-wider ${REASON_COLOR[s.reason]}`}>
                    {REASON_LABEL[s.reason] ?? s.reason}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="outline" onClick={async () => { await markOrdered(s.id); load(); }}>Ordered</Button>
                  {" "}
                  <Button size="sm" variant="ghost" onClick={async () => { await dismiss(s.id); load(); }}>Dismiss</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
