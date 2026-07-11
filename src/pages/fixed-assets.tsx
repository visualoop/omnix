import { useState } from "react";
import { Buildings, Plus, MagnifyingGlass } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { runMonthlyDepreciation, type FixedAsset } from "@/services/fixed-assets";
import { pageFixedAssets } from "@/services/paged";
import { useListData } from "@/hooks/use-list-data";
import { PaginationBar } from "@/components/pagination-bar";
import { toast } from "sonner";
import { intlLocale } from "@/lib/intl";

import { BackButton } from "@/components/ui/back-button";
function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function FixedAssetsPage() {
  const list = useListData(pageFixedAssets, { pageSize: 50 });
  const [running, setRunning] = useState(false);

  const handleRunDep = async () => {
    setRunning(true);
    try {
      const n = await runMonthlyDepreciation(currentPeriod());
      toast.success(`Depreciation posted for ${n} asset${n === 1 ? "" : "s"}`);
      list.refresh();
    } catch (e) {
      toast.error(String(e));
    } finally { setRunning(false); }
  };

  const fmt = (n: number) => n.toLocaleString(intlLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="max-w-4xl space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <BackButton fallback="/reports" />
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Buildings className="h-5 w-5 text-primary" /> Fixed assets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Furniture, equipment, vehicles, buildings — anything you own that produces value over multiple years.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRunDep} disabled={running}>
            {running ? "Running…" : `Run depreciation for ${currentPeriod()}`}
          </Button>
          <Button disabled title="Coming: New asset form">
            <Plus className="h-4 w-4 mr-1.5" /> New asset
          </Button>
        </div>
      </header>

      <div className="relative max-w-sm">
        <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={list.search} onChange={(e) => list.setSearch(e.target.value)} placeholder="Search by code, name, category…" className="pl-9" />
      </div>

      {list.loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : list.rows.length === 0 ? (
        <div className="py-12 text-center">
          <Buildings className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <div className="text-sm text-muted-foreground">
            {list.search ? "No assets match your search." : "No fixed assets registered yet."}
          </div>
        </div>
      ) : (
        <table className="w-full text-[13px] border border-border rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-3 py-2">Code</th>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Category</th>
              <th className="text-right px-3 py-2">Cost</th>
              <th className="text-right px-3 py-2">Accum. dep.</th>
              <th className="text-right px-3 py-2">Book value</th>
              <th className="text-left px-3 py-2">Method</th>
              <th className="text-left px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {list.rows.map((a: FixedAsset) => {
              const book = a.cost - a.accumulated_depreciation;
              return (
                <tr key={a.id} className="border-t border-border/50">
                  <td className="px-3 py-2 font-mono text-[11.5px]">{a.asset_code}</td>
                  <td className="px-3 py-2">{a.name}</td>
                  <td className="px-3 py-2 text-[11.5px]">{a.category ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(a.cost)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(a.accumulated_depreciation)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold">{fmt(book)}</td>
                  <td className="px-3 py-2 text-[11.5px]">{a.method.replace("_", " ")}</td>
                  <td className="px-3 py-2 text-[11.5px] uppercase tracking-wider">{a.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <PaginationBar list={list} />
    </div>
  );
}
