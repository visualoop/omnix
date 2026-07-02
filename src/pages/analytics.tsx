/**
 * /reports/analytics — curated dashboards leveraging the report-builder engine.
 *
 * Four tabs: Sales · Inventory · Purchases · Finance
 * Each tab renders 2-3 pre-configured queries with tables + a lightweight bar visualization.
 */
import { useEffect, useState, useCallback } from "react";
import { ChartLine, Package, ShoppingCart, Calculator } from "@phosphor-icons/react";
import { runReport, type ReportQuery, type ReportRow } from "@/services/report-builder";
import { intlLocale } from "@/lib/intl";

type TabId = "sales" | "inventory" | "purchases" | "finance";

const TABS: Array<{ id: TabId; label: string; icon: typeof ChartLine }> = [
  { id: "sales", label: "Sales", icon: ChartLine },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "purchases", label: "Purchases", icon: ShoppingCart },
  { id: "finance", label: "Finance", icon: Calculator },
];

function last30(): { from: string; to: string } {
  const to = new Date().toISOString().slice(0, 10) + " 23:59:59";
  const from = new Date(Date.now() - 30 * 24 * 3600_000).toISOString().slice(0, 10) + " 00:00:00";
  return { from, to };
}

export function AnalyticsPage() {
  const [tab, setTab] = useState<TabId>("sales");
  const [dashboards, setDashboards] = useState<Record<string, ReportRow[]>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const range = last30();
      const queries: Record<TabId, Array<{ key: string; label: string; q: ReportQuery }>> = {
        sales: [
          { key: "by_day", label: "Sales by day (last 30d)", q: { entity: "sales", dimensions: ["day"], measures: ["total", "count"], filters: range } },
          { key: "by_payment", label: "Sales by payment method", q: { entity: "sales", dimensions: ["payment_method"], measures: ["total"], filters: range } },
          { key: "by_staff", label: "Sales by staff", q: { entity: "sales", dimensions: ["staff"], measures: ["total", "count"], filters: range } },
        ],
        inventory: [
          { key: "value", label: "Top 30 SKUs by inventory value", q: { entity: "inventory", dimensions: [], measures: [], filters: {}, limit: 30 } },
        ],
        purchases: [
          { key: "by_supplier", label: "Purchases by supplier (last 30d)", q: { entity: "purchases", dimensions: [], measures: [], filters: range } },
        ],
        finance: [
          { key: "by_account", label: "Journal totals by account", q: { entity: "finance", dimensions: [], measures: [], filters: range } },
        ],
      };
      const out: Record<string, ReportRow[]> = {};
      const qs = queries[tab];
      await Promise.all(qs.map(async ({ key, q }) => {
        out[key] = await runReport(q).catch(() => []);
      }));
      setDashboards(out);
    } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n: number | string | null) =>
    typeof n === "number" ? n.toLocaleString(intlLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) :
    (n ?? "—");

  return (
    <div className="max-w-5xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <ChartLine className="h-5 w-5 text-primary" /> Analytics
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Curated dashboards across sales, inventory, purchases, and finance. Powered by the report-builder engine.
        </p>
      </header>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-[13px] border-b-2 -mb-px flex items-center gap-1.5 ${
                tab === t.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(dashboards).map(([key, rows]) => (
            <Panel key={key} title={key.replace(/_/g, " ")} rows={rows} fmt={fmt} />
          ))}
        </div>
      )}
    </div>
  );
}

function Panel({ title, rows, fmt }: { title: string; rows: ReportRow[]; fmt: (n: number | string | null) => string }) {
  if (rows.length === 0) {
    return (
      <section className="rounded-lg border border-border p-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</h2>
        <div className="text-[13px] text-muted-foreground">No data.</div>
      </section>
    );
  }
  const keys = Object.keys(rows[0]);
  return (
    <section className="rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-2 bg-muted/40 text-[13px] font-semibold uppercase tracking-wider">
        {title}
      </div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border/50">
            {keys.map((k) => (
              <th key={k} className="text-left px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((r, i) => (
            <tr key={i} className="border-b border-border/30 last:border-b-0">
              {keys.map((k) => (
                <td key={k} className={`px-3 py-1 ${typeof r[k] === "number" ? "text-right font-mono tabular-nums" : ""}`}>
                  {fmt(r[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
