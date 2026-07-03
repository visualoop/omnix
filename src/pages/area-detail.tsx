/**
 * Dining Area detail — /hospitality/areas/:id
 *
 * Shows the tables in this area, live status, active order per table,
 * plus a rename / deactivate action bar. This is what the user wants
 * to see when they click "Main Hall" in the areas grid.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Pencil, Trash as Trash2, Plus, ForkKnife as UtensilsCrossed } from "@phosphor-icons/react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { prompt, confirm } from "@/components/ui/confirm-dialog";
import { query, execute } from "@/lib/db";
import { toast } from "sonner";
import { intlLocale } from "@/lib/intl";

interface Area {
  id: string;
  name: string;
  sort_order: number;
  active: number;
  created_at: string;
}
interface TableRow {
  id: string;
  table_code: string;
  name: string;
  seats: number;
  status: string;
  active: number;
}
interface OpenOrder {
  order_id: string;
  order_number: string;
  table_id: string;
  status: string;
  item_count: number;
  total: number;
}

const STATUS_CLASSES: Record<string, string> = {
  free: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  seated: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  occupied: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  reserved: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  bill: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

export function AreaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [area, setArea] = useState<Area | null>(null);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [orders, setOrders] = useState<Map<string, OpenOrder>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [areaRows, tableRows, orderRows] = await Promise.all([
        query<Area>(`SELECT * FROM dining_areas WHERE id = ?1`, [id]),
        query<TableRow>(
          `SELECT id, table_code, name, seats, status, active
           FROM dining_tables WHERE area_id = ?1 AND active = 1
           ORDER BY table_code`,
          [id],
        ),
        query<OpenOrder>(
          `SELECT o.id AS order_id, o.order_number, o.table_id, o.status,
                  (SELECT COUNT(*) FROM hospitality_order_items WHERE order_id = o.id AND status != 'voided') AS item_count,
                  (SELECT COALESCE(SUM(line_total), 0) FROM hospitality_order_items WHERE order_id = o.id AND status != 'voided') AS total
           FROM hospitality_orders o
           WHERE o.status NOT IN ('paid', 'voided')
             AND o.table_id IN (SELECT id FROM dining_tables WHERE area_id = ?1)`,
          [id],
        ),
      ]);
      setArea(areaRows[0] ?? null);
      setTables(tableRows);
      setOrders(new Map(orderRows.map((o) => [o.table_id, o])));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [id]);

  const rename = async () => {
    if (!area) return;
    const next = await prompt({ title: "Rename area", defaultValue: area.name });
    if (!next || next === area.name) return;
    await execute(`UPDATE dining_areas SET name = ?2 WHERE id = ?1`, [area.id, next.trim()]);
    toast.success("Renamed");
    load();
  };
  const deactivate = async () => {
    if (!area) return;
    if (!(await confirm({
      title: `Close ${area.name}?`,
      description: "Tables in this area will stay but the area won't show in the pick-list.",
    }))) return;
    await execute(`UPDATE dining_areas SET active = 0 WHERE id = ?1`, [area.id]);
    toast.success("Area closed");
    navigate("/hospitality");
  };

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!area) return <p className="p-6 text-sm text-muted-foreground">Area not found.</p>;

  const totalSeats = tables.reduce((s, t) => s + t.seats, 0);
  const occupiedCount = tables.filter((t) => t.status !== "free").length;
  const activeOrders = tables.filter((t) => orders.has(t.id)).length;
  const openTabTotal = [...orders.values()].reduce((s, o) => s + o.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ fallback: "/hospitality" }}
        eyebrow="Dining area"
        title={area.name}
        description={`${tables.length} table${tables.length === 1 ? "" : "s"} · ${totalSeats} seats · created ${new Date(area.created_at).toLocaleDateString(intlLocale(), { dateStyle: "medium" })}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={rename}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Rename
            </Button>
            <Button variant="ghost" size="sm" onClick={deactivate} className="text-rose-600 hover:text-rose-700">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Close area
            </Button>
          </div>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        <Kpi label="Tables" value={tables.length.toLocaleString()} />
        <Kpi label="Seats" value={totalSeats.toLocaleString()} />
        <Kpi label="Occupied" value={`${occupiedCount} / ${tables.length}`} tone={occupiedCount ? "warn" : "muted"} />
        <Kpi label="Open tabs" value={activeOrders > 0 ? `${activeOrders} · KES ${openTabTotal.toFixed(0)}` : "—"} tone={activeOrders ? "accent" : "muted"} />
      </div>

      {/* Tables grid */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[13px] uppercase tracking-wider text-muted-foreground font-semibold">Tables</h2>
          <Button size="sm" variant="ghost" onClick={() => navigate("/hospitality")}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Manage from Hospitality hub
          </Button>
        </div>

        {tables.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <EmptyState
                icon={UtensilsCrossed}
                title="No tables in this area yet"
                description={`Add a few tables from the Hospitality hub so ${area.name} has somewhere to seat guests.`}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {tables.map((t) => {
              const order = orders.get(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => navigate(`/hospitality/tables/${t.id}`)}
                  className="text-left rounded-lg border border-border p-3 hover:bg-accent/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{t.table_code}</span>
                    <Badge variant="outline" className={`text-[10px] ${STATUS_CLASSES[t.status] || ""}`}>
                      {t.status}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {t.seats} seat{t.seats === 1 ? "" : "s"}
                  </div>
                  {order ? (
                    <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-400 font-mono tabular-nums">
                      #{order.order_number} · KES {order.total.toFixed(0)}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "warn" | "accent" | "muted" }) {
  const cls =
    tone === "warn" ? "text-amber-600" :
    tone === "accent" ? "text-emerald-600" :
    tone === "muted" ? "text-muted-foreground" :
    "text-foreground";
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold font-mono tabular-nums mt-1 ${cls}`}>{value}</div>
    </div>
  );
}
