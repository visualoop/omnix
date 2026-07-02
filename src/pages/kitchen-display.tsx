/**
 * Kitchen Display Screen (KDS) — live board of incoming tickets per station.
 *
 * Reads hospitality_orders + hospitality_order_items, groups by station.
 * Each ticket shows elapsed time, guest count, and a Bump button to clear it.
 * Auto-refreshes every 5s. Full-screen friendly for a kitchen TV.
 */
import { useEffect, useState, useCallback } from "react";
import { CookingPot, Timer, Check, ArrowsOut } from "@phosphor-icons/react";
import { query, execute } from "@/lib/db";
import { intlLocale } from "@/lib/intl";
import { useF11Fullscreen } from "@/hooks/use-f11-fullscreen";

import { BackButton } from "@/components/ui/back-button";
const REFRESH_MS = 5_000;

interface TicketRow {
  order_id: string;
  order_number: string;
  table_name: string | null;
  waiter_name: string | null;
  station_id: string | null;
  station_name: string | null;
  item_id: string;
  item_name: string;
  quantity: number;
  notes: string | null;
  sent_at: string;
  status: string;
}

interface Ticket {
  order_id: string;
  order_number: string;
  table_name: string | null;
  waiter_name: string | null;
  station_id: string | null;
  station_name: string;
  sent_at: string;
  items: TicketRow[];
}

async function loadTickets(): Promise<Map<string, Ticket[]>> {
  // Fetch every not-yet-served item + its station. Group by (order, station).
  const rows = await query<TicketRow>(
    `SELECT
        o.id AS order_id,
        o.order_number,
        dt.name AS table_name,
        e.full_name AS waiter_name,
        oi.station_id,
        COALESCE(ks.name, 'Kitchen') AS station_name,
        oi.id AS item_id,
        oi.name AS item_name,
        oi.quantity,
        oi.notes,
        oi.sent_at,
        oi.status
     FROM hospitality_order_items oi
     JOIN hospitality_orders o ON o.id = oi.order_id
     LEFT JOIN dining_tables dt ON dt.id = o.table_id
     LEFT JOIN employees e ON e.id = o.waiter_id
     LEFT JOIN kitchen_stations ks ON ks.id = oi.station_id
     WHERE oi.status IN ('sent', 'preparing')
       AND oi.sent_at IS NOT NULL
     ORDER BY oi.sent_at ASC`,
  ).catch(() => []);

  const map = new Map<string, Ticket[]>();
  for (const r of rows) {
    const stationKey = r.station_id ?? "unassigned";
    const stationName = r.station_name || "Kitchen";
    const list = map.get(stationKey) ?? [];
    let ticket = list.find((t) => t.order_id === r.order_id);
    if (!ticket) {
      ticket = {
        order_id: r.order_id,
        order_number: r.order_number,
        table_name: r.table_name,
        waiter_name: r.waiter_name,
        station_id: r.station_id,
        station_name: stationName,
        sent_at: r.sent_at,
        items: [],
      };
      list.push(ticket);
      map.set(stationKey, list);
    }
    ticket.items.push(r);
  }
  return map;
}

function elapsedMinutes(sentAt: string): number {
  const then = new Date(sentAt.replace(" ", "T") + "Z").getTime();
  return Math.floor((Date.now() - then) / 60_000);
}

function elapsedColor(minutes: number): string {
  if (minutes < 5) return "text-emerald-600 bg-emerald-500/10 border-emerald-500/40";
  if (minutes < 12) return "text-amber-600 bg-amber-500/10 border-amber-500/40";
  return "text-red-600 bg-red-500/10 border-red-500/40";
}

async function bumpTicket(orderId: string, stationId: string | null): Promise<void> {
  await execute(
    `UPDATE hospitality_order_items
     SET status = 'ready', ready_at = datetime('now')
     WHERE order_id = ?1
       AND status IN ('sent', 'preparing')
       AND (?2 IS NULL OR station_id = ?2)`,
    [orderId, stationId],
  );
}

export function KitchenDisplayPage() {
  const [stations, setStations] = useState<Map<string, Ticket[]>>(new Map());
  const [loading, setLoading] = useState(true);
  useF11Fullscreen();

  const refresh = useCallback(async () => {
    try {
      setStations(await loadTickets());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(t);
  }, [refresh]);

  // Re-render every 15s so elapsed timers keep ticking even without new data.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const handleBump = async (t: Ticket) => {
    await bumpTicket(t.order_id, t.station_id);
    refresh();
  };

  const stationList = Array.from(stations.entries());

  return (
    <div className="min-h-screen bg-background p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CookingPot className="h-5 w-5 text-primary" />
          <BackButton fallback="/hospitality" />
          <h1 className="text-lg font-semibold">Kitchen Display</h1>
          <span className="text-[12px] text-muted-foreground">
            Live · {new Date().toLocaleTimeString(intlLocale())}
          </span>
        </div>
        <div className="text-[12px] text-muted-foreground flex items-center gap-2">
          <ArrowsOut className="h-3.5 w-3.5" /> F11 for full screen
        </div>
      </header>

      {loading ? (
        <div className="py-24 text-center text-muted-foreground">Loading…</div>
      ) : stationList.length === 0 ? (
        <div className="py-24 text-center">
          <CookingPot className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <div className="text-lg text-muted-foreground">All caught up</div>
          <div className="text-[13px] text-muted-foreground mt-1">
            New tickets appear here the moment they&rsquo;re sent to the kitchen.
          </div>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(stationList.length, 4)}, minmax(280px, 1fr))` }}>
          {stationList.map(([stationKey, tickets]) => (
            <div key={stationKey} className="rounded-lg border border-border bg-card">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-muted/50">
                <h2 className="text-[13px] font-semibold uppercase tracking-wider">{tickets[0]?.station_name || "Kitchen"}</h2>
                <span className="text-[11px] text-muted-foreground">{tickets.length}</span>
              </div>
              <div className="p-2 space-y-2 max-h-[calc(100vh-140px)] overflow-y-auto">
                {tickets.map((t) => {
                  const mins = elapsedMinutes(t.sent_at);
                  return (
                    <div key={`${t.order_id}-${stationKey}`} className={`rounded-md border-l-4 border p-2.5 ${elapsedColor(mins)}`}>
                      <div className="flex items-center justify-between text-[12px] mb-1">
                        <span className="font-semibold">
                          #{t.order_number} · {t.table_name || "Takeaway"}
                        </span>
                        <span className="inline-flex items-center gap-0.5 font-mono">
                          <Timer className="h-3 w-3" /> {mins}m
                        </span>
                      </div>
                      <ul className="text-[13.5px] space-y-0.5">
                        {t.items.map((it) => (
                          <li key={it.item_id} className="flex">
                            <span className="font-mono text-muted-foreground w-6">{it.quantity}×</span>
                            <span className="flex-1">
                              {it.item_name}
                              {it.notes && (
                                <span className="block text-[12px] italic text-amber-700 pl-1">! {it.notes}</span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => handleBump(t)}
                        className="mt-2 w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded bg-background text-[12.5px] font-medium hover:bg-accent"
                      >
                        <Check className="h-3.5 w-3.5" /> Bump
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
