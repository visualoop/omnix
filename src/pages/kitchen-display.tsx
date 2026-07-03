/**
 * Kitchen Display Screen (KDS) — live board of incoming tickets per station.
 *
 * Reads hospitality_orders + hospitality_order_items, groups by station.
 * Each ticket shows elapsed time, guest count, and a Bump button to clear it.
 * Auto-refreshes every 5s. Full-screen friendly for a kitchen TV.
 *
 * v0.38.1 adds customization:
 *   - Station chip filter row (show only one station)
 *   - Font size toggle (S / M / L / XL) — kitchen tablets are 1-2m away
 *   - Audio cue on new ticket (Web Audio API, no assets)
 *   - Force-dark toggle (kitchens tend to have overhead LEDs)
 *   - Column layout (auto / 2 / 3 / 4)
 * All prefs persist to localStorage per device.
 */
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  CookingPot,
  Timer,
  Check,
  ArrowsOut,
  Gear as Settings,
  X as XIcon,
  SpeakerHigh,
  SpeakerX,
  Monitor,
} from "@phosphor-icons/react";
import { query, execute } from "@/lib/db";
import { intlLocale } from "@/lib/intl";
import { useF11Fullscreen } from "@/hooks/use-f11-fullscreen";
import {
  useKdsPrefs,
  playKdsAudioCue,
  FONT_SIZE_CLS,
  type KdsFontSize,
  type KdsColumnMode,
} from "@/hooks/use-kds-prefs";
import { cn } from "@/lib/utils";

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefs, setPrefs] = useKdsPrefs();
  const prevTicketIdsRef = useRef<Set<string>>(new Set());
  useF11Fullscreen();

  const fontCls = FONT_SIZE_CLS[prefs.fontSize];

  const refresh = useCallback(async () => {
    try {
      const next = await loadTickets();
      // Audio cue when a new ticket appears
      if (prefs.audioCue) {
        const nextIds = new Set<string>();
        for (const list of next.values()) {
          for (const t of list) nextIds.add(`${t.order_id}-${t.station_id ?? "u"}`);
        }
        const prev = prevTicketIdsRef.current;
        const hasNew = [...nextIds].some((id) => !prev.has(id));
        if (hasNew && prev.size > 0) playKdsAudioCue();
        prevTicketIdsRef.current = nextIds;
      } else {
        prevTicketIdsRef.current = new Set();
      }
      setStations(next);
    } finally {
      setLoading(false);
    }
  }, [prefs.audioCue]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const handleBump = async (t: Ticket) => {
    await bumpTicket(t.order_id, t.station_id);
    refresh();
  };

  const allStations = useMemo(() => {
    const seen = new Map<string, string>();
    for (const [key, tickets] of stations) {
      const name = tickets[0]?.station_name ?? "Kitchen";
      seen.set(key, name);
    }
    return Array.from(seen.entries());
  }, [stations]);

  const filteredStations = useMemo(() => {
    if (!prefs.stationFilter) return Array.from(stations.entries());
    return Array.from(stations.entries()).filter(([k]) => k === prefs.stationFilter);
  }, [stations, prefs.stationFilter]);

  const gridCols = prefs.columns === "auto"
    ? Math.min(filteredStations.length || 1, 4)
    : parseInt(prefs.columns, 10);

  return (
    <div className={cn("min-h-screen bg-background p-4 space-y-3", prefs.forceDark && "dark")}>
      <div className={cn(prefs.forceDark && "bg-background text-foreground -m-4 p-4 min-h-screen")}>
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CookingPot className="h-5 w-5 text-primary" />
          <BackButton fallback="/hospitality" />
          <h1 className={cn("font-semibold", fontCls.header)}>Kitchen Display</h1>
          <span className={cn("text-muted-foreground", fontCls.meta)}>
            Live · {new Date().toLocaleTimeString(intlLocale())}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              const { openCustomerDisplayQueue } = await import("@/lib/customer-display");
              try {
                await openCustomerDisplayQueue();
              } catch (e) {
                console.warn("[kds] order-board window failed to open:", e);
              }
            }}
            title="Open the guest-facing order board (PREPARING / READY) in a separate window"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border hover:bg-accent text-[12px] font-medium"
          >
            <Monitor className="h-3.5 w-3.5" /> Order board
          </button>
          <button
            onClick={() => setPrefs({ audioCue: !prefs.audioCue })}
            title={prefs.audioCue ? "Mute new-ticket beep" : "Unmute new-ticket beep"}
            className="p-1.5 rounded hover:bg-accent"
          >
            {prefs.audioCue ? <SpeakerHigh className="h-4 w-4" /> : <SpeakerX className="h-4 w-4 text-muted-foreground" />}
          </button>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="p-1.5 rounded hover:bg-accent"
            title="Customize display"
          >
            <Settings className="h-4 w-4" />
          </button>
          <span className={cn("text-muted-foreground inline-flex items-center gap-1", fontCls.meta)}>
            <ArrowsOut className="h-3.5 w-3.5" /> F11
          </span>
        </div>
      </header>

      {/* Settings panel — inline, collapsible. */}
      {settingsOpen && (
        <div className="rounded-lg border border-border bg-card p-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Text size</span>
            <div className="flex gap-1 border border-border rounded p-0.5">
              {(["sm", "md", "lg", "xl"] as KdsFontSize[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setPrefs({ fontSize: s })}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] font-medium",
                    prefs.fontSize === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Columns</span>
            <div className="flex gap-1 border border-border rounded p-0.5">
              {(["auto", "2", "3", "4"] as KdsColumnMode[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setPrefs({ columns: c })}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] font-medium",
                    prefs.columns === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-[12px]">
            <input
              type="checkbox"
              checked={prefs.forceDark}
              onChange={(e) => setPrefs({ forceDark: e.target.checked })}
              className="rounded border-border"
            />
            Force dark mode
          </label>

          {allStations.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Station</span>
              <button
                onClick={() => setPrefs({ stationFilter: null })}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-medium",
                  !prefs.stationFilter ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
                )}
              >
                All
              </button>
              {allStations.map(([key, name]) => (
                <button
                  key={key}
                  onClick={() => setPrefs({ stationFilter: key })}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] font-medium",
                    prefs.stationFilter === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => setSettingsOpen(false)}
            className="ml-auto p-1 rounded hover:bg-accent"
            title="Close"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center text-muted-foreground">Loading…</div>
      ) : filteredStations.length === 0 ? (
        <div className="py-24 text-center">
          <CookingPot className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <div className={cn("text-muted-foreground", fontCls.header)}>All caught up</div>
          <div className={cn("text-muted-foreground mt-1", fontCls.meta)}>
            New tickets appear here the moment they&rsquo;re sent to the kitchen.
          </div>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(280px, 1fr))` }}>
          {filteredStations.map(([stationKey, tickets]) => (
            <div key={stationKey} className="rounded-lg border border-border bg-card">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-muted/50">
                <h2 className={cn("font-semibold uppercase tracking-wider", fontCls.ticketHeader)}>
                  {tickets[0]?.station_name || "Kitchen"}
                </h2>
                <span className={cn("text-muted-foreground", fontCls.meta)}>{tickets.length}</span>
              </div>
              <div className="p-2 space-y-2 max-h-[calc(100vh-180px)] overflow-y-auto">
                {tickets.map((t) => {
                  const mins = elapsedMinutes(t.sent_at);
                  return (
                    <div key={`${t.order_id}-${stationKey}`} className={`rounded-md border-l-4 border p-2.5 ${elapsedColor(mins)}`}>
                      <div className={cn("flex items-center justify-between mb-1", fontCls.ticketHeader)}>
                        <span className="font-semibold">
                          #{t.order_number} · {t.table_name || "Takeaway"}
                        </span>
                        <span className="inline-flex items-center gap-0.5 font-mono">
                          <Timer className="h-3 w-3" /> {mins}m
                        </span>
                      </div>
                      <ul className={cn("space-y-0.5", fontCls.itemName)}>
                        {t.items.map((it) => (
                          <li key={it.item_id} className="flex">
                            <span className={cn("font-mono text-muted-foreground w-6", fontCls.itemQty)}>{it.quantity}×</span>
                            <span className="flex-1">
                              {it.item_name}
                              {it.notes && (
                                <span className={cn("block italic text-amber-700 pl-1", fontCls.notes)}>! {it.notes}</span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => handleBump(t)}
                        className={cn(
                          "mt-2 w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded bg-background font-medium hover:bg-accent",
                          fontCls.ticketHeader,
                        )}
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
    </div>
  );
}
