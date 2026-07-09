/**
 * Equipment service — DMS Phase 1.
 *
 * A serialized "unit" is one physical machine (generator, excavator, mixer,
 * vehicle…) tracked by a unique serial through its whole life. Units are
 * created when equipment stock is received, flip to `sold` at checkout with
 * a per-unit warranty derived from the sale date, and surface again for
 * warranty lookup + expiry alerts. Catalog specs live as JSON on the
 * product; per-unit specs can override.
 *
 * All mutating ops assert the hardware entitlement + the equipment
 * permission. Reads are open to any authenticated session (POS needs to
 * list in-stock units to sell them).
 */
import { query, execute, transaction } from "@/lib/db";
import { requirePermission } from "@/services/rbac";
import { getActiveBranchId } from "@/stores/active-branch";

const uid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

export type UnitCondition = "new" | "used" | "refurbished";
export type UnitStatus =
  | "in_stock"
  | "reserved"
  | "sold"
  | "rented"
  | "in_service"
  | "written_off";

export type MeterUnit = "hours" | "km";

/** Catalog-level equipment specs (stored as JSON on products.specs_json). */
export interface EquipmentSpecs {
  make?: string;
  model?: string;
  category?: string;        // e.g. "Generator", "Excavator", "Concrete mixer"
  engine_power?: string;    // free text e.g. "45 kW", "60 HP"
  displacement?: string;    // e.g. "2500 cc"
  fuel?: string;            // diesel | petrol | electric | ...
  operating_weight?: string;
  rating?: string;          // e.g. "30 kVA", "0.5 m³", "5 t"
  [key: string]: string | undefined;
}

export interface EquipmentUnit {
  id: string;
  product_id: string;
  product_name?: string;
  serial_number: string;
  engine_number: string | null;
  chassis_number: string | null;
  year_of_manufacture: number | null;
  condition: UnitCondition;
  status: UnitStatus;
  acquisition_cost: number | null;
  acquired_at: string;
  branch_id: string | null;
  location: string | null;
  meter_value: number | null;
  meter_unit: MeterUnit | null;
  sale_id: string | null;
  customer_id: string | null;
  customer_name?: string | null;
  sold_at: string | null;
  warranty_months: number | null;
  warranty_start: string | null;
  warranty_expiry: string | null;
  specs_json: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Warranty math (pure, unit-tested) ───────────────────────────────────────

/**
 * Add `months` calendar months to an ISO date, clamping day-of-month on
 * short months (e.g. 2024-01-31 + 1 month → 2024-02-29, not March 2/3).
 * Returns an ISO date-time string. `months <= 0` returns the start unchanged.
 */
export function addMonths(startIso: string, months: number): string {
  const d = new Date(startIso);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${startIso}`);
  if (!months || months <= 0) return d.toISOString();
  const day = d.getUTCDate();
  const target = new Date(d.getTime());
  target.setUTCDate(1);                                 // avoid rollover while shifting month
  target.setUTCMonth(target.getUTCMonth() + months);
  // clamp to the last valid day of the target month
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString();
}

/** Compute {start, expiry} for a warranty of `months` starting at `saleIso`. */
export function computeWarranty(
  saleIso: string,
  months: number | null | undefined,
): { start: string | null; expiry: string | null; months: number | null } {
  if (!months || months <= 0) return { start: null, expiry: null, months: null };
  return { start: saleIso, expiry: addMonths(saleIso, months), months };
}

export type WarrantyState = "none" | "active" | "expiring" | "expired";

/**
 * Classify a unit's warranty relative to `nowIso`. `expiringDays` (default 30)
 * is the window before expiry that counts as "expiring".
 */
export function warrantyState(
  expiryIso: string | null | undefined,
  now: Date = new Date(),
  expiringDays = 30,
): WarrantyState {
  if (!expiryIso) return "none";
  const expiry = new Date(expiryIso).getTime();
  if (Number.isNaN(expiry)) return "none";
  const ms = expiry - now.getTime();
  if (ms < 0) return "expired";
  if (ms <= expiringDays * 86_400_000) return "expiring";
  return "active";
}

/** Days remaining until warranty expiry (negative = expired), or null. */
export function warrantyDaysRemaining(
  expiryIso: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!expiryIso) return null;
  const expiry = new Date(expiryIso).getTime();
  if (Number.isNaN(expiry)) return null;
  return Math.ceil((expiry - now.getTime()) / 86_400_000);
}

// ─── Legal status transitions ────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<UnitStatus, UnitStatus[]> = {
  in_stock: ["reserved", "sold", "rented", "in_service", "written_off"],
  reserved: ["in_stock", "sold", "written_off"],
  sold: ["in_service", "written_off"],       // a sold machine can come in for service
  rented: ["in_stock", "in_service", "written_off"],
  in_service: ["in_stock", "sold", "rented", "written_off"],
  written_off: [],                            // terminal
};

export function canTransition(from: UnitStatus, to: UnitStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Reads ───────────────────────────────────────────────────────────────────

const SELECT_UNIT = `
  SELECT u.*, p.name AS product_name, c.name AS customer_name
  FROM equipment_units u
  JOIN products p ON p.id = u.product_id
  LEFT JOIN customers c ON c.id = u.customer_id`;

export async function listUnits(opts?: {
  productId?: string;
  status?: UnitStatus;
  search?: string;
  limit?: number;
}): Promise<EquipmentUnit[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts?.productId) { params.push(opts.productId); where.push(`u.product_id = ?${params.length}`); }
  if (opts?.status) { params.push(opts.status); where.push(`u.status = ?${params.length}`); }
  if (opts?.search) {
    const like = `%${opts.search.trim()}%`;
    params.push(like, like, like, like);
    where.push(`(u.serial_number LIKE ?${params.length - 3} OR u.engine_number LIKE ?${params.length - 2} OR u.chassis_number LIKE ?${params.length - 1} OR p.name LIKE ?${params.length})`);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = opts?.limit ? `LIMIT ${Math.max(1, Math.floor(opts.limit))}` : "";
  return query<EquipmentUnit>(`${SELECT_UNIT} ${clause} ORDER BY u.created_at DESC ${limit}`, params);
}

export async function getUnit(id: string): Promise<EquipmentUnit | null> {
  const [row] = await query<EquipmentUnit>(`${SELECT_UNIT} WHERE u.id = ?1`, [id]);
  return row ?? null;
}

/** Warranty lookup + resale identification by exact serial. */
export async function findUnitBySerial(serial: string): Promise<EquipmentUnit | null> {
  const [row] = await query<EquipmentUnit>(`${SELECT_UNIT} WHERE u.serial_number = ?1`, [serial.trim()]);
  return row ?? null;
}

/** In-stock units available to sell/reserve for a product. */
export async function availableUnits(productId: string): Promise<EquipmentUnit[]> {
  return query<EquipmentUnit>(
    `${SELECT_UNIT} WHERE u.product_id = ?1 AND u.status = 'in_stock' ORDER BY u.acquired_at ASC`,
    [productId],
  );
}

/** Units free to hire out (in stock, not already sold/rented/serviced). */
export async function listRentableUnits(search?: string): Promise<EquipmentUnit[]> {
  const like = search?.trim() ? `%${search.trim()}%` : null;
  return query<EquipmentUnit>(
    `${SELECT_UNIT} WHERE u.status = 'in_stock'
       ${like ? "AND (u.serial_number LIKE ?1 OR p.name LIKE ?1)" : ""}
     ORDER BY p.name ASC, u.serial_number ASC LIMIT 200`,
    like ? [like] : [],
  );
}

export async function countByStatus(): Promise<Record<UnitStatus, number>> {
  const rows = await query<{ status: UnitStatus; n: number }>(
    `SELECT status, COUNT(*) AS n FROM equipment_units GROUP BY status`,
  );
  const out = { in_stock: 0, reserved: 0, sold: 0, rented: 0, in_service: 0, written_off: 0 } as Record<UnitStatus, number>;
  for (const r of rows) out[r.status] = Number(r.n);
  return out;
}

/** Units whose warranty expires within `days` (or already expired but sold). */
export async function listExpiringWarranties(days = 30): Promise<EquipmentUnit[]> {
  const cutoff = new Date(Date.now() + days * 86_400_000).toISOString();
  return query<EquipmentUnit>(
    `${SELECT_UNIT}
     WHERE u.warranty_expiry IS NOT NULL
       AND u.status IN ('sold','in_service','rented')
       AND u.warranty_expiry <= ?1
     ORDER BY u.warranty_expiry ASC`,
    [cutoff],
  );
}

// ─── Writes ──────────────────────────────────────────────────────────────────

export interface ReceiveUnitInput {
  serial_number: string;
  engine_number?: string;
  chassis_number?: string;
  year_of_manufacture?: number;
  condition?: UnitCondition;
  acquisition_cost?: number;
  meter_value?: number;
  meter_unit?: MeterUnit;
  location?: string;
  specs?: EquipmentSpecs;
  notes?: string;
}

/**
 * Receive one or more serialized units into stock for a product. Serials
 * must be unique across the fleet; a clash throws before anything is written.
 */
export async function receiveUnits(
  productId: string,
  units: ReceiveUnitInput[],
  opts?: { branch_id?: string },
): Promise<string[]> {
  await requirePermission("hardware.equipment.manage", { entityType: "equipment_unit" });
  if (units.length === 0) return [];

  // Pre-flight: reject blank + duplicate serials (in-batch and existing).
  const serials = units.map((u) => u.serial_number.trim());
  if (serials.some((s) => !s)) throw new Error("Every unit needs a serial number.");
  const dupInBatch = serials.find((s, i) => serials.indexOf(s) !== i);
  if (dupInBatch) throw new Error(`Duplicate serial in this batch: ${dupInBatch}`);
  const existing = await query<{ serial_number: string }>(
    `SELECT serial_number FROM equipment_units WHERE serial_number IN (${serials.map((_, i) => `?${i + 1}`).join(",")})`,
    serials,
  );
  if (existing.length) throw new Error(`Serial already exists: ${existing.map((e) => e.serial_number).join(", ")}`);

  const branch = opts?.branch_id ?? getActiveBranchId() ?? null;
  const ids: string[] = [];
  for (const u of units) {
    const id = uid();
    ids.push(id);
    await execute(
      `INSERT INTO equipment_units
        (id, product_id, serial_number, engine_number, chassis_number, year_of_manufacture,
         condition, status, acquisition_cost, branch_id, location, meter_value, meter_unit,
         specs_json, notes)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'in_stock', ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,
      [
        id, productId, u.serial_number.trim(), u.engine_number ?? null, u.chassis_number ?? null,
        u.year_of_manufacture ?? null, u.condition ?? "new", u.acquisition_cost ?? null,
        branch ?? null, u.location ?? null, u.meter_value ?? null, u.meter_unit ?? "hours",
        u.specs ? JSON.stringify(u.specs) : null, u.notes ?? null,
      ],
    );
  }
  return ids;
}

/** Reserve an in-stock unit (e.g. when quoted). Idempotent if already reserved. */
export async function reserveUnit(unitId: string): Promise<void> {
  await requirePermission("hardware.equipment.manage", { entityType: "equipment_unit", entityId: unitId });
  await setStatus(unitId, "reserved");
}

/** Release a reserved unit back to stock. */
export async function releaseUnit(unitId: string): Promise<void> {
  await requirePermission("hardware.equipment.manage", { entityType: "equipment_unit", entityId: unitId });
  await setStatus(unitId, "in_stock");
}

async function setStatus(unitId: string, to: UnitStatus): Promise<void> {
  const [row] = await query<{ status: UnitStatus }>(`SELECT status FROM equipment_units WHERE id = ?1`, [unitId]);
  if (!row) throw new Error("Unit not found.");
  if (!canTransition(row.status, to)) {
    throw new Error(`Cannot move a unit from ${row.status} to ${to}.`);
  }
  await execute(`UPDATE equipment_units SET status = ?2, updated_at = ?3 WHERE id = ?1`, [unitId, to, nowIso()]);
}

/**
 * Mark a specific unit sold against a sale. Sets the buyer + a per-unit
 * warranty derived from the sale date (warranty_months falls back to the
 * product's default when not given). Returns the computed warranty.
 *
 * Designed to be called right after completeSale() with the produced sale id.
 */
export async function markUnitSold(input: {
  unitId: string;
  saleId: string;
  customerId?: string | null;
  saleDate?: string;                 // defaults to now
  warrantyMonths?: number | null;    // overrides the product default
}): Promise<{ warranty_start: string | null; warranty_expiry: string | null }> {
  await requirePermission("hardware.equipment.manage", { entityType: "equipment_unit", entityId: input.unitId });

  const [row] = await query<{ status: UnitStatus; product_id: string }>(
    `SELECT status, product_id FROM equipment_units WHERE id = ?1`,
    [input.unitId],
  );
  if (!row) throw new Error("Unit not found.");
  if (row.status === "sold") throw new Error("Unit is already sold.");
  if (!canTransition(row.status, "sold")) throw new Error(`Cannot sell a unit that is ${row.status}.`);

  // Resolve warranty months: explicit override → product default.
  let months = input.warrantyMonths ?? null;
  if (months == null) {
    const [pr] = await query<{ warranty_months: number | null }>(
      `SELECT warranty_months FROM products WHERE id = ?1`,
      [row.product_id],
    );
    months = pr?.warranty_months ?? null;
  }
  const saleDate = input.saleDate ?? nowIso();
  const w = computeWarranty(saleDate, months);

  await execute(
    `UPDATE equipment_units
     SET status = 'sold', sale_id = ?2, customer_id = ?3, sold_at = ?4,
         warranty_months = ?5, warranty_start = ?6, warranty_expiry = ?7, updated_at = ?8
     WHERE id = ?1`,
    [input.unitId, input.saleId, input.customerId ?? null, saleDate,
     w.months, w.start, w.expiry, nowIso()],
  );
  return { warranty_start: w.start, warranty_expiry: w.expiry };
}

/**
 * After a POS/quote sale completes, flip each serialized line's unit to
 * `sold` with a per-unit warranty derived from the sale date. Called from
 * the checkout finalizer — NOT permission-gated, because completing the
 * sale is itself the authorization (a cashier need not hold the equipment
 * management permission). Resilient: a single bad/missing unit is skipped
 * and never fails the completed sale.
 */
export async function finalizeEquipmentSale(
  lines: Array<{ equipment_unit_id?: string | null }>,
  saleId: string,
  customerId: string | null,
  saleDate?: string,
): Promise<void> {
  const unitIds = lines.map((l) => l.equipment_unit_id).filter((x): x is string => !!x);
  if (unitIds.length === 0) return;
  const when = saleDate ?? nowIso();
  for (const unitId of unitIds) {
    try {
      const [row] = await query<{ status: UnitStatus; product_id: string }>(
        `SELECT status, product_id FROM equipment_units WHERE id = ?1`,
        [unitId],
      );
      if (!row || row.status === "sold" || row.status === "written_off") continue;
      const [pr] = await query<{ warranty_months: number | null }>(
        `SELECT warranty_months FROM products WHERE id = ?1`,
        [row.product_id],
      );
      const w = computeWarranty(when, pr?.warranty_months ?? null);
      await execute(
        `UPDATE equipment_units
         SET status = 'sold', sale_id = ?2, customer_id = ?3, sold_at = ?4,
             warranty_months = ?5, warranty_start = ?6, warranty_expiry = ?7, updated_at = ?8
         WHERE id = ?1`,
        [unitId, saleId, customerId, when, w.months, w.start, w.expiry, nowIso()],
      );
    } catch (e) {
      console.error(`finalizeEquipmentSale: unit ${unitId} skipped`, e);
    }
  }
}

/** Record a meter reading (hours/km) on a unit. */
export async function updateMeter(unitId: string, value: number, unit?: MeterUnit): Promise<void> {
  await requirePermission("hardware.equipment.manage", { entityType: "equipment_unit", entityId: unitId });
  await execute(
    `UPDATE equipment_units SET meter_value = ?2, meter_unit = COALESCE(?3, meter_unit), updated_at = ?4 WHERE id = ?1`,
    [unitId, value, unit ?? null, nowIso()],
  );
}

/** Write off a unit (terminal). */
export async function writeOffUnit(unitId: string, reason?: string): Promise<void> {
  await requirePermission("hardware.equipment.manage", { entityType: "equipment_unit", entityId: unitId });
  await execute(
    `UPDATE equipment_units SET status = 'written_off', notes = COALESCE(?2, notes), updated_at = ?3 WHERE id = ?1`,
    [unitId, reason ?? null, nowIso()],
  );
}

// ─── Product-level specs helpers ─────────────────────────────────────────────

export function parseSpecs(specsJson: string | null | undefined): EquipmentSpecs {
  if (!specsJson) return {};
  try {
    const v = JSON.parse(specsJson);
    return v && typeof v === "object" ? (v as EquipmentSpecs) : {};
  } catch {
    return {};
  }
}

/** Human-readable one-line summary of specs for list rows. */
export function specSummary(specsJson: string | null | undefined): string {
  const s = parseSpecs(specsJson);
  const parts = [s.make, s.model, s.rating || s.engine_power].filter(Boolean);
  return parts.join(" · ");
}

/** Configure a product as serial-tracked equipment with catalog specs.
 *  This is catalog configuration, so it's gated on inventory.edit (Core) —
 *  available wherever serials are tracked, not only the hardware module. */
export async function setProductEquipment(
  productId: string,
  cfg: { tracked_by_serial: boolean; warranty_months?: number | null; specs?: EquipmentSpecs },
): Promise<void> {
  await requirePermission("inventory.edit", { entityType: "product", entityId: productId });
  await execute(
    `UPDATE products SET tracked_by_serial = ?2, warranty_months = ?3, specs_json = ?4 WHERE id = ?1`,
    [productId, cfg.tracked_by_serial ? 1 : 0, cfg.warranty_months ?? null,
     cfg.specs && Object.keys(cfg.specs).length ? JSON.stringify(cfg.specs) : null],
  );
}

// ─── Serial-tracked catalog + receiving ──────────────────────────────────────

export interface EquipmentProduct {
  id: string;
  name: string;
  warranty_months: number | null;
  specs_json: string | null;
}

/** Products flagged as serial-tracked equipment (for the receive/fleet pickers). */
export async function listEquipmentProducts(): Promise<EquipmentProduct[]> {
  return query<EquipmentProduct>(
    `SELECT id, name, warranty_months, specs_json
     FROM products
     WHERE tracked_by_serial = 1 AND active = 1
     ORDER BY name ASC`,
  );
}

/**
 * Receive serialized units into stock, atomically. For each unit this
 * creates a qty-1 stock batch (so it's sellable + costed) + a purchase
 * stock movement + the equipment_unit registry row — all in ONE
 * transaction so a mid-batch failure never half-applies. Serials are
 * pre-flighted for uniqueness before any write.
 *
 * Returns the created unit ids.
 */
export async function receiveEquipmentUnits(
  productId: string,
  units: ReceiveUnitInput[],
  meta: { userId: string; branchId?: string; supplier?: string; reference?: string },
): Promise<string[]> {
  await requirePermission("hardware.equipment.manage", { entityType: "equipment_unit" });
  if (units.length === 0) return [];

  const serials = units.map((u) => u.serial_number.trim());
  if (serials.some((s) => !s)) throw new Error("Every unit needs a serial number.");
  const dup = serials.find((s, i) => serials.indexOf(s) !== i);
  if (dup) throw new Error(`Duplicate serial in this batch: ${dup}`);
  const existing = await query<{ serial_number: string }>(
    `SELECT serial_number FROM equipment_units WHERE serial_number IN (${serials.map((_, i) => `?${i + 1}`).join(",")})`,
    serials,
  );
  if (existing.length) throw new Error(`Serial already exists: ${existing.map((e) => e.serial_number).join(", ")}`);

  const branch = meta.branchId ?? getActiveBranchId() ?? null;
  const ref = meta.reference || "Equipment receive";
  const note = `Equipment receive${meta.supplier ? ` · ${meta.supplier}` : ""}${meta.reference ? ` · ${meta.reference}` : ""}`;
  const ids: string[] = [];
  const stmts: { sql: string; params: unknown[] }[] = [];

  for (const u of units) {
    const unitId = uid();
    const batchId = uid();
    const cost = u.acquisition_cost ?? 0;
    ids.push(unitId);

    stmts.push({
      sql: `INSERT INTO batches (id, product_id, batch_number, quantity, buying_price, expiry_date, branch_id)
            VALUES (?1, ?2, ?3, 1, ?4, NULL, ?5)`,
      params: [batchId, productId, u.serial_number.trim(), cost, branch],
    });
    stmts.push({
      sql: `INSERT INTO stock_movements (id, product_id, batch_id, type, quantity, reference_type, reference_id, notes, user_id)
            VALUES (?1, ?2, ?3, 'purchase', 1, 'equipment_receive', ?4, ?5, ?6)`,
      params: [uid(), productId, batchId, ref, note, meta.userId],
    });
    stmts.push({
      sql: `INSERT INTO equipment_units
              (id, product_id, serial_number, engine_number, chassis_number, year_of_manufacture,
               condition, status, acquisition_cost, branch_id, location, meter_value, meter_unit,
               specs_json, notes)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'in_stock', ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,
      params: [
        unitId, productId, u.serial_number.trim(), u.engine_number ?? null, u.chassis_number ?? null,
        u.year_of_manufacture ?? null, u.condition ?? "new", cost, branch, u.location ?? null,
        u.meter_value ?? null, u.meter_unit ?? "hours",
        u.specs ? JSON.stringify(u.specs) : null, u.notes ?? null,
      ],
    });
  }

  await transaction(stmts);
  return ids;
}
