import { useEffect, useState, useCallback } from "react";
import { Lock, LockOpen, Calendar } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  listFinancialYears,
  listPeriods,
  updatePeriodStatus,
  ensureMonthlyPeriods,
  closeFinancialYear,
  reopenFinancialYear,
  type FinancialYear,
  type Period,
} from "@/services/period-close";
import { useAuthStore } from "@/stores/auth";
import { confirm } from "@/components/ui/confirm-dialog";
import { intlLocale } from "@/lib/intl";

import { BackButton } from "@/components/ui/back-button";
export function PeriodClosePage() {
  const user = useAuthStore((s) => s.user);
  const [years, setYears] = useState<FinancialYear[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [activeFy, setActiveFy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const ys = await listFinancialYears();
    setYears(ys);
    if (ys[0]) {
      setActiveFy(ys[0].id);
      // Ensure monthly periods exist for the current year.
      const created = await ensureMonthlyPeriods(ys[0].id);
      if (created > 0) toast.success(`Created ${created} monthly periods`);
      setPeriods(await listPeriods(ys[0].id));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const changeFy = async (id: string) => {
    setActiveFy(id);
    setPeriods(await listPeriods(id));
  };

  const closePeriod = async (p: Period) => {
    const ok = await confirm({
      title: `Close period ${p.label}?`,
      description: "After closing, no new journal entries can be posted with dates inside this period. You'll need to reopen it (audit-logged) to make changes.",
      confirmText: "Close period",
    });
    if (!ok) return;
    await updatePeriodStatus(p.id, "closed", user?.id);
    toast.success(`Closed ${p.label}`);
    if (activeFy) setPeriods(await listPeriods(activeFy));
  };

  const reopenPeriod = async (p: Period) => {
    const ok = await confirm({
      title: `Reopen period ${p.label}?`,
      description: "Once reopened, journal entries can be posted again. This action is audit-logged.",
    });
    if (!ok) return;
    await updatePeriodStatus(p.id, "open");
    toast.success(`Reopened ${p.label}`);
    if (activeFy) setPeriods(await listPeriods(activeFy));
  };

  const closeFy = async (fy: FinancialYear) => {
    const ok = await confirm({
      title: `Close financial year ${fy.label}?`,
      description: "This locks the entire year. All periods within it become closed. Reopening is possible but audited.",
      confirmText: "Close year",
    });
    if (!ok) return;
    await closeFinancialYear(fy.id, user?.id);
    // Also close every period inside it.
    const ps = await listPeriods(fy.id);
    await Promise.all(ps.map((p) => updatePeriodStatus(p.id, "closed", user?.id)));
    toast.success(`Closed ${fy.label}`);
    load();
  };

  const reopenFy = async (fy: FinancialYear) => {
    await reopenFinancialYear(fy.id);
    toast.success(`Reopened ${fy.label}`);
    load();
  };

  return (
    <div className="max-w-3xl space-y-5">
      <header>
        <BackButton fallback="/reports" />
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" /> Financial year &amp; period close
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Freeze historical months so no one can rewrite the books. Reopening is possible but audit-logged.
        </p>
      </header>

      <section className="rounded-lg border border-border">
        <div className="px-3 py-2 border-b border-border text-[12px] font-semibold uppercase tracking-wider">
          Financial years
        </div>
        {years.map((fy) => (
          <div key={fy.id} className={`px-3 py-2 flex items-center gap-3 border-b border-border/50 last:border-b-0 ${activeFy === fy.id ? "bg-primary/5" : ""}`}>
            <button onClick={() => changeFy(fy.id)} className="flex-1 text-left">
              <div className="text-[13.5px] font-medium">{fy.label}</div>
              <div className="text-[11.5px] text-muted-foreground">
                {new Date(fy.start_date).toLocaleDateString(intlLocale())} — {new Date(fy.end_date).toLocaleDateString(intlLocale())}
              </div>
            </button>
            <span className={`text-[10.5px] px-2 py-0.5 rounded-full uppercase tracking-wider ${fy.closed_at ? "bg-red-500/10 text-red-700" : "bg-emerald-500/10 text-emerald-700"}`}>
              {fy.closed_at ? "closed" : "open"}
            </span>
            {fy.closed_at ? (
              <Button size="sm" variant="ghost" onClick={() => reopenFy(fy)}>
                <LockOpen className="h-3.5 w-3.5 mr-1" /> Reopen
              </Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={() => closeFy(fy)}>
                <Lock className="h-3.5 w-3.5 mr-1" /> Close year
              </Button>
            )}
          </div>
        ))}
      </section>

      {activeFy && (
        <section className="rounded-lg border border-border">
          <div className="px-3 py-2 border-b border-border text-[12px] font-semibold uppercase tracking-wider">
            Monthly periods
          </div>
          {periods.length === 0 ? (
            <div className="px-3 py-4 text-[13px] text-muted-foreground">No periods yet.</div>
          ) : (
            periods.map((p) => (
              <div key={p.id} className="px-3 py-1.5 flex items-center gap-3 border-b border-border/50 last:border-b-0">
                <div className="flex-1 text-[13px]">
                  <span className="font-medium">{p.label}</span>
                  <span className="text-muted-foreground ml-2">
                    {new Date(p.start_date).toLocaleDateString(intlLocale())} — {new Date(p.end_date).toLocaleDateString(intlLocale())}
                  </span>
                </div>
                <span className={`text-[10.5px] px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  p.status === "closed" ? "bg-red-500/10 text-red-700" :
                  p.status === "soft_closed" ? "bg-amber-500/10 text-amber-700" :
                  "bg-emerald-500/10 text-emerald-700"
                }`}>
                  {p.status.replace("_", " ")}
                </span>
                {p.status === "closed" ? (
                  <Button size="sm" variant="ghost" onClick={() => reopenPeriod(p)}>Reopen</Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => closePeriod(p)}>Close</Button>
                )}
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
}
