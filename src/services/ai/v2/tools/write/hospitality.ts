/**
 * Hospitality write tools — dining areas, tables, stations, menu items,
 * rooms, room types, bookings, orders.
 */
import { z } from "zod";
import { register } from "../registry";
import { defineWrite } from "../write-helpers";
import {
  createArea, createTable, createStation, createMenuItem,
  createRoomType, createRoom, createBooking, openOrder, addOrderItem,
} from "@/services/hospitality";

// ─── Dining Area ───────────────────────────────────────────
register(defineWrite<{ name: string }>({
  id: "create_dining_area",
  description: "Create a dining area (e.g. Main Hall, Terrace)",
  parameters: z.object({ name: z.string().min(1).max(60) }),
  ui: { label: "New dining area", icon: "ForkKnife" },
  summary: (a) => `Create dining area "${a.name}"`,
  async run(a) {
    const id = await createArea(a.name);
    return { title: `Created area ${a.name}`, output: `Dining area created (id: ${id}).`, metadata: { id } };
  },
}));

// ─── Table ─────────────────────────────────────────────────
const tableParams = z.object({
  area_id: z.string().nullable().optional(),
  code: z.string().min(1).max(20),
  name: z.string().optional(),
  seats: z.number().int().min(1).max(30),
});
register(defineWrite<z.infer<typeof tableParams>>({
  id: "create_table",
  description: "Create a dining table in an area",
  parameters: tableParams,
  ui: { label: "New table", icon: "Table" },
  summary: (a) => `Create table ${a.code} · ${a.seats} seats`,
  async run(a) {
    const id = await createTable({ areaId: a.area_id ?? null, code: a.code, name: a.name ?? `Table ${a.code}`, seats: a.seats });
    return { title: `Table ${a.code}`, output: `Table created (id: ${id}).`, metadata: { id } };
  },
}));

// ─── Kitchen Station ───────────────────────────────────────
register(defineWrite<{ name: string; printer_name?: string }>({
  id: "create_kitchen_station",
  description: "Create a kitchen station (grill, drinks, salads, bar, ...)",
  parameters: z.object({ name: z.string().min(1).max(60), printer_name: z.string().optional() }),
  ui: { label: "New kitchen station", icon: "CookingPot" },
  summary: (a) => `Create station "${a.name}"${a.printer_name ? ` → ${a.printer_name}` : ""}`,
  async run(a) {
    const id = await createStation(a.name, a.printer_name);
    return { title: `Station ${a.name}`, output: `Kitchen station created (id: ${id}).`, metadata: { id } };
  },
}));

// ─── Menu Item ─────────────────────────────────────────────
const menuParams = z.object({
  name: z.string().min(2).max(120),
  category: z.string().optional(),
  station_id: z.string().optional(),
  dine_in_price: z.number().nonnegative(),
  takeaway_price: z.number().nonnegative().optional(),
  prep_minutes: z.number().int().min(0).max(240).optional(),
});
register(defineWrite<z.infer<typeof menuParams>>({
  id: "create_menu_item",
  description: "Add a new item to the restaurant menu",
  parameters: menuParams,
  ui: { label: "New menu item", icon: "ForkKnife" },
  summary: (a) => `Add "${a.name}" @ KES ${a.dine_in_price.toFixed(0)} to menu`,
  async run(a) {
    const id = await createMenuItem({
      name: a.name, category: a.category ?? null, stationId: a.station_id ?? null,
      dineInPrice: a.dine_in_price, takeawayPrice: a.takeaway_price ?? null,
      prepMinutes: a.prep_minutes ?? null,
    } as any);
    return { title: `Added ${a.name}`, output: `Menu item created (id: ${id}).`, metadata: { id } };
  },
}));

// ─── Room Type ─────────────────────────────────────────────
const roomTypeParams = z.object({
  name: z.string().min(2).max(80),
  base_rate: z.number().nonnegative(),
  max_occupancy: z.number().int().min(1).max(20).optional(),
});
register(defineWrite<z.infer<typeof roomTypeParams>>({
  id: "create_room_type",
  description: "Create a room type (e.g. Standard, Deluxe) with base nightly rate",
  parameters: roomTypeParams,
  ui: { label: "New room type", icon: "Bed" },
  summary: (a) => `Room type "${a.name}" @ KES ${a.base_rate}/night`,
  async run(a) {
    const id = await createRoomType({ name: a.name, baseRate: a.base_rate, maxOccupancy: a.max_occupancy });
    return { title: `Room type ${a.name}`, output: `Room type created (id: ${id}).`, metadata: { id } };
  },
}));

// ─── Room ──────────────────────────────────────────────────
const roomParams = z.object({
  room_type_id: z.string(),
  room_number: z.string().min(1).max(20),
  floor: z.string().optional(),
});
register(defineWrite<z.infer<typeof roomParams>>({
  id: "create_room",
  description: "Create a room of a given type",
  parameters: roomParams,
  ui: { label: "New room", icon: "Bed" },
  summary: (a) => `Room ${a.room_number}${a.floor ? ` (floor ${a.floor})` : ""}`,
  async run(a) {
    const id = await createRoom({ roomTypeId: a.room_type_id, roomNumber: a.room_number, floor: a.floor });
    return { title: `Room ${a.room_number}`, output: `Room created (id: ${id}).`, metadata: { id } };
  },
}));

// ─── Booking ───────────────────────────────────────────────
const bookingParams = z.object({
  guest_id: z.string(),
  room_type_id: z.string(),
  room_id: z.string().optional(),
  check_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.number().int().min(1).default(1),
  children: z.number().int().min(0).default(0),
  rate_per_night: z.number().nonnegative(),
});
register(defineWrite<z.infer<typeof bookingParams>>({
  id: "create_booking",
  description: "Book a room for a guest for a date range",
  parameters: bookingParams,
  ui: { label: "New booking", icon: "CalendarBlank" },
  summary: (a) => `Book ${a.check_in_date} → ${a.check_out_date} · ${a.adults}A${a.children ? `+${a.children}C` : ""} @ KES ${a.rate_per_night}/night`,
  async run(a, ctx) {
    const id = await createBooking({
      guestId: a.guest_id, roomTypeId: a.room_type_id, roomId: a.room_id,
      checkInDate: a.check_in_date, checkOutDate: a.check_out_date,
      adults: a.adults, children: a.children, ratePerNight: a.rate_per_night,
      createdBy: ctx.userId,
    } as any);
    return { title: `Booked`, output: `Booking created (id: ${id}).`, metadata: { id } };
  },
}));

// ─── Open restaurant order ─────────────────────────────────
register(defineWrite<{ table_id?: string; order_type: "dine_in" | "takeaway" | "delivery" | "room_service"; waiter_id?: string }>({
  id: "open_order",
  description: "Open a new hospitality order at a table or for takeaway",
  parameters: z.object({
    table_id: z.string().optional(),
    order_type: z.enum(["dine_in", "takeaway", "delivery", "room_service"]).default("dine_in"),
    waiter_id: z.string().optional(),
  }),
  ui: { label: "Open order", icon: "Receipt" },
  summary: (a) => `Open ${a.order_type} order${a.table_id ? ` at table ${a.table_id.slice(0,8)}` : ""}`,
  async run(a, ctx) {
    const id = await openOrder({ tableId: a.table_id, orderType: a.order_type, waiterId: a.waiter_id, userId: ctx.userId } as any);
    return { title: "Order opened", output: `Order opened (id: ${id}).`, metadata: { id } };
  },
}));

// ─── Add item to an order ──────────────────────────────────
register(defineWrite<{ order_id: string; menu_item_id: string; name: string; unit_price: number; quantity: number; notes?: string }>({
  id: "add_order_item",
  description: "Add a menu item to an open hospitality order",
  parameters: z.object({
    order_id: z.string(),
    menu_item_id: z.string(),
    name: z.string(),
    unit_price: z.number().nonnegative(),
    quantity: z.number().positive().default(1),
    notes: z.string().optional(),
  }),
  ui: { label: "Add order item", icon: "Plus" },
  summary: (a) => `Add ${a.quantity}× ${a.name} to order ${a.order_id.slice(0, 8)}`,
  async run(a) {
    await addOrderItem(a.order_id, {
      menuItemId: a.menu_item_id, name: a.name, unitPrice: a.unit_price,
      quantity: a.quantity, notes: a.notes,
    } as any);
    return { title: "Item added", output: `Added ${a.quantity}× ${a.name}.`, metadata: {} };
  },
}));
