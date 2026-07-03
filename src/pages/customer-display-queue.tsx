/**
 * Customer Display — Queue Board mode.
 *
 * Runs in the customer-display Tauri window when the operator selects
 * the "Queue board" mode in Settings → Customer Display. Mirrors how
 * QSR chains (McDonald's, KFC, hotel buffets) surface live order
 * status to guests: a single wall-mounted screen showing
 *
 *   PREPARING        |        READY
 *   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *   #00045 · T12     |   #00041 · T4
 *   #00046 · T03     |   #00043 · Takeaway
 *   …                |   …
 *
 * Big numbers, server name, age tag, and a chime whenever a new order
 * lands in the READY column so customers near the screen look up.
 *
 * Data: polls `hospitality_orders` every 2 seconds (filtered by
 * non-paid / non-voided / non-served). Updates feel real-time at the
 * customer-facing distance without burning CPU.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { query } from "@/lib/db";
import { ForkKnife, BellRinging, Clock } from "@phosphor-icons/react";
import { OmnixLogo } from "@/components/omnix-logo";

interface QueueOrder {
  id: string;
  order_number: string;
  status: "open" | "sent" | "preparing" | "ready" | "served" | "paid" | "voided";
  table_code: string | null;
  table_name: string | null;
  order_type: "dine_in" | "takeaway" | "delivery" | "room_service";
  customer_name: string | null;
  item_count: number;
  opened_at: string;
  party_size: number | null;
  room_id: string | null;
}

const POLL_MS = 2000;
const REMOVE_AFTER_READY_MS = 10 * 60 * 1000; // hide ready orders after 10 min

export function CustomerDisplayQueuePage() {
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const previousReadyIds = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    let cancelled = false;
    const tick = async () => {
      try {
        const rows = await query<QueueOrder>(
          `SELECT o.id, o.order_number, o.status, o.order_type, o.opened_at,
                  o.party_size, o.room_id,
                  dt.table_code AS table_code,
                  dt.name AS table_name,
                  c.name AS customer_name,
                  (SELECT COUNT(*) FROM hospitality_order_items oi WHERE oi.order_id = o.id AND oi.status != 'voided') AS item_count
             FROM hospitality_orders o
             LEFT JOIN dining_tables dt ON dt.id = o.table_id
             LEFT JOIN customers c ON c.id = o.customer_id
            WHERE o.status NOT IN ('paid', 'voided')
            ORDER BY datetime(o.opened_at) ASC`,
        );
        if (cancelled) return;
        // Hide orders that have been READY for > REMOVE_AFTER_READY_MS so
        // the board doesn't accumulate stale entries when the cashier
        // forgets to mark them served / paid.
        const cutoff = Date.now() - REMOVE_AFTER_READY_MS;
        const visible = rows.filter((r) => {
          if (r.status !== "ready") return true;
          return new Date(r.opened_at).getTime() > cutoff;
        });
        setOrders(visible);

        // Audio chime when a new order moves into READY.
        const currentReady = new Set(visible.filter((o) => o.status === "ready").map((o) => o.id));
        for (const id of currentReady) {
          if (!previousReadyIds.current.has(id)) {
            playChime();
            break;
          }
        }
        previousReadyIds.current = currentReady;
      } catch { /* hospitality tables not present on cold boot — silent */ }
    };
    tick();
    timer = window.setInterval(tick, POLL_MS);
    return () => { cancelled = true; if (timer) window.clearInterval(timer); };
  }, []);

  function playChime() {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      // Two-tone ascending bell — classic "order ready" sound, ~0.55s total.
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch { /* audio blocked by autoplay policy until first user gesture */ }
  }

  const preparing = useMemo(
    () => orders.filter((o) => o.status === "open" || o.status === "sent" || o.status === "preparing"),
    [orders],
  );
  const ready = useMemo(() => orders.filter((o) => o.status === "ready"), [orders]);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col">
      <header className="px-12 py-6 flex items-center justify-between border-b border-stone-800">
        <div className="flex items-center gap-4">
          <OmnixLogo size={42} />
          <div className="leading-tight">
            <div className="text-xs font-medium uppercase tracking-[0.22em] text-stone-400">
              Kitchen status
            </div>
            <div className="text-2xl font-semibold">Order board</div>
          </div>
        </div>
        <Clockface />
      </header>

      <main className="flex-1 grid grid-cols-2 divide-x divide-stone-800 overflow-hidden">
        {/* PREPARING column */}
        <Column
          title="Preparing"
          subtitle="In the kitchen"
          accent="amber"
          icon={<ForkKnife className="size-6 text-amber-400" weight="duotone" />}
          orders={preparing}
        />
        {/* READY column */}
        <Column
          title="Ready"
          subtitle="Please come to the counter"
          accent="emerald"
          icon={<BellRinging className="size-6 text-emerald-400" weight="duotone" />}
          orders={ready}
          pulse
        />
      </main>
    </div>
  );
}

function Column({
  title, subtitle, accent, icon, orders, pulse,
}: {
  title: string;
  subtitle: string;
  accent: "amber" | "emerald";
  icon: React.ReactNode;
  orders: QueueOrder[];
  pulse?: boolean;
}) {
  const accentBar = accent === "amber" ? "bg-amber-500" : "bg-emerald-500";
  const accentText = accent === "amber" ? "text-amber-300" : "text-emerald-300";
  return (
    <section className="flex flex-col min-h-0 overflow-hidden">
      <div className={`h-1.5 ${accentBar}`} />
      <header className="px-10 pt-8 pb-5 flex items-center gap-4">
        {icon}
        <div className="leading-tight">
          <h2 className="text-5xl font-bold tracking-tight">{title}</h2>
          <p className="text-base text-stone-400 mt-1">{subtitle}</p>
        </div>
        <span className={`ml-auto text-3xl font-mono tabular-nums ${accentText}`}>
          {orders.length}
        </span>
      </header>
      <div className="flex-1 overflow-y-auto px-10 pb-10 grid grid-cols-1 lg:grid-cols-2 gap-4 auto-rows-min content-start">
        {orders.length === 0 ? (
          <div className="col-span-full text-center text-stone-600 py-20 text-lg italic">
            No orders.
          </div>
        ) : (
          orders.map((o) => <OrderCard key={o.id} order={o} pulse={pulse} />)
        )}
      </div>
    </section>
  );
}

function OrderCard({ order, pulse }: { order: QueueOrder; pulse?: boolean }) {
  const age = useAgeMinutes(order.opened_at);
  const tableText = order.order_type === "room_service" && order.room_id
    ? `Room ${order.room_id.slice(-4)}`
    : order.table_code
    ? `Table ${order.table_code}`
    : order.order_type === "takeaway"
      ? "Takeaway"
      : order.order_type === "delivery"
        ? "Delivery"
        : order.order_type === "room_service"
          ? "Room service"
          : "Counter";
  return (
    <article
      className={
        "rounded-2xl border border-stone-800 bg-stone-900/60 px-6 py-5 flex flex-col " +
        (pulse ? "ring-2 ring-emerald-500/40 animate-pulse-soft" : "")
      }
    >
      <div className="flex items-baseline justify-between">
        <div className="text-5xl font-bold font-mono tabular-nums tracking-tight text-white">
          {/* Last 4-5 chars of the order number, like "#00045". */}
          #{order.order_number.replace(/^ORD-/, "")}
        </div>
        <span className="text-base text-stone-400 inline-flex items-center gap-1.5 font-mono tabular-nums">
          <Clock className="size-4 opacity-60" /> {age}m
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between text-stone-300">
        <span className="text-xl font-medium">
          {tableText}
          {order.party_size ? <span className="ml-2 text-sm text-stone-500 font-mono">· {order.party_size} guest{order.party_size === 1 ? "" : "s"}</span> : null}
        </span>
        <span className="text-sm text-stone-500 font-mono tabular-nums">
          {order.item_count} item{order.item_count !== 1 ? "s" : ""}
        </span>
      </div>
      {order.customer_name && (
        <div className="text-sm text-stone-500 mt-1.5 truncate">{order.customer_name}</div>
      )}
    </article>
  );
}

function Clockface() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  return (
    <div className="text-right leading-tight">
      <div className="text-4xl font-mono tabular-nums text-white">{time}</div>
      <div className="text-sm text-stone-500">{date}</div>
    </div>
  );
}

function useAgeMinutes(openedAt: string): number {
  const [m, setM] = useState(() => Math.max(0, Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000)));
  useEffect(() => {
    const t = window.setInterval(() => {
      setM(Math.max(0, Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000)));
    }, 30000);
    return () => window.clearInterval(t);
  }, [openedAt]);
  return m;
}
