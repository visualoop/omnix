/**
 * Salon / Spa service — appointments, staff, services, commissions.
 *
 * The unit of work is a timed appointment with a named staff member. Services
 * are backed by lightweight is_service products so they check out through the
 * normal POS → sale → GL → eTIMS path (no stock). Commission accrues to a
 * ledger on checkout. Reuses Core: customers = clients, completeSale, products.
 *
 * Mutations gate on the relevant salon.* permission.
 */
import { query, execute, transaction } from "@/lib/db";
import { requirePermission } from "@/services/rbac";
import { getActiveBranchId } from "@/stores/active-branch";
import { completeSale, type CartItem, type PaymentEntry } from "@/services/sales";
import { listEmployees, listLinkableUsers, upsertEmployee } from "@/services/employees";

const uid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

// ─── Types ───────────────────────────────────────────────────────────────────

export type AppointmentStatus =
  | "booked" | "confirmed" | "checked_in" | "in_service" | "completed" | "no_show" | "cancelled";

export interface SalonService {
  id: string;
  product_id: string | null;
  name: string;
  category: string | null;
  duration_min: number;
  price: number;
  commission_pct: number | null;
  requires_room: number;
  color: string | null;
  active: number;
  notes: string | null;
}

export interface SalonStaff {
  id: string;
  employee_id: string | null;
  user_id: string | null;
  display_name: string;
  color: string | null;
  commission_default_pct: number;
  active: number;
}

export interface SalonAppointment {
  id: string;
  appt_number: string;
  client_id: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  staff_id: string | null;
  staff_name?: string | null;
  resource_id?: string | null;
  resource_name?: string | null;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  notes: string | null;
  sale_id: string | null;
  total: number;
}

export interface AppointmentService {
  id: string;
  appointment_id: string;
  service_id: string;
  staff_id: string | null;
  name: string;
  price: number;
  duration_min: number;
  commission_amount: number;
}

// ─── Pure time helpers (unit-tested) ─────────────────────────────────────────

/** Minutes since midnight for a 'HH:MM' string. */
export function timeToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** ISO of `startIso` + `minutes`. */
export function addMinutesIso(startIso: string, minutes: number): string {
  return new Date(new Date(startIso).getTime() + minutes * 60_000).toISOString();
}

/** Do two [start,end) ISO intervals overlap? */
export function intervalsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = new Date(aStart).getTime(), ae = new Date(aEnd).getTime();
  const bs = new Date(bStart).getTime(), be = new Date(bEnd).getTime();
  return as < be && bs < ae;
}

// ─── Status transitions ───────────────────────────────────────────────────────

const ALLOWED: Record<AppointmentStatus, AppointmentStatus[]> = {
  booked: ["confirmed", "checked_in", "cancelled", "no_show"],
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: ["in_service", "cancelled", "no_show"],
  in_service: ["completed", "cancelled"],
  completed: [],
  no_show: [],
  cancelled: [],
};

export function canTransitionAppt(from: AppointmentStatus, to: AppointmentStatus): boolean {
  if (from === to) return true;
  return ALLOWED[from]?.includes(to) ?? false;
}

// ─── Services catalog ─────────────────────────────────────────────────────────

export async function listServices(includeInactive = false): Promise<SalonService[]> {
  return query<SalonService>(
    `SELECT * FROM salon_services ${includeInactive ? "" : "WHERE active = 1"} ORDER BY category, name`,
  );
}

export async function createService(input: {
  name: string; category?: string; duration_min: number; price: number;
  commission_pct?: number | null; requires_room?: boolean; color?: string; notes?: string;
}): Promise<string> {
  await requirePermission("salon.services.manage", { entityType: "salon_service" });
  const id = uid();
  const productId = uid();
  await transaction([
    // Backing non-stock product so the service checks out as a sale line.
    { sql: `INSERT INTO products (id, name, kind, is_service, tax_rate) VALUES (?1, ?2, 'physical', 1, 16.0)`,
      params: [productId, input.name] },
    { sql: `INSERT INTO salon_services (id, product_id, name, category, duration_min, price, commission_pct, requires_room, color, notes)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
      params: [id, productId, input.name, input.category ?? null, input.duration_min, input.price,
        input.commission_pct ?? null, input.requires_room ? 1 : 0, input.color ?? null, input.notes ?? null] },
  ]);
  return id;
}

export async function updateService(id: string, fields: Partial<{
  name: string; category: string; duration_min: number; price: number;
  commission_pct: number | null; requires_room: boolean; color: string; active: boolean; notes: string;
}>): Promise<void> {
  await requirePermission("salon.services.manage", { entityType: "salon_service", entityId: id });
  const sets: string[] = [];
  const params: unknown[] = [id];
  const push = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = ?${params.length}`); };
  if (fields.name !== undefined) push("name", fields.name);
  if (fields.category !== undefined) push("category", fields.category);
  if (fields.duration_min !== undefined) push("duration_min", fields.duration_min);
  if (fields.price !== undefined) push("price", fields.price);
  if (fields.commission_pct !== undefined) push("commission_pct", fields.commission_pct);
  if (fields.requires_room !== undefined) push("requires_room", fields.requires_room ? 1 : 0);
  if (fields.color !== undefined) push("color", fields.color);
  if (fields.active !== undefined) push("active", fields.active ? 1 : 0);
  if (fields.notes !== undefined) push("notes", fields.notes);
  if (sets.length === 0) return;
  await execute(`UPDATE salon_services SET ${sets.join(", ")} WHERE id = ?1`, params);
}

// ─── Staff + skills + hours ────────────────────────────────────────────────────

export async function listStaff(includeInactive = false): Promise<SalonStaff[]> {
  return query<SalonStaff>(
    `SELECT * FROM salon_staff ${includeInactive ? "" : "WHERE active = 1"} ORDER BY display_name`,
  );
}

export async function createStaff(input: {
  display_name: string; employee_id?: string; user_id?: string; color?: string; commission_default_pct?: number;
}): Promise<string> {
  await requirePermission("salon.staff.manage", { entityType: "salon_staff" });
  const id = uid();
  await execute(
    `INSERT INTO salon_staff (id, employee_id, user_id, display_name, color, commission_default_pct)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    [id, input.employee_id ?? null, input.user_id ?? null, input.display_name, input.color ?? null, input.commission_default_pct ?? 0],
  );
  return id;
}

export interface EnrollablePerson {
  kind: "employee" | "user";
  id: string;
  full_name: string;
  subtitle: string | null; // job title (employee) or role (login user)
}

/**
 * People who can be enrolled as salon staff: active HR employees PLUS login
 * users who don't yet have an employee record. This is the fix for "I added
 * staff in Settings but can't select them" — whoever you create (Settings →
 * Users or HR → Employees) shows up here.
 */
export async function listEnrollableStaff(): Promise<EnrollablePerson[]> {
  const [emps, users] = await Promise.all([listEmployees({ active: true }), listLinkableUsers()]);
  return [
    ...emps.map((e) => ({ kind: "employee" as const, id: e.id, full_name: e.full_name, subtitle: e.job_title || null })),
    ...users.map((u) => ({ kind: "user" as const, id: u.id, full_name: u.full_name || u.username, subtitle: u.role || null })),
  ];
}

/**
 * Enrol a person as salon staff. For a login-only user we first materialize a
 * linked HR employee (so salon_staff.employee_id stays valid and commissions /
 * reports keep working), then create the staff row — no duplicate people.
 */
export async function enrolStaff(person: EnrollablePerson, commissionPct: number): Promise<string> {
  await requirePermission("salon.staff.manage", { entityType: "salon_staff" });
  let employeeId = person.id;
  if (person.kind === "user") {
    employeeId = await upsertEmployee({
      full_name: person.full_name,
      job_title: person.subtitle || "Stylist",
      user_id: person.id,
    });
  }
  return createStaff({ display_name: person.full_name, employee_id: employeeId, commission_default_pct: commissionPct });
}

export async function setStaffSkills(staffId: string, serviceIds: string[]): Promise<void> {
  await requirePermission("salon.staff.manage", { entityType: "salon_staff", entityId: staffId });
  const stmts: { sql: string; params: unknown[] }[] = [
    { sql: `DELETE FROM salon_staff_services WHERE staff_id = ?1`, params: [staffId] },
  ];
  for (const sid of serviceIds) {
    stmts.push({ sql: `INSERT INTO salon_staff_services (staff_id, service_id) VALUES (?1, ?2)`, params: [staffId, sid] });
  }
  await transaction(stmts);
}

export async function listStaffSkills(staffId: string): Promise<string[]> {
  const rows = await query<{ service_id: string }>(`SELECT service_id FROM salon_staff_services WHERE staff_id = ?1`, [staffId]);
  return rows.map((r) => r.service_id);
}

export async function setStaffHours(staffId: string, hours: Array<{ weekday: number; start_time: string; end_time: string }>): Promise<void> {
  await requirePermission("salon.staff.manage", { entityType: "salon_staff", entityId: staffId });
  const stmts: { sql: string; params: unknown[] }[] = [
    { sql: `DELETE FROM salon_staff_hours WHERE staff_id = ?1`, params: [staffId] },
  ];
  for (const h of hours) {
    stmts.push({
      sql: `INSERT INTO salon_staff_hours (id, staff_id, weekday, start_time, end_time) VALUES (?1, ?2, ?3, ?4, ?5)`,
      params: [uid(), staffId, h.weekday, h.start_time, h.end_time],
    });
  }
  await transaction(stmts);
}

// ─── Appointments ──────────────────────────────────────────────────────────────

const SELECT_APPT = `
  SELECT a.*, c.name AS client_name, c.phone AS client_phone, s.display_name AS staff_name, r.name AS resource_name
  FROM salon_appointments a
  LEFT JOIN customers c ON c.id = a.client_id
  LEFT JOIN salon_staff s ON s.id = a.staff_id
  LEFT JOIN salon_resources r ON r.id = a.resource_id`;

export async function listAppointments(opts: { from: string; to: string; staffId?: string }): Promise<SalonAppointment[]> {
  const params: unknown[] = [opts.from, opts.to];
  let clause = `WHERE a.starts_at >= ?1 AND a.starts_at < ?2 AND a.status != 'cancelled'`;
  if (opts.staffId) { params.push(opts.staffId); clause += ` AND a.staff_id = ?${params.length}`; }
  return query<SalonAppointment>(`${SELECT_APPT} ${clause} ORDER BY a.starts_at ASC`, params);
}

/** Upcoming (not-yet-serviced) appointments within `hours` — for reminders. */
export async function listUpcomingAppointments(hours = 24): Promise<SalonAppointment[]> {
  const from = new Date().toISOString();
  const to = new Date(Date.now() + hours * 3_600_000).toISOString();
  return query<SalonAppointment>(
    `${SELECT_APPT} WHERE a.starts_at >= ?1 AND a.starts_at <= ?2 AND a.status IN ('booked','confirmed') ORDER BY a.starts_at ASC LIMIT 100`,
    [from, to],
  );
}

export async function getAppointment(id: string): Promise<{ appointment: SalonAppointment; services: AppointmentService[] } | null> {
  const [appointment] = await query<SalonAppointment>(`${SELECT_APPT} WHERE a.id = ?1`, [id]);
  if (!appointment) return null;
  const services = await query<AppointmentService>(`SELECT * FROM salon_appointment_services WHERE appointment_id = ?1`, [id]);
  return { appointment, services };
}

/** True if the staff member has no conflicting (non-cancelled) appointment. */
export async function isStaffAvailable(staffId: string, startIso: string, endIso: string, excludeApptId?: string): Promise<boolean> {
  const rows = await query<{ starts_at: string; ends_at: string }>(
    `SELECT starts_at, ends_at FROM salon_appointments
     WHERE staff_id = ?1 AND status NOT IN ('cancelled','no_show','completed')
       ${excludeApptId ? "AND id != ?2" : ""}`,
    excludeApptId ? [staffId, excludeApptId] : [staffId],
  );
  return !rows.some((r) => intervalsOverlap(startIso, endIso, r.starts_at, r.ends_at));
}

/** True if the resource (room/chair) is free in the window. */
export async function isResourceAvailable(resourceId: string, startIso: string, endIso: string, excludeApptId?: string): Promise<boolean> {
  const rows = await query<{ starts_at: string; ends_at: string }>(
    `SELECT starts_at, ends_at FROM salon_appointments
     WHERE resource_id = ?1 AND status NOT IN ('cancelled','no_show','completed')
       ${excludeApptId ? "AND id != ?2" : ""}`,
    excludeApptId ? [resourceId, excludeApptId] : [resourceId],
  );
  return !rows.some((r) => intervalsOverlap(startIso, endIso, r.starts_at, r.ends_at));
}

export interface SalonResource { id: string; name: string; type: string; active: number; }
export async function listResources(includeInactive = false): Promise<SalonResource[]> {
  return query<SalonResource>(`SELECT * FROM salon_resources ${includeInactive ? "" : "WHERE active = 1"} ORDER BY name`);
}
export async function createResource(name: string, type = "room"): Promise<string> {
  await requirePermission("salon.staff.manage", { entityType: "salon_resource" });
  const id = uid();
  await execute(`INSERT INTO salon_resources (id, name, type) VALUES (?1, ?2, ?3)`, [id, name, type]);
  return id;
}

export async function updateResource(id: string, fields: { name?: string; type?: string; active?: boolean }): Promise<void> {
  await requirePermission("salon.staff.manage", { entityType: "salon_resource", entityId: id });
  const sets: string[] = []; const params: unknown[] = [id];
  if (fields.name !== undefined) { sets.push(`name = ?${params.length + 1}`); params.push(fields.name); }
  if (fields.type !== undefined) { sets.push(`type = ?${params.length + 1}`); params.push(fields.type); }
  if (fields.active !== undefined) { sets.push(`active = ?${params.length + 1}`); params.push(fields.active ? 1 : 0); }
  if (sets.length === 0) return;
  await execute(`UPDATE salon_resources SET ${sets.join(", ")} WHERE id = ?1`, params);
}

export async function updateStaff(id: string, fields: { display_name?: string; commission_default_pct?: number; active?: boolean }): Promise<void> {
  await requirePermission("salon.staff.manage", { entityType: "salon_staff", entityId: id });
  const sets: string[] = []; const params: unknown[] = [id];
  if (fields.display_name !== undefined) { sets.push(`display_name = ?${params.length + 1}`); params.push(fields.display_name); }
  if (fields.commission_default_pct !== undefined) { sets.push(`commission_default_pct = ?${params.length + 1}`); params.push(fields.commission_default_pct); }
  if (fields.active !== undefined) { sets.push(`active = ?${params.length + 1}`); params.push(fields.active ? 1 : 0); }
  if (sets.length === 0) return;
  await execute(`UPDATE salon_staff SET ${sets.join(", ")} WHERE id = ?1`, params);
}

async function nextApptNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const [row] = await query<{ n: string }>(
    `SELECT COALESCE(MAX(CAST(SUBSTR(appt_number, 9) AS INTEGER)), 0) AS n FROM salon_appointments WHERE appt_number LIKE ?1`,
    [`AP-${year}-%`],
  );
  return `AP-${year}-${String(Number(row?.n ?? 0) + 1).padStart(5, "0")}`;
}

/** Compute per-service commission using the service pct, else the staff default. */
function commissionFor(price: number, servicePct: number | null, staffPct: number): number {
  const pct = servicePct != null ? servicePct : staffPct;
  return Math.round(price * (pct / 100) * 100) / 100;
}

/**
 * Book an appointment. Resolves the services (price + duration + commission),
 * computes the end time from total duration, checks the staff is free, and
 * writes the appointment + its service lines atomically.
 */
export async function bookAppointment(input: {
  client_id?: string | null;
  staff_id: string;
  starts_at: string;
  service_ids: string[];
  resource_id?: string | null;
  notes?: string;
}): Promise<{ id: string; appt_number: string }> {
  await requirePermission("salon.appointments.manage", { entityType: "salon_appointment" });
  if (input.service_ids.length === 0) throw new Error("Add at least one service.");

  const services = await query<SalonService>(
    `SELECT * FROM salon_services WHERE id IN (${input.service_ids.map((_, i) => `?${i + 1}`).join(",")})`,
    input.service_ids,
  );
  if (services.length === 0) throw new Error("Services not found.");
  const [staff] = await query<SalonStaff>(`SELECT * FROM salon_staff WHERE id = ?1`, [input.staff_id]);
  if (!staff) throw new Error("Staff not found.");

  const totalDuration = services.reduce((s, sv) => s + sv.duration_min, 0);
  const endsAt = addMinutesIso(input.starts_at, totalDuration);
  const total = services.reduce((s, sv) => s + sv.price, 0);

  if (!(await isStaffAvailable(input.staff_id, input.starts_at, endsAt))) {
    throw new Error(`${staff.display_name} is already booked in that time slot.`);
  }
  if (input.resource_id && !(await isResourceAvailable(input.resource_id, input.starts_at, endsAt))) {
    throw new Error("That room / resource is already booked in that slot.");
  }

  const id = uid();
  const apptNumber = await nextApptNumber();
  const stmts: { sql: string; params: unknown[] }[] = [{
    sql: `INSERT INTO salon_appointments (id, appt_number, client_id, staff_id, resource_id, starts_at, ends_at, status, notes, total, branch_id)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'booked', ?8, ?9, ?10)`,
    params: [id, apptNumber, input.client_id ?? null, input.staff_id, input.resource_id ?? null, input.starts_at, endsAt, input.notes ?? null, total, getActiveBranchId() || null],
  }];
  // preserve the requested service order
  for (const sid of input.service_ids) {
    const sv = services.find((x) => x.id === sid);
    if (!sv) continue;
    const commission = commissionFor(sv.price, sv.commission_pct, staff.commission_default_pct);
    stmts.push({
      sql: `INSERT INTO salon_appointment_services (id, appointment_id, service_id, staff_id, name, price, duration_min, commission_amount)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      params: [uid(), id, sv.id, input.staff_id, sv.name, sv.price, sv.duration_min, commission],
    });
  }
  await transaction(stmts);
  return { id, appt_number: apptNumber };
}

export async function updateAppointmentStatus(id: string, to: AppointmentStatus): Promise<void> {
  await requirePermission("salon.appointments.manage", { entityType: "salon_appointment", entityId: id });
  const [row] = await query<{ status: AppointmentStatus }>(`SELECT status FROM salon_appointments WHERE id = ?1`, [id]);
  if (!row) throw new Error("Appointment not found.");
  if (!canTransitionAppt(row.status, to)) throw new Error(`Cannot move a ${row.status} appointment to ${to}.`);
  await execute(`UPDATE salon_appointments SET status = ?2, updated_at = ?3 WHERE id = ?1`, [id, to, nowIso()]);
}

export async function rescheduleAppointment(id: string, startsAt: string, staffId?: string): Promise<void> {
  await requirePermission("salon.appointments.manage", { entityType: "salon_appointment", entityId: id });
  const detail = await getAppointment(id);
  if (!detail) throw new Error("Appointment not found.");
  const duration = detail.services.reduce((s, sv) => s + sv.duration_min, 0) || 30;
  const endsAt = addMinutesIso(startsAt, duration);
  const staff = staffId ?? detail.appointment.staff_id!;
  if (!(await isStaffAvailable(staff, startsAt, endsAt, id))) throw new Error("That slot is already booked.");
  await execute(
    `UPDATE salon_appointments SET starts_at = ?2, ends_at = ?3, staff_id = ?4, updated_at = ?5 WHERE id = ?1`,
    [id, startsAt, endsAt, staff, nowIso()],
  );
}

// ─── Checkout + commissions ─────────────────────────────────────────────────

/**
 * Check out an appointment: bill its services (+ optional retail products +
 * tip) through the POS/GL path, accrue staff commission, and mark the
 * appointment completed with the sale linked.
 */
export async function checkoutAppointment(input: {
  appointment_id: string;
  userId: string;
  payments: PaymentEntry[];
  tip?: number;
  retailItems?: CartItem[];
}): Promise<{ saleId: string }> {
  await requirePermission("salon.appointments.manage", { entityType: "salon_appointment", entityId: input.appointment_id });
  const detail = await getAppointment(input.appointment_id);
  if (!detail) throw new Error("Appointment not found.");
  const { appointment, services } = detail;
  if (appointment.sale_id) throw new Error("This appointment is already checked out.");
  if (services.length === 0) throw new Error("No services to bill.");

  // Backing product + tax for each service line.
  const productMap = new Map<string, { product_id: string; tax_rate: number }>();
  const svRows = await query<{ id: string; product_id: string; tax_rate: number }>(
    `SELECT s.id, s.product_id, COALESCE(p.tax_rate, 16) AS tax_rate
     FROM salon_services s LEFT JOIN products p ON p.id = s.product_id
     WHERE s.id IN (${services.map((_, i) => `?${i + 1}`).join(",")})`,
    services.map((s) => s.service_id),
  );
  for (const r of svRows) productMap.set(r.id, { product_id: r.product_id, tax_rate: r.tax_rate });

  // Prepaid packages: cover matching service lines (price → 0), decrementing
  // a session per covered service.
  const redeemStmts: { sql: string; params: unknown[] }[] = [];
  const pkgRemaining = new Map<string, { cpId: string; remaining: number }>(); // service_id → package balance
  if (appointment.client_id) {
    const pkgs = await listClientPackages(appointment.client_id, true);
    for (const pk of pkgs) {
      if (pk.service_id && !pkgRemaining.has(pk.service_id)) {
        pkgRemaining.set(pk.service_id, { cpId: pk.id, remaining: pk.sessions_remaining });
      }
    }
  }

  const serviceLines: CartItem[] = services.map((s) => {
    const backing = productMap.get(s.service_id);
    const bal = pkgRemaining.get(s.service_id);
    let price = s.price;
    if (bal && bal.remaining > 0) {
      price = 0;                       // covered by prepaid package
      bal.remaining -= 1;
      redeemStmts.push({
        sql: `UPDATE client_packages SET sessions_remaining = MAX(0, sessions_remaining - 1),
                active = CASE WHEN sessions_remaining - 1 <= 0 THEN 0 ELSE active END WHERE id = ?1`,
        params: [bal.cpId],
      });
    }
    return {
      id: uid(),
      product_id: backing?.product_id ?? s.service_id,
      service_id: s.service_id,
      name: bal && price === 0 ? `${s.name} (package)` : s.name,
      quantity: 1,
      unit_price: price,
      discount: 0,
      tax_rate: backing?.tax_rate ?? 16,
      total: price,
    };
  });
  const items = [...serviceLines, ...(input.retailItems ?? [])];

  const { saleId } = await completeSale(
    items,
    input.payments,
    appointment.client_id,
    input.userId,
    0,
    input.tip ?? 0,
    appointment.staff_id, // tip goes to the appointment's staff
    0,
    "salon_appointment",
    input.appointment_id,
  );

  // Accrue commissions (service lines) + mark appointment completed.
  const stmts: { sql: string; params: unknown[] }[] = [];
  for (const s of services) {
    if (!s.staff_id || s.commission_amount <= 0) continue;
    const pct = s.price > 0 ? (s.commission_amount / s.price) * 100 : 0;
    stmts.push({
      sql: `INSERT INTO salon_commissions (id, staff_id, appointment_id, sale_id, kind, base_amount, pct, amount)
            VALUES (?1, ?2, ?3, ?4, 'service', ?5, ?6, ?7)`,
      params: [uid(), s.staff_id, input.appointment_id, saleId, s.price, Math.round(pct * 100) / 100, s.commission_amount],
    });
  }
  // Back-bar: deduct professional products consumed by the services.
  const backBar = await backBarConsumptionStmts(services.map((s) => s.service_id), saleId);
  stmts.push(...backBar);
  stmts.push(...redeemStmts);
  stmts.push({
    sql: `UPDATE salon_appointments SET status = 'completed', sale_id = ?2, updated_at = ?3 WHERE id = ?1`,
    params: [input.appointment_id, saleId, nowIso()],
  });
  await transaction(stmts);
  return { saleId };
}

// ─── Client profile + history ───────────────────────────────────────────────

export interface ClientProfile {
  client_id: string;
  preferences: string | null;
  allergies: string | null;
  formulas: string | null;
  notes: string | null;
}

export async function getClientProfile(clientId: string): Promise<ClientProfile | null> {
  const [row] = await query<ClientProfile>(`SELECT * FROM salon_client_profiles WHERE client_id = ?1`, [clientId]);
  return row ?? null;
}

export async function upsertClientProfile(input: ClientProfile): Promise<void> {
  await requirePermission("salon.appointments.manage", { entityType: "salon_client", entityId: input.client_id });
  await execute(
    `INSERT INTO salon_client_profiles (client_id, preferences, allergies, formulas, notes, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT(client_id) DO UPDATE SET
       preferences = ?2, allergies = ?3, formulas = ?4, notes = ?5, updated_at = ?6`,
    [input.client_id, input.preferences ?? null, input.allergies ?? null, input.formulas ?? null, input.notes ?? null, nowIso()],
  );
}

export async function listClientVisits(clientId: string): Promise<SalonAppointment[]> {
  return query<SalonAppointment>(
    `${SELECT_APPT} WHERE a.client_id = ?1 AND a.status = 'completed' ORDER BY a.starts_at DESC LIMIT 100`,
    [clientId],
  );
}

// ─── Commission reads ─────────────────────────────────────────────────────────

export interface StaffCommissionRow { staff_id: string; display_name: string; jobs: number; total: number; }

export async function commissionsByStaff(fromIso: string, toIso: string): Promise<StaffCommissionRow[]> {
  return query<StaffCommissionRow>(
    `SELECT c.staff_id, st.display_name, COUNT(*) AS jobs, COALESCE(SUM(c.amount), 0) AS total
     FROM salon_commissions c JOIN salon_staff st ON st.id = c.staff_id
     WHERE c.created_at >= ?1 AND c.created_at < ?2
     GROUP BY c.staff_id ORDER BY total DESC`,
    [fromIso, toIso],
  );
}

// ─── Back-bar consumption ─────────────────────────────────────────────────────

export interface BackBarProduct { id: string; service_id: string; product_id: string; product_name?: string; quantity: number; }

export async function getServiceProducts(serviceId: string): Promise<BackBarProduct[]> {
  return query<BackBarProduct>(
    `SELECT sp.*, p.name AS product_name FROM salon_service_products sp
     JOIN products p ON p.id = sp.product_id WHERE sp.service_id = ?1`,
    [serviceId],
  );
}

/** Replace the back-bar product list for a service. */
export async function setServiceProducts(serviceId: string, items: Array<{ product_id: string; quantity: number }>): Promise<void> {
  await requirePermission("salon.services.manage", { entityType: "salon_service", entityId: serviceId });
  const stmts: { sql: string; params: unknown[] }[] = [
    { sql: `DELETE FROM salon_service_products WHERE service_id = ?1`, params: [serviceId] },
  ];
  for (const it of items) {
    stmts.push({
      sql: `INSERT INTO salon_service_products (id, service_id, product_id, quantity) VALUES (?1, ?2, ?3, ?4)`,
      params: [uid(), serviceId, it.product_id, it.quantity],
    });
  }
  await transaction(stmts);
}

/**
 * Build FEFO stock-deduction statements for the back-bar products consumed by
 * a set of services. Best-effort: a product with no stock is skipped (a
 * back-bar shortfall must never block a customer's checkout).
 */
async function backBarConsumptionStmts(serviceIds: string[], saleId: string): Promise<{ sql: string; params: unknown[] }[]> {
  if (serviceIds.length === 0) return [];
  const rows = await query<{ product_id: string; quantity: number }>(
    `SELECT product_id, SUM(quantity) AS quantity FROM salon_service_products
     WHERE service_id IN (${serviceIds.map((_, i) => `?${i + 1}`).join(",")})
     GROUP BY product_id`,
    serviceIds,
  );
  const stmts: { sql: string; params: unknown[] }[] = [];
  for (const r of rows) {
    let remaining = r.quantity;
    const batches = await query<{ id: string; quantity: number }>(
      `SELECT id, quantity FROM batches WHERE product_id = ?1 AND quantity > 0
       ORDER BY expiry_date ASC NULLS LAST, received_at ASC`,
      [r.product_id],
    );
    for (const b of batches) {
      if (remaining <= 0) break;
      const deduct = Math.min(remaining, b.quantity);
      stmts.push({ sql: `UPDATE batches SET quantity = MAX(0, quantity - ?1) WHERE id = ?2`, params: [deduct, b.id] });
      stmts.push({
        sql: `INSERT INTO stock_movements (id, product_id, batch_id, type, quantity, reference_type, reference_id, notes)
              VALUES (?1, ?2, ?3, 'adjustment', ?4, 'salon_backbar', ?5, 'Back-bar consumption')`,
        params: [uid(), r.product_id, b.id, -deduct, saleId],
      });
      remaining -= deduct;
    }
  }
  return stmts;
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export interface ServicePopularityRow { service_id: string; name: string; count: number; revenue: number; }

export async function servicePopularity(fromIso: string, toIso: string): Promise<ServicePopularityRow[]> {
  return query<ServicePopularityRow>(
    `SELECT s.service_id, s.name, COUNT(*) AS count, COALESCE(SUM(s.price), 0) AS revenue
     FROM salon_appointment_services s
     JOIN salon_appointments a ON a.id = s.appointment_id
     WHERE a.status = 'completed' AND a.starts_at >= ?1 AND a.starts_at < ?2
     GROUP BY s.service_id ORDER BY count DESC LIMIT 50`,
    [fromIso, toIso],
  );
}

// ─── Packages / memberships ───────────────────────────────────────────────────

export interface SalonPackage {
  id: string; product_id: string | null; name: string; service_id: string | null;
  service_name?: string | null; sessions: number; price: number; validity_days: number | null; active: number;
}
export interface ClientPackage {
  id: string; client_id: string; package_id: string; service_id: string | null; package_name?: string;
  sessions_total: number; sessions_remaining: number; purchased_at: string; expires_at: string | null; active: number;
}

export async function listPackages(includeInactive = false): Promise<SalonPackage[]> {
  return query<SalonPackage>(
    `SELECT pk.*, s.name AS service_name FROM salon_packages pk
     LEFT JOIN salon_services s ON s.id = pk.service_id
     ${includeInactive ? "" : "WHERE pk.active = 1"} ORDER BY pk.name`,
  );
}

export async function createPackage(input: {
  name: string; service_id: string; sessions: number; price: number; validity_days?: number | null;
}): Promise<string> {
  await requirePermission("salon.services.manage", { entityType: "salon_package" });
  const id = uid();
  const productId = uid();
  await transaction([
    { sql: `INSERT INTO products (id, name, kind, is_service, tax_rate) VALUES (?1, ?2, 'physical', 1, 16.0)`, params: [productId, input.name] },
    { sql: `INSERT INTO salon_packages (id, product_id, name, service_id, sessions, price, validity_days)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      params: [id, productId, input.name, input.service_id, input.sessions, input.price, input.validity_days ?? null] },
  ]);
  return id;
}

export async function updatePackage(id: string, fields: {
  name: string; service_id: string; sessions: number; price: number; validity_days?: number | null; active?: boolean;
}): Promise<void> {
  await requirePermission("salon.services.manage", { entityType: "salon_package", entityId: id });
  const [pkg] = await query<{ product_id: string | null }>(`SELECT product_id FROM salon_packages WHERE id = ?1`, [id]);
  await execute(
    `UPDATE salon_packages SET name = ?2, service_id = ?3, sessions = ?4, price = ?5, validity_days = ?6, active = ?7 WHERE id = ?1`,
    [id, fields.name, fields.service_id, fields.sessions, fields.price, fields.validity_days ?? null, fields.active === false ? 0 : 1],
  );
  // Keep the backing is_service product's name in sync.
  if (pkg?.product_id) {
    await execute(`UPDATE products SET name = ?2 WHERE id = ?1`, [pkg.product_id, fields.name]);
  }
}

/** Sell a package to a client (prepaid) — books the sale + creates the balance. */
export async function sellPackage(input: {
  client_id: string; package_id: string; userId: string; payments: PaymentEntry[];
}): Promise<{ saleId: string; clientPackageId: string }> {
  await requirePermission("salon.appointments.manage", { entityType: "client_package" });
  const [pkg] = await query<SalonPackage>(`SELECT * FROM salon_packages WHERE id = ?1`, [input.package_id]);
  if (!pkg) throw new Error("Package not found.");

  const { saleId } = await completeSale(
    [{ id: uid(), product_id: pkg.product_id ?? pkg.id, service_id: pkg.service_id, name: pkg.name, quantity: 1, unit_price: pkg.price, discount: 0, tax_rate: 16, total: pkg.price }],
    input.payments, input.client_id, input.userId, 0, 0, null, 0, "salon_package", input.package_id,
  );

  const cpId = uid();
  const expiresAt = pkg.validity_days ? addMinutesIso(nowIso(), pkg.validity_days * 24 * 60) : null;
  await execute(
    `INSERT INTO client_packages (id, client_id, package_id, service_id, sessions_total, sessions_remaining, expires_at, purchase_sale_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?6, ?7)`,
    [cpId, input.client_id, input.package_id, pkg.service_id, pkg.sessions, expiresAt, saleId],
  );
  return { saleId, clientPackageId: cpId };
}

export async function listClientPackages(clientId: string, redeemableOnly = false): Promise<ClientPackage[]> {
  return query<ClientPackage>(
    `SELECT cp.*, pk.name AS package_name FROM client_packages cp
     JOIN salon_packages pk ON pk.id = cp.package_id
     WHERE cp.client_id = ?1 AND cp.active = 1
       ${redeemableOnly ? "AND cp.sessions_remaining > 0 AND (cp.expires_at IS NULL OR cp.expires_at > datetime('now'))" : ""}
     ORDER BY cp.purchased_at DESC`,
    [clientId],
  );
}
