/**
 * Hospitality module pages — Batch 2 foundation: dashboard, table board, menu.
 * Order lifecycle / kitchen / rooms / folios pages arrive in Tasks 23-26.
 * Flat, theme-token UI per the Omnix design system.
 */
import { useEffect, useState } from "react";
import { UtensilsCrossed, LayoutGrid, BookOpen, Plus, Loader2, ChefHat, Send, ChevronRight, ArrowLeft, BedDouble, CalendarDays, Sparkles, FileText, ClipboardList, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  listAreas, listTables, createArea, createTable, setTableStatus,
  listMenuItems, createMenuItem, setMenuItemActive,
  openOrder, listActiveOrders, listOrderItems, addOrderItem, sendToKitchen,
  kitchenQueue, bumpItem, markServed, payOrder, serviceChargePercent,
  listRoomTypes, createRoomType, listRooms, createRoom, setRoomStatus,
  listBookings, createBooking, checkIn, checkOut, folioBalance, postFolioPayment,
  listRecipes, recipeCost, restaurantReport, hotelReport,
  type DiningArea, type DiningTable, type MenuItem,
  type HospitalityOrder, type HospitalityOrderItem,
  type RoomType, type Room, type Booking, type RecipeRow,
  type RestaurantReport, type HotelReport,
} from "@/services/hospitality";
import { getPaymentMethods, type PaymentMethod } from "@/services/sales";
import { useAuthStore } from "@/stores/auth";
import { query } from "@/lib/db";
import { prompt, confirm } from "@/components/ui/confirm-dialog";

const KES = (n: number) => "KES " + n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function PageHead({ icon: Icon, title, subtitle, action }: { icon: typeof UtensilsCrossed; title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Icon className="h-5 w-5 text-rose-600 dark:text-rose-400" /> {title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

const TABLE_STATUS: Record<string, string> = {
  available: "border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
  occupied: "border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400",
  reserved: "border-blue-500/40 bg-blue-500/5 text-blue-600 dark:text-blue-400",
  cleaning: "border-muted bg-muted/30 text-muted-foreground",
  inactive: "border-border bg-muted/20 text-muted-foreground",
};

// ─── Dashboard ───────────────────────────────────────────────────────────────

export function HospitalityDashboardPage() {
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [menuCount, setMenuCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listTables(), listMenuItems()]).then(([t, m]) => {
      setTables(t); setMenuCount(m.length);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <CenterSpin />;
  const occupied = tables.filter((t) => t.status === "occupied").length;

  return (
    <div>
      <PageHead icon={UtensilsCrossed} title="Hospitality Dashboard" subtitle="Tables, menu, and service at a glance." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Tables" value={String(tables.length)} />
        <Kpi label="Occupied" value={String(occupied)} />
        <Kpi label="Free" value={String(tables.length - occupied)} />
        <Kpi label="Menu items" value={String(menuCount)} />
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1 font-mono tabular-nums">{value}</div>
    </CardContent></Card>
  );
}

// ─── Table board ─────────────────────────────────────────────────────────────

export function HospitalityTablesPage() {
  const [areas, setAreas] = useState<DiningArea[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([listAreas(), listTables()]).then(([a, t]) => { setAreas(a); setTables(t); }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const addArea = async () => {
    const name = await prompt({ title: "New dining area", placeholder: "e.g. Main Hall, Terrace", required: true });
    if (!name?.trim()) return;
    try { await createArea(name.trim()); load(); } catch (e) { toast.error(String(e)); }
  };
  const addTable = async () => {
    const code = await prompt({ title: "New table", placeholder: "Table code, e.g. T1", required: true });
    if (!code?.trim()) return;
    try {
      await createTable({ areaId: areas[0]?.id ?? null, code: code.trim(), name: `Table ${code.trim()}`, seats: 4 });
      load();
    } catch (e) { toast.error(String(e)); }
  };
  const cycleStatus = async (t: DiningTable) => {
    const order = ["available", "occupied", "reserved", "cleaning"];
    const next = order[(order.indexOf(t.status) + 1) % order.length];
    try { await setTableStatus(t.id, next); load(); } catch (e) { toast.error(String(e)); }
  };

  if (loading) return <CenterSpin />;

  return (
    <div>
      <PageHead
        icon={LayoutGrid}
        title="Tables"
        subtitle="Floor plan and table status. Tap a table to cycle its status."
        action={
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={addArea}><Plus className="h-3.5 w-3.5 mr-1" /> Area</Button>
            <Button size="sm" className="cursor-pointer" onClick={addTable}><Plus className="h-3.5 w-3.5 mr-1" /> Table</Button>
          </div>
        }
      />
      {tables.length === 0 ? (
        <EmptyHint text="No tables yet. Add a dining area, then tables." />
      ) : (
        <div className="space-y-5">
          {(areas.length ? areas : [{ id: null, name: "Tables" } as unknown as DiningArea]).map((area) => {
            const areaTables = tables.filter((t) => t.area_id === (area.id ?? null) || (!area.id && !t.area_id));
            if (areaTables.length === 0) return null;
            return (
              <div key={area.id ?? "none"}>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">{area.name}</div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                  {areaTables.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => cycleStatus(t)}
                      className={cn("rounded-lg border p-3 text-left transition-colors cursor-pointer hover:opacity-80", TABLE_STATUS[t.status])}
                    >
                      <div className="text-sm font-semibold">{t.table_code}</div>
                      <div className="text-[10px] mt-1 capitalize">{t.status}</div>
                      <div className="text-[10px] text-muted-foreground">{t.seats} seats</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Menu ────────────────────────────────────────────────────────────────────

export function HospitalityMenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => { setLoading(true); listMenuItems().then(setItems).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const addItem = async () => {
    const name = await prompt({ title: "New menu item", placeholder: "Item name", required: true });
    if (!name?.trim()) return;
    const priceStr = await prompt({ title: `Dine-in price for "${name.trim()}"`, placeholder: "Price (KES)", defaultValue: "0" });
    if (priceStr === null) return;
    try {
      await createMenuItem({ name: name.trim(), dineInPrice: parseFloat(priceStr || "0") || 0 });
      load();
    } catch (e) { toast.error(String(e)); }
  };
  const toggle = async (m: MenuItem) => {
    try { await setMenuItemActive(m.id, !m.active); load(); } catch (e) { toast.error(String(e)); }
  };

  if (loading) return <CenterSpin />;

  return (
    <div>
      <PageHead
        icon={BookOpen}
        title="Menu"
        subtitle="Dishes, categories, and prices."
        action={<Button size="sm" className="cursor-pointer" onClick={addItem}><Plus className="h-3.5 w-3.5 mr-1" /> Menu item</Button>}
      />
      {items.length === 0 ? (
        <EmptyHint text="No menu items yet." />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Item</th>
                <th className="text-left px-3 py-2">Category</th>
                <th className="text-right px-3 py-2">Dine-in</th>
                <th className="text-right px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                  <td className="px-3 py-2 font-medium">{m.menu_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{m.category ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{m.dine_in_price != null ? KES(m.dine_in_price) : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => toggle(m)} className="cursor-pointer">
                      <Badge variant="outline" className={cn("text-[10px]", m.active ? "bg-emerald-500/10 text-emerald-600" : "text-muted-foreground")}>
                        {m.active ? "Active" : "Hidden"}
                      </Badge>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Orders ──────────────────────────────────────────────────────────────────

const ITEM_STATUS: Record<string, string> = {
  new: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  preparing: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  ready: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  served: "bg-emerald-600 text-white",
  voided: "bg-red-500/10 text-red-600 dark:text-red-400",
};

export function HospitalityOrdersPage() {
  const userId = useAuthStore((s) => s.user?.id);
  const [orders, setOrders] = useState<HospitalityOrder[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [items, setItems] = useState<HospitalityOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [paying, setPaying] = useState(false);
  const [scPct, setScPct] = useState(0);
  const [tip, setTip] = useState(0);

  const loadOrders = () => listActiveOrders().then(setOrders);
  useEffect(() => { Promise.all([loadOrders(), listMenuItems().then(setMenu), getPaymentMethods().then(setMethods)]).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (selected) listOrderItems(selected).then(setItems); else setItems([]); }, [selected]);
  useEffect(() => {
    const o = orders.find((x) => x.id === selected);
    if (o) serviceChargePercent(o.order_type).then(setScPct);
  }, [selected, orders]);

  const newOrder = async () => {
    try {
      const id = await openOrder({ orderType: "dine_in", userId });
      await loadOrders();
      setSelected(id);
      toast.success("Order opened");
    } catch (e) { toast.error(String(e)); }
  };
  const addItem = async (m: MenuItem) => {
    if (!selected) return;
    try {
      await addOrderItem(selected, { productId: m.product_id, menuItemId: m.id, stationId: m.station_id, name: m.menu_name, quantity: 1, unitPrice: m.dine_in_price ?? 0 });
      listOrderItems(selected).then(setItems);
    } catch (e) { toast.error(String(e)); }
  };
  const send = async () => {
    if (!selected) return;
    try { await sendToKitchen(selected); listOrderItems(selected).then(setItems); loadOrders(); toast.success("Sent to kitchen"); }
    catch (e) { toast.error(String(e)); }
  };
  const pay = async (total: number) => {
    if (!selected || !methods[0]) { toast.error("No payment method configured"); return; }
    setPaying(true);
    const sc = total * (scPct / 100);
    const grand = total + sc + tip;
    try {
      await payOrder(
        selected,
        [{ method_id: methods[0].id, method_name: methods[0].name, amount: grand }],
        userId ?? "",
        { serviceChargePercent: scPct, tipAmount: tip },
      );
      toast.success("Paid & table freed");
      setSelected(null);
      setTip(0);
      loadOrders();
    } catch (e) { toast.error(String(e)); } finally { setPaying(false); }
  };

  if (loading) return <CenterSpin />;

  if (selected) {
    const order = orders.find((o) => o.id === selected);
    const total = items.filter((i) => i.status !== "voided").reduce((s, i) => s + i.line_total, 0);
    const hasUnsent = items.some((i) => i.status === "new");
    return (
      <div>
        <PageHead
          icon={UtensilsCrossed}
          title={order?.order_number ?? "Order"}
          subtitle="Add menu items, then send to the kitchen."
          action={<Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setSelected(null)}><ArrowLeft className="h-3.5 w-3.5 mr-1" /> Orders</Button>}
        />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4">
          {/* Current order */}
          <Card><CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium">Order</div>
              <Button size="sm" className="cursor-pointer" disabled={!hasUnsent} onClick={send}><Send className="h-3.5 w-3.5 mr-1" /> Send to kitchen</Button>
            </div>
            {items.length === 0 ? <EmptyHint text="No items yet. Tap a menu item to add." /> : (
              <div className="space-y-1.5">
                {items.map((i) => (
                  <div key={i.id} className="flex items-center justify-between text-[13px] border-b border-border pb-1.5">
                    <span>{i.quantity}× {i.name}</span>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-[9px]", ITEM_STATUS[i.status])}>{i.status}</Badge>
                      <span className="font-mono tabular-nums">{KES(i.line_total)}</span>
                    </span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 text-sm font-semibold"><span>Total</span><span className="font-mono tabular-nums">{KES(total)}</span></div>
                {/* Service charge + tip + pay */}
                <div className="border-t border-border pt-2 mt-2 space-y-2">
                  <div className="flex items-center justify-between text-[13px]">
                    <label className="text-muted-foreground">Service charge %</label>
                    <input type="number" value={scPct} onChange={(e) => setScPct(parseFloat(e.target.value) || 0)} className="w-20 h-7 rounded border border-input bg-background px-2 text-right text-[13px]" />
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <label className="text-muted-foreground">Tip (waiter)</label>
                    <input type="number" value={tip} onChange={(e) => setTip(parseFloat(e.target.value) || 0)} className="w-24 h-7 rounded border border-input bg-background px-2 text-right text-[13px]" />
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Grand total</span>
                    <span className="font-mono tabular-nums">{KES(total + total * (scPct / 100) + tip)}</span>
                  </div>
                  <Button size="sm" className="w-full cursor-pointer" disabled={paying || total <= 0} onClick={() => pay(total)}>
                    {paying ? "Processing…" : `Pay ${KES(total + total * (scPct / 100) + tip)}`}
                  </Button>
                </div>
              </div>
            )}
          </CardContent></Card>
          {/* Menu grid */}
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Menu</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {menu.map((m) => (
                <button key={m.id} onClick={() => addItem(m)} className="rounded-lg border border-border p-3 text-left hover:bg-accent/30 transition-colors cursor-pointer">
                  <div className="text-[13px] font-medium truncate">{m.menu_name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{m.dine_in_price != null ? KES(m.dine_in_price) : "—"}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHead
        icon={UtensilsCrossed}
        title="Orders"
        subtitle="Active tabs and tickets."
        action={<Button size="sm" className="cursor-pointer" onClick={newOrder}><Plus className="h-3.5 w-3.5 mr-1" /> New order</Button>}
      />
      {orders.length === 0 ? <EmptyHint text="No active orders. Open one to start." /> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {orders.map((o) => (
            <button key={o.id} onClick={() => setSelected(o.id)} className="rounded-lg border border-border p-3 text-left hover:bg-accent/30 transition-colors cursor-pointer">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{o.order_number}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-[11px] text-muted-foreground mt-1 capitalize">{o.order_type.replace("_", " ")}</div>
              <Badge variant="outline" className="text-[9px] mt-1.5">{o.status}</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Kitchen display ─────────────────────────────────────────────────────────

export function HospitalityKitchenPage() {
  const [queue, setQueue] = useState<Array<HospitalityOrderItem & { order_number: string; station_name: string | null }>>([]);
  const [loading, setLoading] = useState(true);

  const load = () => kitchenQueue().then(setQueue).finally(() => setLoading(false));
  useEffect(() => {
    load();
    const t = setInterval(load, 10_000); // refresh kitchen display
    return () => clearInterval(t);
  }, []);

  const bump = async (id: string) => { try { await bumpItem(id); load(); } catch (e) { toast.error(String(e)); } };
  const serve = async (id: string) => { try { await markServed(id); load(); } catch (e) { toast.error(String(e)); } };

  if (loading) return <CenterSpin />;

  const stations = [...new Set(queue.map((q) => q.station_name ?? "Kitchen"))];

  return (
    <div>
      <PageHead icon={ChefHat} title="Kitchen Display" subtitle="Live tickets by station. Bump items as they progress." />
      {queue.length === 0 ? <EmptyHint text="No tickets in the kitchen." /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {stations.map((station) => (
            <div key={station}>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">{station}</div>
              <div className="space-y-2">
                {queue.filter((q) => (q.station_name ?? "Kitchen") === station).map((q) => (
                  <Card key={q.id}><CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{q.quantity}× {q.name}</span>
                      <Badge variant="outline" className={cn("text-[9px]", ITEM_STATUS[q.status])}>{q.status}</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{q.order_number}</div>
                    {q.notes && <div className="text-[11px] text-amber-600 mt-1">Note: {q.notes}</div>}
                    <div className="flex gap-1.5 mt-2">
                      {q.status !== "ready" && <Button size="sm" variant="outline" className="cursor-pointer flex-1" onClick={() => bump(q.id)}>Bump →</Button>}
                      {q.status === "ready" && <Button size="sm" className="cursor-pointer flex-1" onClick={() => serve(q.id)}>Served</Button>}
                    </div>
                  </CardContent></Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Rooms ───────────────────────────────────────────────────────────────────

const ROOM_STATUS: Record<string, string> = {
  available: "border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
  occupied: "border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400",
  reserved: "border-blue-500/40 bg-blue-500/5 text-blue-600 dark:text-blue-400",
  dirty: "border-orange-500/40 bg-orange-500/5 text-orange-600 dark:text-orange-400",
  maintenance: "border-muted bg-muted/30 text-muted-foreground",
  out_of_order: "border-red-500/40 bg-red-500/5 text-red-600 dark:text-red-400",
};

export function HospitalityRoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [types, setTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => Promise.all([listRooms(), listRoomTypes()]).then(([r, t]) => { setRooms(r); setTypes(t); }).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const addType = async () => {
    const name = await prompt({ title: "New room type", placeholder: "e.g. Standard, Deluxe", required: true }); if (!name?.trim()) return;
    const rate = await prompt({ title: `Base rate for "${name.trim()}"`, placeholder: "Rate per night (KES)", defaultValue: "0" }); if (rate === null) return;
    try { await createRoomType({ name: name.trim(), baseRate: parseFloat(rate || "0") || 0 }); load(); } catch (e) { toast.error(String(e)); }
  };
  const addRoom = async () => {
    if (types.length === 0) { toast.error("Create a room type first"); return; }
    const num = await prompt({ title: "New room", placeholder: "Room number, e.g. 101", required: true }); if (!num?.trim()) return;
    try { await createRoom({ roomTypeId: types[0].id, roomNumber: num.trim() }); load(); } catch (e) { toast.error(String(e)); }
  };
  const cycle = async (r: Room) => {
    const next = r.status === "available" ? "dirty" : "available";
    try { await setRoomStatus(r.id, next); load(); } catch (e) { toast.error(String(e)); }
  };

  if (loading) return <CenterSpin />;
  return (
    <div>
      <PageHead icon={BedDouble} title="Rooms" subtitle="Room status board." action={
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="cursor-pointer" onClick={addType}><Plus className="h-3.5 w-3.5 mr-1" /> Type</Button>
          <Button size="sm" className="cursor-pointer" onClick={addRoom}><Plus className="h-3.5 w-3.5 mr-1" /> Room</Button>
        </div>} />
      {rooms.length === 0 ? <EmptyHint text="No rooms yet. Add a room type, then rooms." /> : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
          {rooms.map((r) => (
            <button key={r.id} onClick={() => cycle(r)} className={cn("rounded-lg border p-3 text-left transition-colors cursor-pointer hover:opacity-80", ROOM_STATUS[r.status])}>
              <div className="text-sm font-semibold">{r.room_number}</div>
              <div className="text-[10px] mt-1 capitalize">{r.status.replace("_", " ")}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Bookings + check-in ─────────────────────────────────────────────────────

export function HospitalityBookingsPage() {
  const userId = useAuthStore((s) => s.user?.id);
  const [bookings, setBookings] = useState<Array<Booking & { guest_name: string; room_number: string | null }>>([]);
  const [types, setTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => Promise.all([listBookings(), listRoomTypes(), listRooms()]).then(([b, t, r]) => { setBookings(b); setTypes(t); setRooms(r); }).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const newBooking = async () => {
    if (types.length === 0) { toast.error("Create a room type first (Rooms page)"); return; }
    const guest = await prompt({ title: "New booking", placeholder: "Guest name", required: true }); if (!guest?.trim()) return;
    const inDate = await prompt({ title: "Check-in date", placeholder: "YYYY-MM-DD", defaultValue: new Date().toISOString().slice(0, 10), required: true });
    const outDate = await prompt({ title: "Check-out date", placeholder: "YYYY-MM-DD", defaultValue: new Date(Date.now() + 86400000).toISOString().slice(0, 10), required: true });
    if (!inDate || !outDate) return;
    try {
      await createBooking({ guestName: guest.trim(), roomTypeId: types[0].id, checkIn: inDate, checkOut: outDate, ratePerNight: types[0].base_rate, userId });
      load(); toast.success("Booking created");
    } catch (e) { toast.error(String(e)); }
  };
  const doCheckIn = async (b: Booking) => {
    const free = rooms.filter((r) => r.room_type_id === b.room_type_id && r.status === "available");
    if (free.length === 0) { toast.error("No available room of this type"); return; }
    try { await checkIn(b.id, free[0].id); load(); toast.success(`Checked in to room ${free[0].room_number}`); } catch (e) { toast.error(String(e)); }
  };
  const doCheckOut = async (b: Booking) => {
    try { await checkOut(b.id); load(); toast.success("Checked out"); }
    catch (e) {
      if (await confirm({ title: "Outstanding balance", description: `${e}. Override and check out anyway?`, variant: "warning", confirmText: "Override & check out" })) { try { await checkOut(b.id, true); load(); toast.success("Checked out (override)"); } catch (e2) { toast.error(String(e2)); } }
    }
  };

  if (loading) return <CenterSpin />;
  return (
    <div>
      <PageHead icon={CalendarDays} title="Bookings" subtitle="Reservations, arrivals and departures." action={
        <Button size="sm" className="cursor-pointer" onClick={newBooking}><Plus className="h-3.5 w-3.5 mr-1" /> New booking</Button>} />
      {bookings.length === 0 ? <EmptyHint text="No active bookings." /> : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Booking</th>
                <th className="text-left px-3 py-2">Guest</th>
                <th className="text-left px-3 py-2">Dates</th>
                <th className="text-left px-3 py-2">Room</th>
                <th className="text-right px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                  <td className="px-3 py-2 font-mono">{b.booking_number}</td>
                  <td className="px-3 py-2 font-medium">{b.guest_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{b.check_in_date} → {b.check_out_date}</td>
                  <td className="px-3 py-2">{b.room_number ?? <Badge variant="outline" className="text-[10px]">{b.status}</Badge>}</td>
                  <td className="px-3 py-2 text-right">
                    {b.status === "reserved" && <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => doCheckIn(b)}>Check in</Button>}
                    {b.status === "checked_in" && <Button size="sm" className="cursor-pointer" onClick={() => doCheckOut(b)}>Check out</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Housekeeping ────────────────────────────────────────────────────────────

export function HospitalityHousekeepingPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => listRooms().then(setRooms).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  const clean = async (r: Room) => { try { await setRoomStatus(r.id, "available"); load(); toast.success(`Room ${r.room_number} ready`); } catch (e) { toast.error(String(e)); } };

  if (loading) return <CenterSpin />;
  const dirty = rooms.filter((r) => r.status === "dirty" || r.status === "maintenance");
  return (
    <div>
      <PageHead icon={Sparkles} title="Housekeeping" subtitle="Rooms needing attention." />
      {dirty.length === 0 ? <EmptyHint text="All rooms are clean." /> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {dirty.map((r) => (
            <Card key={r.id}><CardContent className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{r.room_number}</span>
                <Badge variant="outline" className={cn("text-[9px]", ROOM_STATUS[r.status])}>{r.status}</Badge>
              </div>
              <Button size="sm" variant="outline" className="w-full mt-2 cursor-pointer" onClick={() => clean(r)}>Mark ready</Button>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Folios ──────────────────────────────────────────────────────────────────

interface FolioRow { id: string; folio_number: string; guest_name: string; status: string; }

export function HospitalityFoliosPage() {
  const userId = useAuthStore((s) => s.user?.id);
  const [folios, setFolios] = useState<FolioRow[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const rows = await query<FolioRow>(
      `SELECT f.id, f.folio_number, g.full_name AS guest_name, f.status
       FROM guest_folios f JOIN bookings b ON b.id = f.booking_id JOIN guests g ON g.id = b.guest_id
       WHERE f.status = 'open' ORDER BY f.opened_at DESC`,
    );
    setFolios(rows);
    const bals: Record<string, number> = {};
    for (const f of rows) bals[f.id] = (await folioBalance(f.id)).balance;
    setBalances(bals);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const settle = async (f: FolioRow) => {
    const bal = balances[f.id] ?? 0;
    if (bal <= 0) { toast.info("Nothing to settle"); return; }
    try { await postFolioPayment(f.id, bal, "cash", userId); load(); toast.success("Folio settled"); } catch (e) { toast.error(String(e)); }
  };

  if (loading) return <CenterSpin />;
  return (
    <div>
      <PageHead icon={FileText} title="Guest Folios" subtitle="Open folios and balances." />
      {folios.length === 0 ? <EmptyHint text="No open folios." /> : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Folio</th>
                <th className="text-left px-3 py-2">Guest</th>
                <th className="text-right px-3 py-2">Balance</th>
                <th className="text-right px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {folios.map((f) => (
                <tr key={f.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                  <td className="px-3 py-2 font-mono">{f.folio_number}</td>
                  <td className="px-3 py-2 font-medium">{f.guest_name}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{KES(balances[f.id] ?? 0)}</td>
                  <td className="px-3 py-2 text-right">
                    {(balances[f.id] ?? 0) > 0 && <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => settle(f)}>Settle</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Recipes & costing ───────────────────────────────────────────────────────

export function HospitalityRecipesPage() {
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [costs, setCosts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listRecipes().then(async (rows) => {
      setRecipes(rows);
      const c: Record<string, number> = {};
      for (const r of rows) c[r.id] = await recipeCost(r.id);
      setCosts(c);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <CenterSpin />;
  return (
    <div>
      <PageHead icon={ClipboardList} title="Recipes & Costing" subtitle="Ingredient cost and food-cost % per dish." />
      {recipes.length === 0 ? <EmptyHint text="No recipes yet. Add recipes to track food cost." /> : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Dish</th>
                <th className="text-right px-3 py-2">Cost</th>
                <th className="text-right px-3 py-2">Price</th>
                <th className="text-right px-3 py-2">Food cost %</th>
              </tr>
            </thead>
            <tbody>
              {recipes.map((r) => {
                const cost = costs[r.id] ?? 0;
                const price = r.dine_in_price ?? 0;
                const pct = price > 0 ? Math.round((cost / price) * 100) : 0;
                return (
                  <tr key={r.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                    <td className="px-3 py-2 font-medium">{r.menu_name}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{KES(cost)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{KES(price)}</td>
                    <td className="px-3 py-2 text-right">
                      <Badge variant="outline" className={cn("text-[10px]", pct > 40 ? "bg-red-500/10 text-red-600" : pct > 30 ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600")}>
                        {pct}%
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Reports (restaurant + hotel) ────────────────────────────────────────────

export function HospitalityReportsPage() {
  const [rest, setRest] = useState<RestaurantReport | null>(null);
  const [hotel, setHotel] = useState<HotelReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([restaurantReport(), hotelReport()]).then(([r, h]) => { setRest(r); setHotel(h); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <CenterSpin />;
  return (
    <div>
      <PageHead icon={BarChart3} title="Hospitality Reports" subtitle="Restaurant covers + hotel occupancy." />
      <div className="space-y-5">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Restaurant</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Kpi label="Paid orders" value={String(rest?.orders ?? 0)} />
            <Kpi label="Covers" value={String(rest?.covers ?? 0)} />
            <Kpi label="Avg ticket" value={KES(rest?.avgTicket ?? 0)} />
          </div>
          {rest && rest.topCategories.length > 0 && (
            <Card className="mt-3"><CardContent className="p-4">
              <div className="text-sm font-medium mb-2">Top menu categories</div>
              <div className="space-y-1.5">
                {rest.topCategories.map((c) => (
                  <div key={c.category} className="flex justify-between text-[13px] border-b border-border pb-1">
                    <span>{c.category}</span><span className="font-mono tabular-nums">{KES(c.total)}</span>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          )}
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Hotel</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Occupancy" value={`${hotel?.occupancyPct ?? 0}%`} />
            <Kpi label="Occupied / total" value={`${hotel?.occupied ?? 0} / ${hotel?.totalRooms ?? 0}`} />
            <Kpi label="ADR" value={KES(hotel?.adr ?? 0)} />
            <Kpi label="RevPAR" value={KES(hotel?.revpar ?? 0)} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared ──────────────────────────────────────────────────────────────────

function CenterSpin() {
  return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
}
function EmptyHint({ text }: { text: string }) {
  return <div className="border border-dashed border-border rounded-lg py-12 text-center text-sm text-muted-foreground">{text}</div>;
}
