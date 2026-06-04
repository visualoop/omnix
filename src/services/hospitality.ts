/**
 * Hospitality module service (plan 08). Batch 2: dining areas/tables,
 * kitchen stations, menu items. Order lifecycle (Batch 3), rooms/folios
 * (Batches 5-6), recipes (Batch 7) layer on top in later tasks.
 *
 * Mutating ops assert the hospitality entitlement + the relevant permission.
 */
import { query, execute } from "@/lib/db";
import { assertModuleEntitled } from "@/services/license";
import { requirePermission } from "@/services/rbac";
import { completeSale, type CartItem, type PaymentEntry } from "@/services/sales";
import { getActiveBranchId } from "@/stores/active-branch";

const uid = () => crypto.randomUUID();

// ─── Dining areas + tables ───────────────────────────────────────────────────

export interface DiningArea { id: string; name: string; sort_order: number; active: number; }
export interface DiningTable {
  id: string; area_id: string | null; table_code: string; name: string;
  seats: number; status: string; active: number;
}

export async function listAreas(): Promise<DiningArea[]> {
  return query<DiningArea>(`SELECT id, name, sort_order, active FROM dining_areas WHERE active = 1 ORDER BY sort_order, name`);
}

export async function createArea(name: string): Promise<string> {
  await assertModuleEntitled("hospitality");
  await requirePermission("hospitality.tables.manage", { entityType: "dining_area", metadata: { name } });
  const id = uid();
  await execute(`INSERT INTO dining_areas (id, branch_id, name) VALUES (?1, ?2, ?3)`, [id, getActiveBranchId(), name]);
  return id;
}

export async function listTables(): Promise<DiningTable[]> {
  return query<DiningTable>(
    `SELECT id, area_id, table_code, name, seats, status, active FROM dining_tables WHERE active = 1 ORDER BY table_code`,
  );
}

export async function createTable(input: { areaId: string | null; code: string; name: string; seats: number }): Promise<string> {
  await assertModuleEntitled("hospitality");
  await requirePermission("hospitality.tables.manage", { entityType: "dining_table", metadata: { code: input.code } });
  const id = uid();
  await execute(
    `INSERT INTO dining_tables (id, branch_id, area_id, table_code, name, seats) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    [id, getActiveBranchId(), input.areaId, input.code, input.name, input.seats],
  );
  return id;
}

export async function setTableStatus(tableId: string, status: DiningTable["status"]): Promise<void> {
  await requirePermission("hospitality.tables.manage", { entityType: "dining_table", entityId: tableId, metadata: { status } });
  await execute(`UPDATE dining_tables SET status = ?2 WHERE id = ?1`, [tableId, status]);
}

// ─── Kitchen stations ────────────────────────────────────────────────────────

export interface KitchenStation { id: string; name: string; printer_name: string | null; display_order: number; }

export async function listStations(): Promise<KitchenStation[]> {
  return query<KitchenStation>(`SELECT id, name, printer_name, display_order FROM kitchen_stations WHERE active = 1 ORDER BY display_order, name`);
}

export async function createStation(name: string, printerName?: string): Promise<string> {
  await assertModuleEntitled("hospitality");
  await requirePermission("hospitality.tables.manage", { entityType: "kitchen_station", metadata: { name } });
  const id = uid();
  await execute(`INSERT INTO kitchen_stations (id, branch_id, name, printer_name) VALUES (?1, ?2, ?3, ?4)`, [id, getActiveBranchId(), name, printerName ?? null]);
  return id;
}

// ─── Menu ────────────────────────────────────────────────────────────────────

export interface MenuItem {
  id: string; product_id: string | null; menu_name: string; category: string | null;
  station_id: string | null; dine_in_price: number | null; active: number;
}

export async function listMenuItems(): Promise<MenuItem[]> {
  return query<MenuItem>(
    `SELECT id, product_id, menu_name, category, station_id, dine_in_price, active
     FROM menu_items WHERE active = 1 ORDER BY category, menu_name`,
  );
}

export async function createMenuItem(input: {
  productId?: string | null;
  name: string;
  category?: string;
  stationId?: string | null;
  dineInPrice?: number;
  takeawayPrice?: number;
  prepMinutes?: number;
}): Promise<string> {
  await assertModuleEntitled("hospitality");
  await requirePermission("hospitality.menu.manage", { entityType: "menu_item", metadata: { name: input.name } });
  const id = uid();
  const productId = input.productId ?? await createMenuProduct(input.name, input.dineInPrice ?? input.takeawayPrice ?? 0);
  await execute(
    `INSERT INTO menu_items (id, product_id, branch_id, menu_name, category, station_id, prep_minutes, dine_in_price, takeaway_price)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    [id, productId, getActiveBranchId(), input.name, input.category ?? null,
     input.stationId ?? null, input.prepMinutes ?? null, input.dineInPrice ?? null, input.takeawayPrice ?? null],
  );
  return id;
}

async function createMenuProduct(name: string, sellingPrice: number): Promise<string> {
  const productId = uid();
  const sku = `HOSP-${productId.slice(0, 8).toUpperCase()}`;
  await execute(
    `INSERT INTO products (id, name, sku, unit, tax_rate, active) VALUES (?1, ?2, ?3, 'serving', 0, 1)`,
    [productId, name, sku],
  );
  await execute(
    `INSERT INTO product_prices (product_id, price_list_id, buying_price, selling_price) VALUES (?1, 'default', 0, ?2)`,
    [productId, sellingPrice],
  );
  return productId;
}

export async function setMenuItemActive(itemId: string, active: boolean): Promise<void> {
  await requirePermission("hospitality.menu.manage", { entityType: "menu_item", entityId: itemId });
  await execute(`UPDATE menu_items SET active = ?2 WHERE id = ?1`, [itemId, active ? 1 : 0]);
}

// ─── Order lifecycle (Batch 3) ───────────────────────────────────────────────

export type OrderType = "dine_in" | "takeaway" | "delivery" | "room_service";

export interface HospitalityOrder {
  id: string; order_number: string; table_id: string | null; customer_id: string | null;
  order_type: OrderType; status: string; waiter_id: string | null; opened_at: string; notes: string | null;
}
export interface HospitalityOrderItem {
  id: string; order_id: string; product_id: string | null; menu_item_id: string | null;
  station_id: string | null; name: string; quantity: number; unit_price: number;
  modifier_total: number; discount: number; tax_rate: number; line_total: number;
  status: string; notes: string | null;
}

export interface HospitalityCheckoutPayload {
  order: HospitalityOrder & { table_code: string | null };
  items: CartItem[];
  serviceChargePercent: number;
  serviceChargeAmount: number;
  totalBeforeServiceCharge: number;
}

export async function openOrder(input: { tableId?: string | null; orderType: OrderType; waiterId?: string | null; customerId?: string | null; userId?: string }): Promise<string> {
  await assertModuleEntitled("hospitality");
  await requirePermission("hospitality.orders.take", { entityType: "hospitality_order" });
  const id = uid();
  const [row] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM hospitality_orders`);
  const number = `ORD-${String((row?.n ?? 0) + 1).padStart(5, "0")}`;
  await execute(
    `INSERT INTO hospitality_orders (id, order_number, branch_id, table_id, customer_id, order_type, status, waiter_id, opened_by)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'open', ?7, ?8)`,
    [id, number, getActiveBranchId(), input.tableId ?? null, input.customerId ?? null, input.orderType, input.waiterId ?? null, input.userId ?? null],
  );
  // Dine-in occupies the table.
  if (input.tableId) await execute(`UPDATE dining_tables SET status = 'occupied' WHERE id = ?1`, [input.tableId]);
  return id;
}

export async function listActiveOrders(): Promise<HospitalityOrder[]> {
  return query<HospitalityOrder>(
    `SELECT id, order_number, table_id, customer_id, order_type, status, waiter_id, opened_at, notes
     FROM hospitality_orders WHERE status NOT IN ('paid','voided') ORDER BY opened_at DESC`,
  );
}

export async function listOrderItems(orderId: string): Promise<HospitalityOrderItem[]> {
  return query<HospitalityOrderItem>(
    `SELECT id, order_id, product_id, menu_item_id, station_id, name, quantity, unit_price,
            modifier_total, discount, tax_rate, line_total, status, notes
     FROM hospitality_order_items WHERE order_id = ?1 ORDER BY rowid`,
    [orderId],
  );
}

export async function addOrderItem(orderId: string, input: {
  productId?: string | null; menuItemId?: string | null; stationId?: string | null;
  name: string; quantity: number; unitPrice: number; taxRate?: number; notes?: string;
}): Promise<string> {
  await requirePermission("hospitality.orders.take", { entityType: "hospitality_order", entityId: orderId });
  const id = uid();
  const lineTotal = input.unitPrice * input.quantity;
  await execute(
    `INSERT INTO hospitality_order_items (id, order_id, product_id, menu_item_id, station_id, name, quantity, unit_price, tax_rate, line_total, status, notes)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'new', ?11)`,
    [id, orderId, input.productId ?? null, input.menuItemId ?? null, input.stationId ?? null,
     input.name, input.quantity, input.unitPrice, input.taxRate ?? 0, lineTotal, input.notes ?? null],
  );
  return id;
}

/** Send all unsent ('new') items on an order to the kitchen. */
export async function sendToKitchen(orderId: string): Promise<void> {
  await requirePermission("hospitality.orders.send_kitchen", { entityType: "hospitality_order", entityId: orderId });
  await execute(`UPDATE hospitality_order_items SET status = 'sent', sent_at = datetime('now') WHERE order_id = ?1 AND status = 'new'`, [orderId]);
  await execute(`UPDATE hospitality_orders SET status = 'sent' WHERE id = ?1 AND status = 'open'`, [orderId]);
}

/** Kitchen display: items that are sent/preparing/ready, grouped per station. */
export async function kitchenQueue(): Promise<Array<HospitalityOrderItem & { order_number: string; station_name: string | null }>> {
  return query(
    `SELECT i.id, i.order_id, i.product_id, i.menu_item_id, i.station_id, i.name, i.quantity, i.unit_price,
            i.modifier_total, i.discount, i.tax_rate, i.line_total, i.status, i.notes,
            o.order_number, ks.name AS station_name
     FROM hospitality_order_items i
     JOIN hospitality_orders o ON o.id = i.order_id
     LEFT JOIN kitchen_stations ks ON ks.id = i.station_id
     WHERE i.status IN ('sent','preparing','ready')
     ORDER BY i.sent_at`,
  );
}

/** Advance a kitchen item: sent → preparing → ready. */
export async function bumpItem(itemId: string): Promise<void> {
  await requirePermission("hospitality.kitchen.bump", { entityType: "hospitality_order_item", entityId: itemId });
  const [it] = await query<{ status: string }>(`SELECT status FROM hospitality_order_items WHERE id = ?1`, [itemId]);
  if (!it) return;
  const next = it.status === "sent" ? "preparing" : it.status === "preparing" ? "ready" : it.status;
  const stamp = next === "ready" ? ", ready_at = datetime('now')" : "";
  await execute(`UPDATE hospitality_order_items SET status = ?2${stamp} WHERE id = ?1`, [itemId, next]);
}

export async function markServed(itemId: string): Promise<void> {
  await requirePermission("hospitality.orders.take", { entityType: "hospitality_order_item", entityId: itemId });
  await execute(`UPDATE hospitality_order_items SET status = 'served', served_at = datetime('now') WHERE id = ?1`, [itemId]);
}

export async function voidOrderItem(itemId: string, reason: string): Promise<void> {
  await requirePermission("hospitality.orders.void", { entityType: "hospitality_order_item", entityId: itemId, metadata: { reason } });
  await execute(`UPDATE hospitality_order_items SET status = 'voided', notes = ?2 WHERE id = ?1`, [itemId, reason]);
}

// ─── Payment + service charge (Batch 4) ──────────────────────────────────────

/** Active service-charge percent for an order type (0 if none configured). */
export async function serviceChargePercent(orderType: OrderType): Promise<number> {
  const rows = await query<{ percent: number }>(
    `SELECT percent FROM service_charge_rules WHERE active = 1 AND (applies_to = 'all' OR applies_to = ?1) ORDER BY percent DESC LIMIT 1`,
    [orderType],
  );
  return rows[0]?.percent ?? 0;
}

/**
 * Pay an order: convert non-voided items to a Core sale, record service charge
 * allocation (to the waiter) + tip, mark the order paid, and free the table.
 * Service charge and tips are kept out of product revenue (separate rows).
 */
export async function payOrder(
  orderId: string,
  payments: PaymentEntry[],
  userId: string,
  opts: { serviceChargePercent?: number; tipAmount?: number; tipEmployeeId?: string | null } = {},
): Promise<string> {
  await assertModuleEntitled("hospitality");
  await requirePermission("hospitality.orders.take", { entityType: "hospitality_order", entityId: orderId });

  const [order] = await query<{ table_id: string | null; customer_id: string | null; waiter_id: string | null; status: string }>(
    `SELECT table_id, customer_id, waiter_id, status FROM hospitality_orders WHERE id = ?1`, [orderId],
  );
  if (!order) throw new Error("Order not found");
  if (order.status === "paid") throw new Error("Order already paid");

  const items = await query<{ product_id: string | null; name: string; quantity: number; unit_price: number; discount: number; tax_rate: number; line_total: number }>(
    `SELECT product_id, name, quantity, unit_price, discount, tax_rate, line_total
     FROM hospitality_order_items WHERE order_id = ?1 AND status != 'voided'`, [orderId],
  );
  if (items.length === 0) throw new Error("No payable items on this order");

  const cart: CartItem[] = items.map((i) => ({
    id: uid(), product_id: i.product_id ?? "", name: i.name,
    quantity: i.quantity, unit_price: i.unit_price, discount: i.discount, tax_rate: i.tax_rate, total: i.line_total,
  }));

  const subtotal = items.reduce((s, i) => s + i.line_total, 0);
  const scPct = opts.serviceChargePercent ?? 0;
  const serviceChargeAmount = subtotal * (scPct / 100);
  const { saleId } = await completeSale(
    cart,
    payments,
    order.customer_id,
    userId,
    0,
    opts.tipAmount ?? 0,
    opts.tipEmployeeId ?? null,
    serviceChargeAmount,
  );

  // Service charge → allocation to the waiter (kept out of product revenue).
  if (scPct > 0 && order.waiter_id) {
    await execute(
      `INSERT INTO service_charge_allocations (id, sale_id, order_id, employee_id, amount, allocation_method)
       VALUES (?1, ?2, ?3, ?4, ?5, 'waiter')`,
      [uid(), saleId, orderId, order.waiter_id, subtotal * (scPct / 100)],
    );
  }

  await execute(`UPDATE hospitality_orders SET status = 'paid', sale_id = ?2, closed_at = datetime('now') WHERE id = ?1`, [orderId, saleId]);
  await execute(`UPDATE hospitality_order_items SET status = 'served' WHERE order_id = ?1 AND status NOT IN ('voided','served')`, [orderId]);
  if (order.table_id) await execute(`UPDATE dining_tables SET status = 'available' WHERE id = ?1`, [order.table_id]);

  return saleId;
}

export async function prepareOrderForPosCheckout(orderId: string): Promise<HospitalityCheckoutPayload> {
  await assertModuleEntitled("hospitality");
  await requirePermission("hospitality.orders.take", { entityType: "hospitality_order", entityId: orderId });

  const [order] = await query<HospitalityOrder & { table_code: string | null }>(
    `SELECT o.id, o.order_number, o.table_id, o.customer_id, o.order_type, o.status,
            o.waiter_id, o.opened_at, o.notes, t.table_code
     FROM hospitality_orders o
     LEFT JOIN dining_tables t ON t.id = o.table_id
     WHERE o.id = ?1`,
    [orderId],
  );
  if (!order) throw new Error("Order not found");
  if (order.status === "paid") throw new Error("Order is already paid");
  if (order.status === "voided") throw new Error("Voided orders cannot be checked out");

  const rows = await query<HospitalityOrderItem>(
    `SELECT id, order_id, product_id, menu_item_id, station_id, name, quantity, unit_price,
            modifier_total, discount, tax_rate, line_total, status, notes
     FROM hospitality_order_items
     WHERE order_id = ?1 AND status != 'voided'
     ORDER BY rowid`,
    [orderId],
  );
  if (rows.length === 0) throw new Error("No payable items on this order");

  for (const item of rows) {
    if (item.product_id) continue;
    const productId = await createMenuProduct(item.name, item.unit_price);
    item.product_id = productId;
    await execute(`UPDATE hospitality_order_items SET product_id = ?2 WHERE id = ?1`, [item.id, productId]);
    if (item.menu_item_id) {
      await execute(`UPDATE menu_items SET product_id = ?2 WHERE id = ?1 AND product_id IS NULL`, [item.menu_item_id, productId]);
    }
  }

  const totalBeforeServiceCharge = rows.reduce((sum, item) => sum + item.line_total, 0);
  const scPct = await serviceChargePercent(order.order_type);
  const serviceChargeAmount = totalBeforeServiceCharge * (scPct / 100);
  const items: CartItem[] = rows.map((item) => ({
    id: item.id,
    product_id: item.product_id ?? "",
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount: item.discount,
    tax_rate: item.tax_rate,
    total: item.line_total,
  }));

  return { order, items, serviceChargePercent: scPct, serviceChargeAmount, totalBeforeServiceCharge };
}

export async function markOrderPaidFromPos(orderId: string, saleId: string): Promise<void> {
  await assertModuleEntitled("hospitality");
  await requirePermission("hospitality.orders.take", { entityType: "hospitality_order", entityId: orderId });

  const [order] = await query<{ table_id: string | null; waiter_id: string | null; status: string }>(
    `SELECT table_id, waiter_id, status FROM hospitality_orders WHERE id = ?1`,
    [orderId],
  );
  if (!order) throw new Error("Order not found");
  if (order.status === "paid") return;

  const [sale] = await query<{ service_charge_amount: number }>(
    `SELECT COALESCE(service_charge_amount, 0) AS service_charge_amount FROM sales WHERE id = ?1`,
    [saleId],
  );
  if (sale && sale.service_charge_amount > 0 && order.waiter_id) {
    await execute(
      `INSERT INTO service_charge_allocations (id, sale_id, order_id, employee_id, amount, allocation_method)
       VALUES (?1, ?2, ?3, ?4, ?5, 'waiter')`,
      [uid(), saleId, orderId, order.waiter_id, sale.service_charge_amount],
    );
  }

  await execute(`UPDATE hospitality_orders SET status = 'paid', sale_id = ?2, closed_at = datetime('now') WHERE id = ?1`, [orderId, saleId]);
  await execute(`UPDATE hospitality_order_items SET status = 'served' WHERE order_id = ?1 AND status NOT IN ('voided','served')`, [orderId]);
  if (order.table_id) await execute(`UPDATE dining_tables SET status = 'available' WHERE id = ?1`, [order.table_id]);
}

// ─── Rooms, bookings, folios (Batches 5-6) ───────────────────────────────────

export interface RoomType { id: string; name: string; base_rate: number; max_occupancy: number; active: number; }
export interface Room { id: string; room_type_id: string; room_number: string; floor: string | null; status: string; }
export interface Booking {
  id: string; booking_number: string; guest_id: string; room_id: string | null; room_type_id: string;
  check_in_date: string; check_out_date: string; status: string; rate_per_night: number;
}

export async function listRoomTypes(): Promise<RoomType[]> {
  return query<RoomType>(`SELECT id, name, base_rate, max_occupancy, active FROM room_types WHERE active = 1 ORDER BY name`);
}
export async function createRoomType(input: { name: string; baseRate: number; maxOccupancy?: number }): Promise<string> {
  await assertModuleEntitled("hospitality");
  await requirePermission("hospitality.bookings.manage", { entityType: "room_type" });
  const id = uid();
  await execute(`INSERT INTO room_types (id, branch_id, name, base_rate, max_occupancy) VALUES (?1, ?2, ?3, ?4, ?5)`,
    [id, getActiveBranchId(), input.name, input.baseRate, input.maxOccupancy ?? 2]);
  return id;
}

export async function listRooms(): Promise<Room[]> {
  return query<Room>(`SELECT id, room_type_id, room_number, floor, status FROM rooms WHERE active = 1 ORDER BY room_number`);
}
export async function createRoom(input: { roomTypeId: string; roomNumber: string; floor?: string }): Promise<string> {
  await assertModuleEntitled("hospitality");
  await requirePermission("hospitality.bookings.manage", { entityType: "room" });
  const id = uid();
  await execute(`INSERT INTO rooms (id, branch_id, room_type_id, room_number, floor) VALUES (?1, ?2, ?3, ?4, ?5)`,
    [id, getActiveBranchId(), input.roomTypeId, input.roomNumber, input.floor ?? null]);
  return id;
}
export async function setRoomStatus(roomId: string, status: Room["status"]): Promise<void> {
  await requirePermission("hospitality.housekeeping.manage", { entityType: "room", entityId: roomId, metadata: { status } });
  await execute(`UPDATE rooms SET status = ?2 WHERE id = ?1`, [roomId, status]);
}

export async function listBookings(): Promise<Array<Booking & { guest_name: string; room_number: string | null }>> {
  return query(
    `SELECT b.id, b.booking_number, b.guest_id, b.room_id, b.room_type_id, b.check_in_date, b.check_out_date,
            b.status, b.rate_per_night, g.full_name AS guest_name, r.room_number
     FROM bookings b JOIN guests g ON g.id = b.guest_id LEFT JOIN rooms r ON r.id = b.room_id
     WHERE b.status NOT IN ('checked_out','cancelled') ORDER BY b.check_in_date`,
  );
}

export async function createBooking(input: {
  guestName: string; phone?: string; roomTypeId: string; checkIn: string; checkOut: string;
  ratePerNight: number; adults?: number; userId?: string;
}): Promise<string> {
  await assertModuleEntitled("hospitality");
  await requirePermission("hospitality.bookings.manage", { entityType: "booking" });
  const guestId = uid();
  await execute(`INSERT INTO guests (id, full_name, phone) VALUES (?1, ?2, ?3)`, [guestId, input.guestName, input.phone ?? null]);
  const id = uid();
  const [row] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM bookings`);
  const number = `BK-${String((row?.n ?? 0) + 1).padStart(5, "0")}`;
  await execute(
    `INSERT INTO bookings (id, booking_number, branch_id, guest_id, room_type_id, check_in_date, check_out_date, adults, rate_per_night, created_by)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
    [id, number, getActiveBranchId(), guestId, input.roomTypeId, input.checkIn, input.checkOut, input.adults ?? 1, input.ratePerNight, input.userId ?? null],
  );
  return id;
}

/** Check in: assign a room, mark booking checked_in + room occupied, open a folio. */
export async function checkIn(bookingId: string, roomId: string): Promise<string> {
  await assertModuleEntitled("hospitality");
  await requirePermission("hospitality.checkin.manage", { entityType: "booking", entityId: bookingId });
  await execute(`UPDATE bookings SET status = 'checked_in', room_id = ?2 WHERE id = ?1`, [bookingId, roomId]);
  await execute(`UPDATE rooms SET status = 'occupied' WHERE id = ?1`, [roomId]);
  const folioId = uid();
  const [row] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM guest_folios`);
  const number = `FOL-${String((row?.n ?? 0) + 1).padStart(5, "0")}`;
  await execute(`INSERT INTO guest_folios (id, booking_id, folio_number, status) VALUES (?1, ?2, ?3, 'open')`, [folioId, bookingId, number]);
  return folioId;
}

export async function postFolioCharge(folioId: string, input: {
  chargeType: "room" | "restaurant" | "bar" | "laundry" | "service" | "tax" | "adjustment";
  description: string; amount: number; taxAmount?: number; sourceSaleId?: string; sourceOrderId?: string; userId?: string;
}): Promise<void> {
  await requirePermission("hospitality.folios.manage", { entityType: "folio", entityId: folioId, metadata: { type: input.chargeType, amount: input.amount } });
  await execute(
    `INSERT INTO folio_charges (id, folio_id, charge_type, description, amount, tax_amount, source_sale_id, source_order_id, posted_by)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    [uid(), folioId, input.chargeType, input.description, input.amount, input.taxAmount ?? 0, input.sourceSaleId ?? null, input.sourceOrderId ?? null, input.userId ?? null],
  );
}

/** Charge a restaurant order to a room folio (instead of immediate payment). */
export async function chargeOrderToRoom(orderId: string, folioId: string, userId?: string): Promise<void> {
  await assertModuleEntitled("hospitality");
  await requirePermission("hospitality.folios.manage", { entityType: "hospitality_order", entityId: orderId });
  const items = await query<{ line_total: number }>(`SELECT line_total FROM hospitality_order_items WHERE order_id = ?1 AND status != 'voided'`, [orderId]);
  const total = items.reduce((s, i) => s + i.line_total, 0);
  await postFolioCharge(folioId, { chargeType: "restaurant", description: `Order ${orderId.slice(0, 8)}`, amount: total, sourceOrderId: orderId, userId });
  await execute(`UPDATE hospitality_orders SET status = 'paid', closed_at = datetime('now') WHERE id = ?1`, [orderId]);
  const [o] = await query<{ table_id: string | null }>(`SELECT table_id FROM hospitality_orders WHERE id = ?1`, [orderId]);
  if (o?.table_id) await execute(`UPDATE dining_tables SET status = 'available' WHERE id = ?1`, [o.table_id]);
}

export async function folioBalance(folioId: string): Promise<{ charges: number; payments: number; balance: number }> {
  const [c] = await query<{ t: number }>(`SELECT COALESCE(SUM(amount + tax_amount),0) AS t FROM folio_charges WHERE folio_id = ?1`, [folioId]);
  const [p] = await query<{ t: number }>(`SELECT COALESCE(SUM(amount),0) AS t FROM folio_payments WHERE folio_id = ?1`, [folioId]);
  const charges = c?.t ?? 0, payments = p?.t ?? 0;
  return { charges, payments, balance: charges - payments };
}

export async function postFolioPayment(folioId: string, amount: number, method: string, userId?: string): Promise<void> {
  await requirePermission("hospitality.folios.manage", { entityType: "folio", entityId: folioId, metadata: { payment: amount } });
  await execute(`INSERT INTO folio_payments (id, folio_id, amount, method, paid_by) VALUES (?1, ?2, ?3, ?4, ?5)`, [uid(), folioId, amount, method, userId ?? null]);
}

/** Check out: requires zero balance unless managerOverride. Frees the room. */
export async function checkOut(bookingId: string, managerOverride = false): Promise<void> {
  await assertModuleEntitled("hospitality");
  await requirePermission("hospitality.checkin.manage", { entityType: "booking", entityId: bookingId });
  const [folio] = await query<{ id: string }>(`SELECT id FROM guest_folios WHERE booking_id = ?1 AND status = 'open'`, [bookingId]);
  if (folio) {
    const bal = await folioBalance(folio.id);
    if (bal.balance > 0.001 && !managerOverride) {
      throw new Error(`Folio balance KES ${bal.balance.toLocaleString()} must be settled before checkout.`);
    }
    await execute(`UPDATE guest_folios SET status = 'closed', closed_at = datetime('now') WHERE id = ?1`, [folio.id]);
  }
  const [b] = await query<{ room_id: string | null }>(`SELECT room_id FROM bookings WHERE id = ?1`, [bookingId]);
  await execute(`UPDATE bookings SET status = 'checked_out' WHERE id = ?1`, [bookingId]);
  if (b?.room_id) await execute(`UPDATE rooms SET status = 'dirty' WHERE id = ?1`, [b.room_id]);
}

// ─── Recipes, costing & wastage (Batch 7) ────────────────────────────────────

export interface RecipeIngredientInput { productId: string; quantity: number; unit: string; wastagePercent?: number; }

export async function createRecipe(menuItemId: string, yieldQty: number, ingredients: RecipeIngredientInput[]): Promise<string> {
  await assertModuleEntitled("hospitality");
  await requirePermission("hospitality.recipes.manage", { entityType: "recipe", entityId: menuItemId });
  const id = uid();
  await execute(`INSERT INTO recipes (id, menu_item_id, yield_quantity) VALUES (?1, ?2, ?3)`, [id, menuItemId, yieldQty]);
  for (const ing of ingredients) {
    await execute(
      `INSERT INTO recipe_ingredients (id, recipe_id, product_id, quantity, unit, wastage_percent) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      [uid(), id, ing.productId, ing.quantity, ing.unit, ing.wastagePercent ?? 0],
    );
  }
  return id;
}

/** Recipe cost = Σ ingredient qty × product buying_price × (1 + wastage%). */
export async function recipeCost(recipeId: string): Promise<number> {
  const rows = await query<{ quantity: number; wastage_percent: number; buying_price: number }>(
    `SELECT ri.quantity, ri.wastage_percent, COALESCE(p.buying_price, 0) AS buying_price
     FROM recipe_ingredients ri JOIN products p ON p.id = ri.product_id WHERE ri.recipe_id = ?1`,
    [recipeId],
  );
  return rows.reduce((s, r) => s + r.quantity * r.buying_price * (1 + r.wastage_percent / 100), 0);
}

export interface RecipeRow { id: string; menu_item_id: string; menu_name: string; dine_in_price: number | null; yield_quantity: number; }
export async function listRecipes(): Promise<RecipeRow[]> {
  return query<RecipeRow>(
    `SELECT r.id, r.menu_item_id, m.menu_name, m.dine_in_price, r.yield_quantity
     FROM recipes r JOIN menu_items m ON m.id = r.menu_item_id WHERE r.active = 1 ORDER BY m.menu_name`,
  );
}

export async function recordWastage(input: {
  productId: string; quantity: number; reason: "prep_waste" | "spoilage" | "burnt" | "breakage" | "staff_meal" | "comped";
  costValue?: number; userId?: string; notes?: string;
}): Promise<void> {
  await assertModuleEntitled("hospitality");
  await requirePermission("hospitality.recipes.manage", { entityType: "wastage", metadata: { reason: input.reason } });
  await execute(
    `INSERT INTO hospitality_wastage (id, branch_id, product_id, quantity, reason, cost_value, user_id, notes)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    [uid(), getActiveBranchId(), input.productId, input.quantity, input.reason, input.costValue ?? null, input.userId ?? null, input.notes ?? null],
  );
}

// ─── Reports (Batch 8) ───────────────────────────────────────────────────────

export interface RestaurantReport { covers: number; orders: number; avgTicket: number; topCategories: Array<{ category: string; total: number }>; }
export async function restaurantReport(): Promise<RestaurantReport> {
  const [o] = await query<{ orders: number; revenue: number }>(
    `SELECT COUNT(DISTINCT o.id) AS orders, COALESCE(SUM(i.line_total),0) AS revenue
     FROM hospitality_orders o JOIN hospitality_order_items i ON i.order_id = o.id
     WHERE o.status = 'paid' AND i.status != 'voided'`,
  );
  const cats = await query<{ category: string; total: number }>(
    `SELECT COALESCE(m.category,'Uncategorised') AS category, SUM(i.line_total) AS total
     FROM hospitality_order_items i
     JOIN hospitality_orders o ON o.id = i.order_id
     LEFT JOIN menu_items m ON m.id = i.menu_item_id
     WHERE o.status = 'paid' AND i.status != 'voided'
     GROUP BY category ORDER BY total DESC LIMIT 8`,
  );
  const orders = o?.orders ?? 0;
  return { covers: orders, orders, avgTicket: orders > 0 ? (o.revenue / orders) : 0, topCategories: cats };
}

export interface HotelReport { totalRooms: number; occupied: number; occupancyPct: number; adr: number; revpar: number; }
export async function hotelReport(): Promise<HotelReport> {
  const [r] = await query<{ total: number; occupied: number }>(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) AS occupied FROM rooms WHERE active = 1`,
  );
  const [rev] = await query<{ room_revenue: number; nights: number }>(
    `SELECT COALESCE(SUM(amount + tax_amount),0) AS room_revenue, COUNT(*) AS nights
     FROM folio_charges WHERE charge_type = 'room'`,
  );
  const total = r?.total ?? 0, occupied = r?.occupied ?? 0;
  const adr = (rev?.nights ?? 0) > 0 ? rev.room_revenue / rev.nights : 0;
  return {
    totalRooms: total, occupied,
    occupancyPct: total > 0 ? Math.round((occupied / total) * 100) : 0,
    adr,
    revpar: total > 0 ? rev.room_revenue / total : 0,
  };
}
