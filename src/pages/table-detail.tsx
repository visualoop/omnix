/**
 * Dining Table detail — /hospitality/tables/:id
 *
 * Current status + active order (with all items and totals), upcoming
 * reservations, and past transaction history for the table. This is
 * where a manager clicks to see "what's happening at Table 12".
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ForkKnife as UtensilsCrossed,
  Users,
  Clock,
  Receipt,
} from "@phosphor-icons/react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { query } from "@/lib/db";
import { money as KES } from "@/lib/money";
import { intlLocale } from "@/lib/intl";

interface Table {
  id: string;
  table_code: string;
  name: string;
  seats: number;
  status: string;
  area_id: string | null;
  area_name: string | null;
}
interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  status: string;
}
interface Order {
  id: string;
  order_number: string;
  status: string;
  waiter_name: string | null;
  opened_at: string;
  total: number;
  items: OrderItem[];
}
interface Reservation {
  id: string;
  guest_name: string;
  party_size: number | null;
  arrival_at: string;
  status: string;
}
interface PastSale {
  id: string;
  sale_number: number;
  total: number;
  created_at: string;
}

const STATUS_CLASSES: Record<string, string> = {
  free: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  seated: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  occupied: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  reserved: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  bill: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

export function TableDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [table, setTable] = useState<Table | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [pastSales, setPastSales] = useState<PastSale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      query<Table>(
        `SELECT t.*, a.name AS area_name
         FROM dining_tables t
         LEFT JOIN dining_areas a ON a.id = t.area_id
         WHERE t.id = ?1`,
        [id],
      ),
      query<{ id: string; order_number: string; status: string; waiter_name: string | null; opened_at: string }>(
        `SELECT o.id, o.order_number, o.status, e.full_name AS waiter_name, o.opened_at
         FROM hospitality_orders o
         LEFT JOIN employees e ON e.id = o.waiter_id
         WHERE o.table_id = ?1 AND o.status NOT IN ('paid', 'voided')
         ORDER BY o.opened_at DESC LIMIT 1`,
        [id],
      ),
      query<Reservation>(
        `SELECT id, guest_name, party_size, arrival_at, status
         FROM reservations
         WHERE table_id = ?1 AND status IN ('confirmed', 'seated')
           AND arrival_at >= datetime('now', '-2 hours')
         ORDER BY arrival_at ASC LIMIT 10`,
        [id],
      ),
      query<PastSale>(
        `SELECT s.id, s.sale_number, s.total, s.created_at
         FROM hospitality_orders o
         JOIN sales s ON s.id = o.sale_id
         WHERE o.table_id = ?1 AND o.status = 'paid'
         ORDER BY s.created_at DESC LIMIT 10`,
        [id],
      ),
    ]).then(async ([tableRows, orderRows, resvRows, sales]) => {
      setTable(tableRows[0] ?? null);
      setReservations(resvRows);
      setPastSales(sales);
      if (orderRows[0]) {
        const o = orderRows[0];
        const items = await query<OrderItem>(
          `SELECT id, name, quantity, unit_price, line_total, status
           FROM hospitality_order_items
           WHERE order_id = ?1 AND status != 'voided'
           ORDER BY rowid`,
          [o.id],
        );
        const total = items.reduce((s, it) => s + it.line_total, 0);
        setOrder({ ...o, items, total });
      } else {
        setOrder(null);
      }
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!table) return <p className="p-6 text-sm text-muted-foreground">Table not found.</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ fallback: table.area_id ? `/hospitality/areas/${table.area_id}` : "/hospitality" }}
        eyebrow={table.area_name ? `Table · ${table.area_name}` : "Table"}
        title={`Table ${table.table_code}`}
        description={`${table.seats} seat${table.seats === 1 ? "" : "s"}${table.name && table.name !== `Table ${table.table_code}` ? ` · ${table.name}` : ""}`}
        actions={
          <Badge variant="outline" className={`text-xs ${STATUS_CLASSES[table.status] || ""}`}>
            {table.status}
          </Badge>
        }
      />

      {/* Active order */}
      {order ? (
        <section>
          <h2 className="text-[13px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Active order · #{order.order_number}
          </h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-muted/40 text-xs">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Opened {new Date(order.opened_at.replace(" ", "T") + "Z").toLocaleTimeString(intlLocale(), { hour: "2-digit", minute: "2-digit" })}
                {order.waiter_name ? ` · ${order.waiter_name}` : ""}
              </span>
              <Badge variant="outline" className="text-[10px] capitalize">{order.status}</Badge>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/20 border-b border-border/60">
                <tr>
                  <th className="text-left px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Item</th>
                  <th className="text-right px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Qty</th>
                  <th className="text-right px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Unit</th>
                  <th className="text-right px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Line</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it) => (
                  <tr key={it.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2">{it.name}</td>
                    <td className="px-4 py-2 text-right font-mono">{it.quantity}</td>
                    <td className="px-4 py-2 text-right font-mono">{KES(it.unit_price)}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">{KES(it.line_total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/40">
                <tr>
                  <td className="px-4 py-2 text-right font-semibold" colSpan={3}>Total</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums font-semibold">{KES(order.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ) : (
        <section>
          <div className="rounded-lg border border-dashed border-border p-6">
            <EmptyState
              icon={UtensilsCrossed}
              title="No open order at this table"
              description="Open an order from the Hospitality → Orders tab, or seat a walk-in guest."
              cta={{ label: "Go to Orders", onClick: () => navigate("/hospitality?tab=orders"), icon: UtensilsCrossed }}
            />
          </div>
        </section>
      )}

      {/* Upcoming reservations */}
      <section>
        <h2 className="text-[13px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          Reservations
        </h2>
        {reservations.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No upcoming reservations for this table.</p>
        ) : (
          <ul className="rounded-lg border border-border divide-y divide-border/60">
            {reservations.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="flex-1">
                  {r.guest_name}
                  {r.party_size ? <span className="text-muted-foreground"> · {r.party_size} people</span> : null}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {new Date(r.arrival_at).toLocaleString(intlLocale(), { dateStyle: "medium", timeStyle: "short" })}
                </span>
                <Badge variant="outline" className="text-[10px] capitalize">{r.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Past sales */}
      <section>
        <h2 className="text-[13px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          Recent paid orders
        </h2>
        {pastSales.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No history yet.</p>
        ) : (
          <ul className="rounded-lg border border-border divide-y divide-border/60">
            {pastSales.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                <Button
                  variant="link"
                  className="p-0 h-auto text-sm"
                  onClick={() => navigate(`/sales/${s.id}`)}
                >
                  #{s.sale_number}
                </Button>
                <span className="flex-1 text-xs text-muted-foreground">
                  {new Date(s.created_at).toLocaleString(intlLocale(), { dateStyle: "medium", timeStyle: "short" })}
                </span>
                <span className="font-mono tabular-nums">{KES(s.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
