import { useEffect, useMemo, useState, useCallback } from "react";
import { Warning, Plus, MagnifyingGlass as Search } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PaginationBar } from "@/components/pagination-bar";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { useAuthStore } from "@/stores/auth";
import { hasPermission } from "@/lib/permissions";
import { OperationalContext } from "@/components/shared/operational-context";
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
  const [search, setSearch] = useState("");
  const user = useAuthStore((state) => state.user);
  const canManage = hasPermission(user, "pharmacy.dispense");
  const filtered = useMemo(() => { const needle = search.trim().toLowerCase(); return needle ? items.filter((item) => [item.recall_number, item.reason, item.batch_number, item.issued_by].some((value) => value?.toLowerCase().includes(needle))) : items; }, [items, search]);
  const { pageRows, pagination } = useClientPagination(filtered, 12, `${filter}:${search}`);

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
      <OperationalContext />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
        <Button disabled={!canManage} title={canManage ? "Issue recalls from the connected hub when available; local quarantine remains authoritative." : "Your role cannot issue recalls."} className="h-11 w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-1.5" /> New recall
        </Button>
      </header>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search recall, batch, reason, or issuer…" className="h-11 pl-9" />
      </div>

      <div className="grid grid-cols-3 gap-1 border-b border-border">
        {(["active", "closed", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`min-h-11 px-3 py-1.5 text-[13px] border-b-2 -mb-px ${
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
      ) : pageRows.length === 0 ? (
        <div className="py-12 text-center">
          <Warning className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <div className="text-sm text-muted-foreground">
            No {filter} recalls.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {pageRows.map((r) => (
            <article key={r.id} className="rounded-md border border-border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
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
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={SEVERITY_COLOR[r.severity]}>{r.severity}</Badge>
                <Badge variant={r.status === "active" ? "destructive" : "secondary"}>{r.status}</Badge>
              </div>
              </div>
              {canManage && r.status === "active" && <Button className="mt-3 h-11 w-full" size="sm" variant="outline" onClick={() => handleClose(r)}>Close recall</Button>}
            </article>
          ))}
        </div>
      )}
      <PaginationBar list={pagination} />
    </div>
  );
}
