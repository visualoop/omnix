/**
 * Hospitality module pages — Batch 2 foundation: dashboard, table board, menu.
 * Order lifecycle / kitchen / rooms / folios pages arrive in Tasks 23-26.
 * Flat, theme-token UI per the Omnix design system.
 */
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bed as BedDouble,
  BookOpen,
  CalendarDots as CalendarDays,
  CaretRight as ChevronRight,
  CaretLeft as ChevronLeft,
  ChartBar as BarChart3,
  ChefHat,
  ClipboardText as ClipboardList,
  FileText,
  ForkKnife as UtensilsCrossed,
  GridFour as LayoutGrid,
  PaperPlaneTilt as Send,
  Plus,
  Sparkle as Sparkles,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  listAreas, listTables, createArea, createTable, setTableStatus,
  listMenuItems, createMenuItem, setMenuItemActive,
  openOrder, listActiveOrders, listOrderItems, addOrderItem, sendToKitchen,
  kitchenQueue, bumpItem, markServed, prepareOrderForPosCheckout, chargeOrderToRoom,
  listRoomTypes, createRoomType, listRooms, createRoom, setRoomStatus,
  listBookings, checkIn, checkOut, folioBalance, postFolioPayment,
  listRecipes, recipeCost, restaurantReport, hotelReport,
  menuAvailability, type MenuAvailability,
  get86s, type MenuItem86,
  menuItemsWithRecipe,
  listModifierGroupsForItem, type MenuModifierGroupFull,
  type DiningArea, type DiningTable, type MenuItem,
  type HospitalityOrder, type HospitalityOrderItem,
  type RoomType, type Room, type Booking, type RecipeRow,
  type RestaurantReport, type HotelReport,
} from "@/services/hospitality";
import { useAuthStore } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { query } from "@/lib/db";
import { confirm, prompt } from "@/components/ui/confirm-dialog";
import { MenuItemDialog, type MenuItemFormValues } from "@/components/hospitality/menu-item-dialog";
import { RoomPickerSheet } from "@/components/hospitality/room-picker-sheet";
import { ServicePeriodBadge } from "@/components/hospitality/service-period-badge";
import { ModifierPicker } from "@/components/hospitality/modifier-groups";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CompactFormDialog } from "@/components/hospitality/compact-form-dialog";
import { BookingDialog } from "@/components/hospitality/booking-dialog";
import { useNavigate, useSearchParams } from "react-router-dom";
import { money as KES } from "@/lib/money";
import {
  moduleAccent, ModuleMasthead, ModuleStat, ModuleSpinner,
} from "@/components/shared/module-kit";

const ACCENT = moduleAccent("hospitality");
/** Hospitality primary-action button colour (matches the rose accent). */
const BRAND_BTN = `${ACCENT.solid} ${ACCENT.solidHover}`;

/** Per-screen masthead — delegates to the shared module kit so every
 *  hospitality sub-page carries the same rose identity rule + eyebrow. */
function PageHead({ icon, title, subtitle, action }: { icon?: typeof UtensilsCrossed; title: string; subtitle: string; action?: React.ReactNode }) {
  void icon; // the accent rule replaces the per-title icon
  return <ModuleMasthead accent={ACCENT} title={title} subtitle={subtitle} actions={action} />;
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
  return <ModuleStat accent={ACCENT} label={label} value={value} />;
}

// ─── Table board ─────────────────────────────────────────────────────────────

export function HospitalityTablesPage() {
  const [areas, setAreas] = useState<DiningArea[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [areaDialog, setAreaDialog] = useState(false);
  const [tableDialog, setTableDialog] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    Promise.all([listAreas(), listTables()]).then(([a, t]) => { setAreas(a); setTables(t); }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

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
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setAreaDialog(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Area</Button>
            <Button size="sm" className={cn("cursor-pointer", BRAND_BTN)} onClick={() => setTableDialog(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Table</Button>
          </div>
        }
      />
      {tables.length === 0 && areas.length === 0 ? (
        <EmptyHint text="No tables yet. Add a dining area, then tables." />
      ) : (
        <div className="space-y-5">
          {(areas.length ? areas : [{ id: null, name: "Tables" } as unknown as DiningArea]).map((area) => {
            const areaTables = tables.filter((t) => t.area_id === (area.id ?? null) || (!area.id && !t.area_id));
            return (
              <div key={area.id ?? "none"}>
                {area.id ? (
                  <button
                    onClick={() => navigate(`/hospitality/areas/${area.id}`)}
                    className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 hover:text-foreground transition-colors"
                  >
                    {area.name} →
                  </button>
                ) : (
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">{area.name}</div>
                )}
                {areaTables.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground italic mb-3">
                    No tables in this area yet. Add tables from the button above.
                  </div>
                ) : (
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
                )}
              </div>
            );
          })}
        </div>
      )}

      <CompactFormDialog
        open={areaDialog}
        onClose={() => setAreaDialog(false)}
        title="New dining area"
        description="Group tables by location — e.g. Main Hall, Terrace, Garden."
        fields={[
          { name: "name", label: "Area name", placeholder: "Main Hall", required: true },
        ]}
        onSubmit={async (v) => { await createArea(v.name.trim()); load(); }}
      />

      <CompactFormDialog
        open={tableDialog}
        onClose={() => setTableDialog(false)}
        title="New table"
        description="One screen — code, seats, and which area it's in."
        fields={[
          { name: "code", label: "Table code", placeholder: "T1", required: true },
          { name: "seats", label: "Seats", type: "number", defaultValue: "4", min: 1, required: true },
          ...(areas.length > 0 ? [{
            name: "areaId",
            label: "Area",
            type: "select" as const,
            options: areas.map((a) => ({ value: String(a.id), label: a.name })),
            defaultValue: String(areas[0].id),
          }] : []),
        ]}
        submitLabel="Add table"
        onSubmit={async (v) => {
          const code = v.code.trim();
          const seats = parseInt(v.seats || "4", 10) || 4;
          const areaId = v.areaId ? v.areaId : (areas[0]?.id ?? null);
          await createTable({ areaId, code, name: `Table ${code}`, seats });
          load();
        }}
      />
    </div>
  );
}

// ─── Menu ────────────────────────────────────────────────────────────────────

export function HospitalityMenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemDialog, setItemDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [eightySixed, setEightySixed] = useState<MenuItem86[]>([]);
  const [withRecipe, setWithRecipe] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    Promise.all([
      listMenuItems({ hide86: false }),
      get86s(),
      menuItemsWithRecipe(),
    ]).then(([m, s, r]) => { setItems(m); setEightySixed(s); setWithRecipe(r); }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleSubmit = async (v: MenuItemFormValues) => {
    await createMenuItem({
      name: v.name,
      category: v.category || undefined,
      dineInPrice: v.dineInPrice,
      takeawayPrice: v.takeawayPrice,
      prepMinutes: v.prepTimeMin,
      imagePath: v.imagePath,
      allergens: v.allergens,
    });
    load();
  };
  const toggle = async (m: MenuItem) => {
    try { await setMenuItemActive(m.id, !m.active); load(); } catch (e) { toast.error(String(e)); }
  };

  if (loading) return <CenterSpin />;

  const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[];
  const filtered = items.filter((i) => {
    if (search && !i.menu_name.toLowerCase().includes(search.toLowerCase()) && !(i.category ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter && i.category !== categoryFilter) return false;
    return true;
  });
  const eightySixedIds = new Set(eightySixed.map((x) => x.menu_item_id));

  return (
    <div>
      <PageHead
        icon={BookOpen}
        title="Menu"
        subtitle="Dishes, categories, and prices."
        action={<Button size="sm" className={cn("cursor-pointer", BRAND_BTN)} onClick={() => setItemDialog(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Menu item</Button>}
      />

      {/* Search + category filter */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search menu items…"
          className="h-8 text-xs max-w-[240px]"
        />
        {categories.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => setCategoryFilter(null)}
              className={cn(
                "text-[11px] px-2 py-0.5 rounded-full border transition-colors",
                categoryFilter === null
                  ? "border-foreground/30 bg-foreground/[0.06] text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-full border transition-colors",
                  categoryFilter === c
                    ? "border-foreground/30 bg-foreground/[0.06] text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        ) : null}
        <div className="ml-auto text-[11px] text-muted-foreground font-mono tabular-nums">
          {filtered.length} of {items.length}
          {eightySixed.length > 0 ? <span className="ml-2 text-rose-600">· {eightySixed.length} 86'd</span> : null}
        </div>
      </div>

      <MenuItemDialog open={itemDialog} onClose={() => setItemDialog(false)} onSubmit={handleSubmit} />
      {filtered.length === 0 ? (
        <EmptyHint text={search || categoryFilter ? "No items match this filter." : "No menu items yet."} />
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
              {filtered.map((m) => (
                <tr
                  key={m.id}
                  className={cn(
                    "border-t border-border hover:bg-accent/30 transition-colors cursor-pointer",
                    eightySixedIds.has(m.id) ? "opacity-70" : "",
                  )}
                  onClick={() => navigate(`/hospitality/menu/${m.id}`)}
                >
                  <td className="px-3 py-2 font-medium">
                    <div className="flex items-center gap-2">
                      {m.image_path ? (
                        <img src={m.image_path} alt="" className="h-8 w-8 rounded object-cover border border-border" />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted grid place-items-center text-[10px] text-muted-foreground">—</div>
                      )}
                      <span>{m.menu_name}</span>
                      {eightySixedIds.has(m.id) ? (
                        <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/30 text-[10px] uppercase tracking-wide">86</Badge>
                      ) : null}
                      {!withRecipe.has(m.id) ? (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] uppercase tracking-wide" title="No recipe attached — selling this won't deduct any ingredients">
                          No recipe
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{m.category ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{m.dine_in_price != null ? KES(m.dine_in_price) : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={(e) => { e.stopPropagation(); toggle(m); }} className="cursor-pointer">
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
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);
  const [orders, setOrders] = useState<HospitalityOrder[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [items, setItems] = useState<HospitalityOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [scPct, setScPct] = useState(0);
  const [tip, setTip] = useState(0);
  const [orderType, setOrderType] = useState<"dine_in" | "room_service">("dine_in");
  const [roomFolios, setRoomFolios] = useState<Array<{ id: string; room: string; guest: string; balance: number }>>([]);
  const [showRoomPicker, setShowRoomPicker] = useState(false);
  const [chargingRoom, setChargingRoom] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Map<string, MenuAvailability>>(new Map());
  const [eightySixMap, setEightySixMap] = useState<Set<string>>(new Set());
  const [roomPickerOpen, setRoomPickerOpen] = useState(false);
  const [pendingPartySize, setPendingPartySize] = useState(1);
  const [modifierState, setModifierState] = useState<{
    menuItem: MenuItem;
    groups: MenuModifierGroupFull[];
    selections: Array<{ modifierName: string; optionName: string; priceDelta: number }>;
  } | null>(null);

  const loadOrders = () => listActiveOrders().then(setOrders);
  const loadAvailability = () => menuAvailability().then(setAvailability).catch(() => setAvailability(new Map()));
  useEffect(() => {
    Promise.all([
      loadOrders(),
      listMenuItems({ hide86: false }).then(setMenu),
      loadAvailability(),
      get86s().then((rows) => setEightySixMap(new Set(rows.map((r) => r.menu_item_id)))),
    ]).finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (selected) listOrderItems(selected).then(setItems); else setItems([]); }, [selected]);
  useEffect(() => {
    if (!selected) return;
    prepareOrderForPosCheckout(selected)
      .then((payload) => setScPct(payload.serviceChargePercent))
      .catch(() => setScPct(0));
  }, [selected, orders]);

  const openOrderWith = async (partySize: number, roomId?: string) => {
    try {
      const id = await openOrder({ orderType, userId, partySize, roomId });
      await loadOrders();
      setSelected(id);
      toast.success(`${orderType === "room_service" ? "Room service" : "Dine-in"} order opened`);
    } catch (e) { toast.error(String(e)); }
  };

  const newOrder = async () => {
    // Party size is required for dine-in / room-service so we can report
    // covers per shift (industry standard — Toast, Square, Cake all enforce).
    let partySize: number = 1;
    if (orderType === "dine_in" || orderType === "room_service") {
      const raw = await prompt({
        title: "Party size",
        description: "How many guests are seated?",
        placeholder: "e.g. 2",
        defaultValue: "2",
        required: true,
      });
      if (raw === null) return; // cancelled
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 1 || n > 30) {
        toast.error("Party size must be between 1 and 30");
        return;
      }
      partySize = Math.floor(n);
    }
    if (orderType === "room_service") {
      // Open the room picker; picked room + folio come back via onPick.
      setPendingPartySize(partySize);
      setRoomPickerOpen(true);
      return;
    }
    await openOrderWith(partySize);
  };
  const addItem = async (m: MenuItem) => {
    if (!selected) return;
    try {
      // If this menu item has modifier groups, open the picker first —
      // guests can then customise before it lands on the order.
      const groups = await listModifierGroupsForItem(m.id);
      if (groups.length > 0) {
        setModifierState({ menuItem: m, groups, selections: [] });
        return;
      }
      await addOrderItem(selected, { productId: m.product_id, menuItemId: m.id, stationId: m.station_id, name: m.menu_name, quantity: 1, unitPrice: m.dine_in_price ?? 0 });
      listOrderItems(selected).then(setItems);
    } catch (e) { toast.error(String(e)); }
  };

  const confirmModifiersAndAdd = async () => {
    if (!selected || !modifierState) return;
    const { menuItem: m, selections } = modifierState;
    try {
      await addOrderItem(selected, {
        productId: m.product_id,
        menuItemId: m.id,
        stationId: m.station_id,
        name: m.menu_name,
        quantity: 1,
        unitPrice: m.dine_in_price ?? 0,
        modifiers: selections,
      });
      listOrderItems(selected).then(setItems);
      setModifierState(null);
    } catch (e) { toast.error(String(e)); }
  };
  const send = async () => {
    if (!selected) return;
    try { await sendToKitchen(selected); listOrderItems(selected).then(setItems); loadOrders(); toast.success("Sent to kitchen"); }
    catch (e) { toast.error(String(e)); }
  };
  const sendToPosCheckout = async () => {
    if (!selected) return;
    setCheckingOut(true);
    try {
      const payload = await prepareOrderForPosCheckout(selected);
      const label = payload.order.table_code
        ? `${payload.order.order_number} / Table ${payload.order.table_code}`
        : payload.order.order_number;
      useCartStore.getState().loadSnapshot(payload.items, 0, payload.order.customer_id, {
        tip,
        serviceChargeAmount: payload.serviceChargeAmount,
        source: { type: "hospitality_order", id: selected, label },
      });
      toast.success("Order loaded in POS checkout");
      navigate("/pos/sale");
    } catch (e) { toast.error(String(e)); } finally { setCheckingOut(false); }
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
                  <Button size="sm" className={cn("w-full cursor-pointer", BRAND_BTN)} disabled={checkingOut || total <= 0} onClick={sendToPosCheckout}>
                    {checkingOut ? "Loading POS…" : `Send to POS ${KES(total + total * (scPct / 100) + tip)}`}
                  </Button>
                  <Button size="sm" variant="outline" className="w-full" disabled={total <= 0 || chargingRoom !== null} onClick={async () => {
                    const rows = await query<{ id: string; room_number: string; guest_name: string }>(
                      `SELECT gf.id, r.room_number, gf.guest_name FROM guest_folios gf JOIN rooms r ON r.id = gf.room_id WHERE gf.status = 'open' ORDER BY r.room_number`);
                    if (rows.length === 0) { toast.error("No open guest folios — check in a guest first"); return; }
                    setRoomFolios(rows.map((r) => ({ id: r.id, room: r.room_number, guest: r.guest_name, balance: 0 })));
                    setShowRoomPicker(true);
                  }}>
                    <BedDouble className="h-3.5 w-3.5 mr-1" /> Charge to Room
                  </Button>
                  {showRoomPicker && (
                    <RoomPickerDialog
                      folios={roomFolios}
                      onSelect={async (folioId) => {
                        setShowRoomPicker(false);
                        setChargingRoom(folioId);
                        try { await chargeOrderToRoom(selected, folioId, userId); toast.success("Charged to room"); loadOrders(); setSelected(null); }
                        catch (e) { toast.error(String(e)); }
                        finally { setChargingRoom(null); }
                      }}
                      onClose={() => setShowRoomPicker(false)}
                    />
                  )}
                </div>
              </div>
            )}
          </CardContent></Card>
          {/* Menu grid */}
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Menu</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {menu.map((m) => {
                const av = availability.get(m.id);
                const max = av?.max_servings ?? Infinity;
                const isOut = max === 0;
                const isLow = max !== Infinity && max > 0 && max <= 3;
                const is86 = eightySixMap.has(m.id);
                const disabled = isOut || is86;
                return (
                  <button
                    key={m.id}
                    onClick={async () => { await addItem(m); loadAvailability(); }}
                    disabled={disabled}
                    className={cn(
                      "rounded-lg border border-border p-2 text-left transition-colors flex gap-2",
                      disabled
                        ? "opacity-50 cursor-not-allowed bg-muted/30"
                        : "hover:bg-accent/30 cursor-pointer",
                    )}
                  >
                    {m.image_path ? (
                      <img src={m.image_path} alt="" className="h-12 w-12 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded bg-muted grid place-items-center text-[10px] text-muted-foreground flex-shrink-0">—</div>
                    )}
                    <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate flex items-center gap-1.5">
                      {m.menu_name}
                      {is86 ? (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-rose-500/15 text-rose-600 border border-rose-500/30 font-mono uppercase tracking-wide">86</span>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {m.dine_in_price != null ? KES(m.dine_in_price) : "—"}
                      </div>
                      {isOut ? (
                        <span className="text-[10px] font-medium text-rose-600 dark:text-rose-400">
                          Out{av?.bottleneck_product_name ? ` — ${av.bottleneck_product_name}` : ""}
                        </span>
                      ) : isLow ? (
                        <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400">
                          Last {max}
                        </span>
                      ) : null}
                    </div>
                    </div>
                  </button>
                );
              })}
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
        action={<div className="flex items-center gap-2"><ServicePeriodBadge /><Select value={orderType} onValueChange={(v) => setOrderType(v as "dine_in" | "room_service")}>
  <SelectTrigger className="h-8 text-xs w-[140px]">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="dine_in">Dine-in</SelectItem>
    <SelectItem value="room_service">Room service</SelectItem>
  </SelectContent>
</Select><Button size="sm" className={cn("cursor-pointer", BRAND_BTN)} onClick={newOrder}><Plus className="h-3.5 w-3.5 mr-1" /> New order</Button></div>}
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

      {/* Room service — open the picker so the operator picks WHICH
       *  room the order is for. The picker also fetches the guest's
       *  open folio so the auto folio_id resolution in openOrder works. */}
      <RoomPickerSheet
        mode="room_service"
        open={roomPickerOpen}
        onClose={() => setRoomPickerOpen(false)}
        onPick={async (pick) => {
          setRoomPickerOpen(false);
          await openOrderWith(pendingPartySize, pick.roomId);
        }}
      />

            {/* Modifier picker — surfaces when the picked menu item has
       *  modifier groups. Guests customise; then the line lands with
       *  the selections on `hospitality_order_item_modifiers`. */}
      {modifierState ? (
        <Dialog open={true} onOpenChange={(o) => !o && setModifierState(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Customise · {modifierState.menuItem.menu_name}</DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <ModifierPicker
                groups={modifierState.groups}
                onSelectionsChange={(sels) => setModifierState((s) => s ? { ...s, selections: sels } : s)}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setModifierState(null)}>Cancel</Button>
              <Button onClick={confirmModifiersAndAdd}>Add to order</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
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
  const [typeDialog, setTypeDialog] = useState(false);
  const [roomDialog, setRoomDialog] = useState(false);
  const [roomSearch, setRoomSearch] = useState("");
  const [searchParams] = useSearchParams();
  const initialStatus = (searchParams.get("status") as Room["status"] | null) ?? null;
  const [roomStatusFilter, setRoomStatusFilter] = useState<Room["status"] | null>(initialStatus);
  const navigate = useNavigate();
  const load = () => Promise.all([listRooms(), listRoomTypes()]).then(([r, t]) => { setRooms(r); setTypes(t); }).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const cycle = async (r: Room) => {
    const next = r.status === "available" ? "dirty" : "available";
    try { await setRoomStatus(r.id, next); load(); } catch (e) { toast.error(String(e)); }
  };

  if (loading) return <CenterSpin />;
  const filteredRooms = rooms.filter((r) => {
    if (roomSearch && !r.room_number.toLowerCase().includes(roomSearch.toLowerCase())) return false;
    if (roomStatusFilter && r.status !== roomStatusFilter) return false;
    return true;
  });
  return (
    <div>
      <PageHead icon={BedDouble} title="Rooms" subtitle="Room status board." action={
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setTypeDialog(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Type</Button>
          <Button size="sm" className={cn("cursor-pointer", BRAND_BTN)} onClick={() => {
            if (types.length === 0) { toast.error("Create a room type first"); return; }
            setRoomDialog(true);
          }}><Plus className="h-3.5 w-3.5 mr-1" /> Room</Button>
        </div>} />

      <CompactFormDialog
        open={typeDialog}
        onClose={() => setTypeDialog(false)}
        title="New room type"
        description="Group rooms with the same base rate (e.g. Standard, Deluxe, Suite)."
        fields={[
          { name: "name", label: "Type name", placeholder: "Standard", required: true },
          { name: "rate", label: "Base rate (KES per night)", type: "number", defaultValue: "0", min: 0, step: "0.01", required: true },
        ]}
        submitLabel="Add type"
        onSubmit={async (v) => {
          await createRoomType({ name: v.name.trim(), baseRate: parseFloat(v.rate || "0") || 0 });
          load();
        }}
      />

      <CompactFormDialog
        open={roomDialog}
        onClose={() => setRoomDialog(false)}
        title="New room"
        description="One screen — number + which type."
        fields={[
          { name: "roomNumber", label: "Room number", placeholder: "101", required: true },
          ...(types.length > 0 ? [{
            name: "typeId",
            label: "Room type",
            type: "select" as const,
            options: types.map((t) => ({ value: String(t.id), label: t.name })),
            defaultValue: String(types[0].id),
          }] : []),
        ]}
        submitLabel="Add room"
        onSubmit={async (v) => {
          const typeId = v.typeId ? v.typeId : types[0].id;
          await createRoom({ roomTypeId: typeId, roomNumber: v.roomNumber.trim() });
          load();
        }}
      />
      {rooms.length === 0 ? (
        <EmptyHint text="No rooms yet. Add a room type, then rooms." />
      ) : (
        <>
          {/* KPI strip — clicking a tile applies it as the filter. */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
            {(["available", "occupied", "dirty", "cleaning", "maintenance"] as const).map((s) => {
              const count = rooms.filter((r) => r.status === s).length;
              const isActive = roomStatusFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setRoomStatusFilter(isActive ? null : s)}
                  className={cn(
                    "rounded-lg border p-2.5 flex items-baseline justify-between transition-all text-left",
                    ROOM_STATUS[s],
                    isActive ? "ring-2 ring-foreground/40" : "hover:opacity-80",
                  )}
                >
                  <div className="text-[10px] uppercase tracking-wide">{s}</div>
                  <div className="text-lg font-semibold font-mono tabular-nums">{count}</div>
                </button>
              );
            })}
          </div>

          {/* Search + filter */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Input
              value={roomSearch}
              onChange={(e) => setRoomSearch(e.target.value)}
              placeholder="Search rooms…"
              className="h-8 text-xs max-w-[200px]"
            />
            <div className="flex flex-wrap items-center gap-1">
              <button
                onClick={() => setRoomStatusFilter(null)}
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-full border transition-colors",
                  roomStatusFilter === null
                    ? "border-foreground/30 bg-foreground/[0.06] text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                All
              </button>
              {(["available", "occupied", "dirty", "cleaning", "maintenance"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setRoomStatusFilter(s)}
                  className={cn(
                    "text-[11px] px-2 py-0.5 rounded-full border transition-colors capitalize",
                    roomStatusFilter === s
                      ? "border-foreground/30 bg-foreground/[0.06] text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="ml-auto text-[11px] text-muted-foreground font-mono tabular-nums">
              {filteredRooms.length} of {rooms.length}
            </div>
          </div>

          {/* Compact table — click row to drill in */}
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Room</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-right px-3 py-2 w-24">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRooms.map((r) => {
                  const t = types.find((tt) => tt.id === r.room_type_id);
                  return (
                    <tr
                      key={r.id}
                      className="border-t border-border hover:bg-accent/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/hospitality/rooms/${r.id}`)}
                    >
                      <td className="px-3 py-2 font-medium">{r.room_number}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {t ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/hospitality/room-types/${t.id}`); }}
                            className="hover:text-foreground hover:underline transition-colors"
                          >
                            {t.name}
                          </button>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize border", ROOM_STATUS[r.status])}>
                          {r.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); cycle(r); }}
                          className="text-[11px] text-primary hover:underline"
                        >
                          Cycle
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredRooms.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground italic">
                      No rooms match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
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
  const [bookingDialog, setBookingDialog] = useState(false);
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingFilter, setBookingFilter] = useState<"all" | "arriving" | "in_house" | "departing">("all");
  const [bookingView, setBookingView] = useState<"list" | "calendar">("list");
  const [calStart, setCalStart] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const load = () => Promise.all([listBookings(), listRoomTypes(), listRooms()]).then(([b, t, r]) => { setBookings(b); setTypes(t); setRooms(r); }).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

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
        <Button size="sm" className={cn("cursor-pointer", BRAND_BTN)} onClick={() => {
          if (types.length === 0) { toast.error("Create a room type first (Rooms page)"); return; }
          setBookingDialog(true);
        }}><Plus className="h-3.5 w-3.5 mr-1" /> New booking</Button>} />

      <BookingDialog
        open={bookingDialog}
        onClose={() => setBookingDialog(false)}
        onCreated={load}
        roomTypes={types}
        userId={userId}
      />
      {/* Search + arrival/in-house/departing filter chips */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Input
          value={bookingSearch}
          onChange={(e) => setBookingSearch(e.target.value)}
          placeholder="Search bookings by guest or number…"
          className="h-8 text-xs max-w-[260px]"
        />
        <div className="flex flex-wrap items-center gap-1">
          {(["all", "arriving", "in_house", "departing"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setBookingFilter(f)}
              className={cn(
                "text-[11px] px-2 py-0.5 rounded-full border transition-colors capitalize",
                bookingFilter === f
                  ? "border-foreground/30 bg-foreground/[0.06] text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f.replace("_", " ")}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
            <button onClick={() => setBookingView("list")} className={cn("text-[11px] px-2 py-0.5 rounded transition-colors", bookingView === "list" ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}>List</button>
            <button onClick={() => setBookingView("calendar")} className={cn("text-[11px] px-2 py-0.5 rounded transition-colors", bookingView === "calendar" ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}>Calendar</button>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
          {(() => {
            const todayStr = new Date().toISOString().slice(0, 10);
            return bookings.filter((b) => {
              if (bookingSearch) {
                const q = bookingSearch.toLowerCase();
                if (!b.guest_name.toLowerCase().includes(q) && !b.booking_number.toLowerCase().includes(q)) return false;
              }
              if (bookingFilter === "arriving") return b.status === "reserved" && b.check_in_date === todayStr;
              if (bookingFilter === "in_house") return b.status === "checked_in";
              if (bookingFilter === "departing") return b.status === "checked_in" && b.check_out_date === todayStr;
              return true;
            }).length;
          })()} of {bookings.length}
          </span>
        </div>
      </div>
      {bookingView === "calendar" ? (
        <BookingsCalendar bookings={bookings} rooms={rooms} types={types} start={calStart} onShift={(n) => { const d = new Date(calStart); d.setDate(d.getDate() + n); setCalStart(d); }} onToday={() => { const d = new Date(); d.setHours(0,0,0,0); setCalStart(d); }} />
      ) : bookings.length === 0 ? <EmptyHint text="No active bookings." /> : (
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
              {(() => {
                const todayStr = new Date().toISOString().slice(0, 10);
                return bookings.filter((b) => {
                  if (bookingSearch) {
                    const q = bookingSearch.toLowerCase();
                    if (!b.guest_name.toLowerCase().includes(q) && !b.booking_number.toLowerCase().includes(q)) return false;
                  }
                  if (bookingFilter === "arriving") return b.status === "reserved" && b.check_in_date === todayStr;
                  if (bookingFilter === "in_house") return b.status === "checked_in";
                  if (bookingFilter === "departing") return b.status === "checked_in" && b.check_out_date === todayStr;
                  return true;
                });
              })().map((b) => (
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

// ─── Bookings occupancy calendar ─────────────────────────────────────────────
// Rooms (rows, grouped by type) × a 14-night window (columns). Each active
// booking paints its assigned room's cells from check-in to (but not incl.)
// check-out, with the guest name on the first visible night. Unassigned
// reserved bookings show in a strip above the grid.
function BookingsCalendar({ bookings, rooms, types, start, onShift, onToday }: {
  bookings: Array<Booking & { guest_name: string; room_number: string | null }>;
  rooms: Room[];
  types: RoomType[];
  start: Date;
  onShift: (days: number) => void;
  onToday: () => void;
}) {
  const DAYS = 14;
  const days = Array.from({ length: DAYS }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);
  const typeName = (id: string) => types.find((t) => t.id === id)?.name ?? "—";
  const rangeLabel = `${days[0].toLocaleDateString([], { day: "numeric", month: "short" })} – ${days[DAYS - 1].toLocaleDateString([], { day: "numeric", month: "short" })}`;

  // Rooms sorted by type then number; unassigned reserved bookings listed separately.
  const sortedRooms = [...rooms].sort((a, b) => (a.room_type_id.localeCompare(b.room_type_id)) || a.room_number.localeCompare(b.room_number, undefined, { numeric: true }));
  const unassigned = bookings.filter((b) => !b.room_id && b.status === "reserved");

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-sm" onClick={() => onShift(-DAYS)}><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" onClick={onToday}>Today</Button>
        <Button variant="outline" size="icon-sm" onClick={() => onShift(DAYS)}><ChevronRight className="h-4 w-4" /></Button>
        <span className="text-[12px] text-muted-foreground font-medium ml-1">{rangeLabel}</span>
      </div>

      {unassigned.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11.5px]">
          <span className="font-medium text-amber-700 dark:text-amber-400">{unassigned.length} reserved, room not yet assigned:</span>{" "}
          {unassigned.map((b) => `${b.guest_name} (${b.check_in_date}→${b.check_out_date})`).join(", ")}
        </div>
      )}

      {sortedRooms.length === 0 ? <EmptyHint text="No rooms yet — add rooms on the Rooms page." /> : (
        <div className="border border-border rounded-lg overflow-auto">
          <div className="min-w-[860px]">
            {/* Header row */}
            <div className="grid" style={{ gridTemplateColumns: `160px repeat(${DAYS}, 1fr)` }}>
              <div className="border-b border-r border-border px-2 py-1.5 text-[11px] font-medium text-muted-foreground bg-muted/30">Room</div>
              {days.map((d) => (
                <div key={iso(d)} className={cn("border-b border-border px-1 py-1.5 text-center text-[10px] leading-tight", iso(d) === todayStr ? "bg-accent font-semibold" : "bg-muted/30 text-muted-foreground")}>
                  <div>{d.toLocaleDateString([], { weekday: "narrow" })}</div>
                  <div className="tabular-nums">{d.getDate()}</div>
                </div>
              ))}
            </div>
            {/* Room rows */}
            {sortedRooms.map((room) => {
              const roomBookings = bookings.filter((b) => b.room_id === room.id);
              return (
                <div key={room.id} className="grid" style={{ gridTemplateColumns: `160px repeat(${DAYS}, 1fr)` }}>
                  <div className="border-b border-r border-border px-2 py-2 text-[12px] bg-background">
                    <span className="font-medium">{room.room_number}</span>
                    <span className="text-muted-foreground text-[10.5px] block truncate">{typeName(room.room_type_id)}</span>
                  </div>
                  {days.map((d) => {
                    const ds = iso(d);
                    const b = roomBookings.find((bk) => bk.check_in_date <= ds && ds < bk.check_out_date);
                    const isStart = b && (b.check_in_date === ds || ds === iso(days[0]));
                    return (
                      <div key={ds} className={cn("border-b border-border/60 h-11 relative", iso(d) === todayStr && "bg-accent/30")}>
                        {b && (
                          <div className={cn("absolute inset-y-1 inset-x-0.5 rounded flex items-center px-1 overflow-hidden",
                            b.status === "checked_in" ? "bg-red-600/85 text-white" : "bg-red-500/25 text-red-800 dark:text-red-200 border border-red-500/40")}>
                            {isStart && <span className="text-[10px] font-medium truncate">{b.guest_name}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex items-center gap-4 text-[10.5px] text-muted-foreground pl-1">
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-red-600/85" /> Checked in</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-red-500/25 border border-red-500/40" /> Reserved</span>
      </div>
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
  const [walkInOpen, setWalkInOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    // Now includes walk-in folios (booking_id NULL). Guest name resolved
    // via COALESCE(folio.guest_id.name, booking.guest_id.name).
    const rows = await query<FolioRow>(
      `SELECT f.id, f.folio_number, f.status,
              COALESCE(gf.full_name, gb.full_name) AS guest_name
       FROM guest_folios f
       LEFT JOIN bookings b ON b.id = f.booking_id
       LEFT JOIN guests gb ON gb.id = b.guest_id
       LEFT JOIN guests gf ON gf.id = f.guest_id
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
      <PageHead icon={FileText} title="Guest Folios" subtitle="Open folios and balances." action={
        <Button size="sm" className={cn("cursor-pointer", BRAND_BTN)} onClick={() => setWalkInOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Walk-in folio
        </Button>
      } />
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

      <WalkInFolioDialog
        open={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        onCreated={() => { setWalkInOpen(false); load(); }}
      />
    </div>
  );
}

function WalkInFolioDialog({
  open, onClose, onCreated,
}: { open: boolean; onClose: () => void; onCreated: () => void; }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setName(""); setPhone(""); setNotes(""); } }, [open]);

  const save = async () => {
    if (!name.trim()) { toast.error("Guest name required"); return; }
    setSaving(true);
    try {
      const mod = await import("@/services/hospitality");
      const { folioNumber } = await mod.createWalkInFolio({
        guestName: name.trim(),
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(`Walk-in folio ${folioNumber} opened`);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Walk-in folio</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Guest name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Mwangi" autoFocus />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Phone (optional)</span>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 700 000 000" />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Notes</span>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Bar tab / room-service pass-through" />
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Opening…" : "Open folio"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Food Cost Report ───────────────────────────────────────────────────────

type SortKey = "name" | "cost" | "margin" | "fcp";

export function HospitalityRecipesPage() {
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [costs, setCosts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>("fcp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    listRecipes().then(async (rows) => {
      setRecipes(rows);
      const c: Record<string, number> = {};
      for (const r of rows) c[r.id] = await recipeCost(r.id);
      setCosts(c);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <CenterSpin />;

  const enriched = recipes.map((r) => {
    const cost = costs[r.id] ?? 0;
    const price = r.dine_in_price ?? 0;
    const margin = price - cost;
    const fcp = price > 0 ? (cost / price) * 100 : 0;
    return { ...r, cost, price, margin, fcp };
  });
  const sorted = [...enriched].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    const key = sortBy;
    if (key === "name") return a.menu_name.localeCompare(b.menu_name) * dir;
    if (key === "cost") return (a.cost - b.cost) * dir;
    if (key === "margin") return (a.margin - b.margin) * dir;
    return (a.fcp - b.fcp) * dir;
  });
  const total = enriched.length;
  const avgFcp = total ? enriched.reduce((s, r) => s + r.fcp, 0) / total : 0;
  const highFcp = enriched.filter((r) => r.fcp > 40).length;
  return (
    <div>
      <PageHead icon={ClipboardList} title="Food Cost Report" subtitle="Ingredient cost vs price for every menu item. Sortable by margin, food-cost %, or cost." />

      {recipes.length === 0 ? <EmptyHint text="No recipes yet. Add recipes to track food cost." /> : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Kpi label="Recipes on file" value={String(total)} />
            <Kpi label="Avg food cost %" value={`${avgFcp.toFixed(1)}%`} />
            <Kpi label="Above 40% (concerning)" value={String(highFcp)} />
          </div>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <SortableTh label="Dish" active={sortBy === "name"} dir={sortDir} onClick={() => { setSortBy("name"); setSortDir((d) => sortBy === "name" && d === "asc" ? "desc" : "asc"); }} align="left" />
                <SortableTh label="Cost" active={sortBy === "cost"} dir={sortDir} onClick={() => { setSortBy("cost"); setSortDir((d) => sortBy === "cost" && d === "asc" ? "desc" : "desc"); }} />
                <th className="text-right px-3 py-2">Price</th>
                <SortableTh label="Margin" active={sortBy === "margin"} dir={sortDir} onClick={() => { setSortBy("margin"); setSortDir((d) => sortBy === "margin" && d === "asc" ? "desc" : "desc"); }} />
                <SortableTh label="Food cost %" active={sortBy === "fcp"} dir={sortDir} onClick={() => { setSortBy("fcp"); setSortDir((d) => sortBy === "fcp" && d === "asc" ? "desc" : "desc"); }} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const pct = Math.round(r.fcp);
                return (
                  <tr key={r.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                    <td className="px-3 py-2 font-medium">{r.menu_name}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{KES(r.cost)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{KES(r.price)}</td>
                    <td className={cn("px-3 py-2 text-right font-mono tabular-nums", r.margin < 0 ? "text-rose-600" : r.margin < r.cost ? "text-amber-600" : "text-emerald-600")}>
                      {KES(r.margin)}
                    </td>
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
        </>
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

function RoomPickerDialog({ folios, onSelect, onClose }: { folios: Array<{ id: string; room: string; guest: string; balance: number }>; onSelect: (id: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-background border border-border rounded-lg shadow-lg w-80 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-medium mb-3">Charge to room</div>
        <div className="space-y-1.5 max-h-60 overflow-auto">
          {folios.map((f) => (
            <button key={f.id} onClick={() => onSelect(f.id)} className="w-full text-left rounded-md border border-border p-2.5 hover:bg-accent/30 transition-colors cursor-pointer">
              <div className="text-sm font-medium">Room {f.room}</div>
              <div className="text-xs text-muted-foreground">{f.guest}</div>
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-3 w-full" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

function CenterSpin() {
  return <ModuleSpinner />;
}
function EmptyHint({ text }: { text: string }) {
  return <div className="border border-dashed border-border rounded-lg py-12 text-center text-sm text-muted-foreground">{text}</div>;
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  align = "right",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th className={`px-3 py-2 ${align === "left" ? "text-left" : "text-right"}`}>
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-0.5 ${active ? "text-foreground" : "text-muted-foreground"} hover:text-foreground transition-colors`}
      >
        {label}
        {active ? <span className="text-[9px]">{dir === "asc" ? "▲" : "▼"}</span> : null}
      </button>
    </th>
  );
}
