import { useEffect, useState, useCallback } from "react";
import { Warning, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { listRecalls, closeRecall, type Recall } from "@/services/recalls";
import { intlLocale } from "@/lib/intl";
import { toast } from "sonner";

import { BackButton } from "@/components/ui/back-button";
const SEVERITY_COLOR: Record<string, string> = {
  low: "bg-blue-500/10 text-blue-700",
  medium: "bg-amber-500/10 text-amber-700",
  high: "bg-orange-500/10 text-orange-700",
  critical: "bg-red-500/10 text-red-700",
};

export function RecallsPage() {
  const [items, setItems] = useState<Recall[]>([]);
  const [filter, setFilter] = useState<"active" | "closed" | "all">("active");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listRecalls(filter === "all" ? undefined : filter));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleClose = async (r: Recall) => {
    await closeRecall(r.id);
    toast.success(`Closed ${r.recall_number}`);
    load();
  };

  return (
    <div className="max-w-4xl space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <BackButton fallback="/pharmacy" />
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Warning className="h-5 w-5 text-primary" /> Medicine recalls
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            When KEMSA / MOH / a manufacturer recalls a batch, log it here.
            Affected stock is quarantined automatically — POS won&rsquo;t dispense it.
          </p>
        </div>
        <Button disabled title="Coming soon: issue-recall dialog">
          <Plus className="h-4 w-4 mr-1.5" /> New recall
        </Button>
      </header>

      <div className="flex gap-1 border-b border-border">
        {(["active", "closed", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-[13px] border-b-2 -mb-px ${
              filter === f
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center">
          <Warning className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <div className="text-sm text-muted-foreground">
            No {filter} recalls.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <div key={r.id} className="rounded-md border border-border p-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-[13.5px] font-medium">
                  <span className="font-mono text-[12px]">{r.recall_number}</span>
                  <span>·</span>
                  <span>{r.reason}</span>
                </div>
                <div className="text-[11.5px] text-muted-foreground mt-0.5">
                  Batch <span className="font-mono">{r.batch_number || "all"}</span>
                  {" · "}issued {new Date(r.issued_at + "Z").toLocaleDateString(intlLocale())}
                  {r.issued_by && <> · by {r.issued_by}</>}
                </div>
              </div>
              <span className={`text-[10.5px] px-2 py-0.5 rounded-full uppercase tracking-wider ${SEVERITY_COLOR[r.severity]}`}>
                {r.severity}
              </span>
              <span className={`text-[10.5px] px-2 py-0.5 rounded-full uppercase tracking-wider ${
                r.status === "active" ? "bg-red-500/10 text-red-700" : "bg-muted text-muted-foreground"
              }`}>
                {r.status}
              </span>
              {r.status === "active" && (
                <Button size="sm" variant="outline" onClick={() => handleClose(r)}>
                  Close
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
