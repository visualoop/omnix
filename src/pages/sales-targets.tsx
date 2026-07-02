import { useEffect, useState, useCallback } from "react";
import { Target, Trophy } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import {
  listTargets,
  type SalesTarget,
} from "@/services/sales-targets";
import { intlLocale } from "@/lib/intl";

import { BackButton } from "@/components/ui/back-button";
function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function SalesTargetsPage() {
  const [period, setPeriod] = useState(currentPeriod());
  const [items, setItems] = useState<SalesTarget[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await listTargets(period)); } finally { setLoading(false); }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n: number) => n.toLocaleString(intlLocale(), { maximumFractionDigits: 0 });
  const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0;

  return (
    <div className="max-w-3xl space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <BackButton fallback="/people" />
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> Sales targets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Per-staff monthly targets vs actual achieved (sum of completed sales attributed to each user).
          </p>
        </div>
        <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-[160px]" />
      </header>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center">
          <Target className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <div className="text-sm text-muted-foreground">
            No targets set for {period}. Insert via <span className="font-mono">sales_targets</span> or the People page.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((t) => {
            const p = pct(t.achieved_amount, t.target_amount);
            const hit = p >= 100;
            return (
              <div key={t.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between text-[13.5px]">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t.staff_name}</span>
                    {hit && <Trophy className="h-3.5 w-3.5 text-amber-500" weight="fill" />}
                  </div>
                  <div className="font-mono tabular-nums">
                    {fmt(t.achieved_amount)} / {fmt(t.target_amount)}
                  </div>
                </div>
                <div className="mt-2 h-2 rounded bg-muted overflow-hidden">
                  <div className={`h-2 ${hit ? "bg-emerald-500" : p > 70 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${Math.min(100, p)}%` }} />
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{p}% achieved</span>
                  {t.bonus_pct > 0 && hit && <span>Bonus: {t.bonus_pct}% payable</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
