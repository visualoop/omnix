/**
 * Service (workshop) service — Equipment DMS Phase 2.
 *
 * A service job is a repair/maintenance order against a tracked equipment
 * unit. Parts are consumed from stock as they're added (FEFO, an inventory
 * adjustment), labour is captured as lines, and the job knows whether it's
 * covered by the unit's active warranty (warranty jobs bill nothing).
 * Non-warranty jobs can be billed via a standard invoice.
 *
 * Mutating ops assert the hardware entitlement + hardware.equipment.manage.
 */
import { query, execute, transaction } from "@/lib/db";
import { assertModuleEntitled } from "@/services/license";
import { requirePermission } from "@/services/rbac";
import { getActiveBranchId } from "@/stores/active-branch";
import { warrantyState } from "@/services/equipment";
import { createInvoice } from "@/services/invoicing";

const uid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

export type ServiceStatus =
  | "open"
  | "in_progress"
  | "awaiting_parts"
  | "completed"
  | "cancelled"
  | "invoiced";

export interface ServiceJob {
  id: string;
  job_number: string;
  unit_id: string;
  serial_number?: string;
  product_name?: string;
  warranty_expiry?: string | null;
  customer_id: string | null;
  customer_name?: string | null;
  status: ServiceStatus;
  reported_fault: string | null;
  diagnosis: string | null;
  is_warranty: number;
  technician_id: string | null;
  technician_name?: string | null;
  meter_in: number | null;
  labour_total: number;
  parts_total: number;
  invoice_id: string | null;
  opened_at: string;
  completed_at: string | null;
  branch_id: string | null;
  notes: string | null;
}

export interface ServiceJobPart {
  id: string;
  job_id: string;
  product_id: string;
  product_name: string;
  batch_id: string | null;
  quantity: number;
  unit_cost: number;
  unit_price: number;
  line_total: number;
}

export interface ServiceJobLabour {
  id: string;
  job_id: string;
  description: string;
  hours: number;
  rate: number;
  line_total: number;
  technician_id: string | null;
}

export interface ServiceJobDetail {
  job: ServiceJob;
  parts: ServiceJobPart[];
  labour: ServiceJobLabour[];
}

// ─── Status transitions ──────────────────────────────────────────────────────

const ALLOWED: Record<ServiceStatus, ServiceStatus[]> = {
  open: ["in_progress", "awaiting_parts", "cancelled"],
  in_progress: ["awaiting_parts", "completed", "cancelled"],
  awaiting_parts: ["in_progress", "completed", "cancelled"],
  completed: ["invoiced", "in_progress"],       // reopen or bill
  cancelled: [],
  invoiced: [],
};

export function canTransitionJob(from: ServiceStatus, to: ServiceStatus): boolean {
  if (from === to) return true;
  return ALLOWED[from]?.includes(to) ?? false;
}

// ─── Reads ───────────────────────────────────────────────────────────────────

const SELECT_JOB = `
  SELECT j.*, u.serial_number, u.warranty_expiry, p.name AS product_name,
         c.name AS customer_name, us.full_name AS technician_name
  FROM service_jobs j
  JOIN equipment_units u ON u.id = j.unit_id
  JOIN products p ON p.id = u.product_id
  LEFT JOIN customers c ON c.id = j.customer_id
  LEFT JOIN users us ON us.id = j.technician_id`;

export async function listServiceJobs(opts?: {
  status?: ServiceStatus;
  search?: string;
  limit?: number;
}): Promise<ServiceJob[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts?.status) { params.push(opts.status); where.push(`j.status = ?${params.length}`); }
  if (opts?.search) {
    const like = `%${opts.search.trim()}%`;
    params.push(like, like, like);
    where.push(`(j.job_number LIKE ?${params.length - 2} OR u.serial_number LIKE ?${params.length - 1} OR c.name LIKE ?${params.length})`);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = opts?.limit ? `LIMIT ${Math.max(1, Math.floor(opts.limit))}` : "LIMIT 300";
  return query<ServiceJob>(`${SELECT_JOB} ${clause} ORDER BY j.opened_at DESC ${limit}`, params);
}

export async function getServiceJob(id: string): Promise<ServiceJobDetail | null> {
  const [job] = await query<ServiceJob>(`${SELECT_JOB} WHERE j.id = ?1`, [id]);
  if (!job) return null;
  const parts = await query<ServiceJobPart>(`SELECT * FROM service_job_parts WHERE job_id = ?1 ORDER BY created_at ASC`, [id]);
  const labour = await query<ServiceJobLabour>(`SELECT * FROM service_job_labour WHERE job_id = ?1 ORDER BY created_at ASC`, [id]);
  return { job, parts, labour };
}

export async function listJobsForUnit(unitId: string): Promise<ServiceJob[]> {
  return query<ServiceJob>(`${SELECT_JOB} WHERE j.unit_id = ?1 ORDER BY j.opened_at DESC`, [unitId]);
}

export async function countJobsByStatus(): Promise<Record<ServiceStatus, number>> {
  const rows = await query<{ status: ServiceStatus; n: number }>(
    `SELECT status, COUNT(*) AS n FROM service_jobs GROUP BY status`,
  );
  const out = { open: 0, in_progress: 0, awaiting_parts: 0, completed: 0, cancelled: 0, invoiced: 0 } as Record<ServiceStatus, number>;
  for (const r of rows) out[r.status] = Number(r.n);
  return out;
}

// ─── Job lifecycle ───────────────────────────────────────────────────────────

async function nextJobNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const [row] = await query<{ n: string }>(
    `SELECT COALESCE(MAX(CAST(SUBSTR(job_number, 9) AS INTEGER)), 0) AS n
     FROM service_jobs WHERE job_number LIKE ?1`,
    [`SJ-${year}-%`],
  );
  return `SJ-${year}-${String(Number(row?.n ?? 0) + 1).padStart(5, "0")}`;
}

/**
 * Open a service job against a unit. Warranty is auto-detected from the
 * unit's active warranty unless explicitly set. The unit moves to
 * `in_service`.
 */
export async function createServiceJob(input: {
  unit_id: string;
  customer_id?: string | null;
  reported_fault?: string;
  technician_id?: string | null;
  meter_in?: number | null;
  is_warranty?: boolean;
}): Promise<{ id: string; job_number: string }> {
  await assertModuleEntitled("hardware");
  await requirePermission("hardware.equipment.manage", { entityType: "service_job" });

  const [unit] = await query<{ status: string; warranty_expiry: string | null; customer_id: string | null }>(
    `SELECT status, warranty_expiry, customer_id FROM equipment_units WHERE id = ?1`,
    [input.unit_id],
  );
  if (!unit) throw new Error("Unit not found.");
  if (unit.status === "written_off") throw new Error("Unit is written off.");

  const warranty = input.is_warranty ?? (warrantyState(unit.warranty_expiry) === "active" || warrantyState(unit.warranty_expiry) === "expiring");
  const id = uid();
  const jobNumber = await nextJobNumber();
  const branch = getActiveBranchId() || null;
  const customerId = input.customer_id ?? unit.customer_id ?? null;

  await transaction([
    {
      sql: `INSERT INTO service_jobs
              (id, job_number, unit_id, customer_id, status, reported_fault, is_warranty,
               technician_id, meter_in, branch_id, opened_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, 'open', ?5, ?6, ?7, ?8, ?9, ?10, ?10)`,
      params: [id, jobNumber, input.unit_id, customerId, input.reported_fault ?? null,
        warranty ? 1 : 0, input.technician_id ?? null, input.meter_in ?? null, branch, nowIso()],
    },
    {
      sql: `UPDATE equipment_units SET status = 'in_service', updated_at = ?2 WHERE id = ?1 AND status != 'written_off'`,
      params: [input.unit_id, nowIso()],
    },
  ]);
  return { id, job_number: jobNumber };
}

export async function updateJobStatus(id: string, to: ServiceStatus): Promise<void> {
  await assertModuleEntitled("hardware");
  await requirePermission("hardware.equipment.manage", { entityType: "service_job", entityId: id });
  const [row] = await query<{ status: ServiceStatus }>(`SELECT status FROM service_jobs WHERE id = ?1`, [id]);
  if (!row) throw new Error("Job not found.");
  if (!canTransitionJob(row.status, to)) throw new Error(`Cannot move a job from ${row.status} to ${to}.`);
  await execute(`UPDATE service_jobs SET status = ?2, updated_at = ?3 WHERE id = ?1`, [id, to, nowIso()]);
}

export async function updateJobFields(id: string, fields: {
  reported_fault?: string | null;
  diagnosis?: string | null;
  technician_id?: string | null;
  is_warranty?: boolean;
  notes?: string | null;
}): Promise<void> {
  await assertModuleEntitled("hardware");
  await requirePermission("hardware.equipment.manage", { entityType: "service_job", entityId: id });
  const sets: string[] = [];
  const params: unknown[] = [id];
  const push = (col: string, val: unknown) => { params.push(val); sets.push(`${col} = ?${params.length}`); };
  if (fields.reported_fault !== undefined) push("reported_fault", fields.reported_fault);
  if (fields.diagnosis !== undefined) push("diagnosis", fields.diagnosis);
  if (fields.technician_id !== undefined) push("technician_id", fields.technician_id);
  if (fields.is_warranty !== undefined) push("is_warranty", fields.is_warranty ? 1 : 0);
  if (fields.notes !== undefined) push("notes", fields.notes);
  if (sets.length === 0) return;
  params.push(nowIso());
  sets.push(`updated_at = ?${params.length}`);
  await execute(`UPDATE service_jobs SET ${sets.join(", ")} WHERE id = ?1`, params);
}

/**
 * Complete a job: back to `completed`, stamp the time, and return the unit
 * to a resting state (sold if it had been sold, else in_stock).
 */
export async function completeJob(id: string): Promise<void> {
  await assertModuleEntitled("hardware");
  await requirePermission("hardware.equipment.manage", { entityType: "service_job", entityId: id });
  const [job] = await query<{ status: ServiceStatus; unit_id: string }>(
    `SELECT status, unit_id FROM service_jobs WHERE id = ?1`, [id],
  );
  if (!job) throw new Error("Job not found.");
  if (!canTransitionJob(job.status, "completed")) throw new Error(`Cannot complete a ${job.status} job.`);
  const [unit] = await query<{ sale_id: string | null; status: string }>(
    `SELECT sale_id, status FROM equipment_units WHERE id = ?1`, [job.unit_id],
  );
  const restingStatus = unit?.sale_id ? "sold" : "in_stock";
  await transaction([
    { sql: `UPDATE service_jobs SET status = 'completed', completed_at = ?2, updated_at = ?2 WHERE id = ?1`, params: [id, nowIso()] },
    { sql: `UPDATE equipment_units SET status = ?2, updated_at = ?3 WHERE id = ?1 AND status = 'in_service'`, params: [job.unit_id, restingStatus, nowIso()] },
  ]);
}

// ─── Totals ──────────────────────────────────────────────────────────────────

/** Recompute + persist parts_total and labour_total from the line tables. */
export async function recomputeTotals(jobId: string): Promise<{ parts: number; labour: number }> {
  const [p] = await query<{ t: number }>(`SELECT COALESCE(SUM(line_total), 0) AS t FROM service_job_parts WHERE job_id = ?1`, [jobId]);
  const [l] = await query<{ t: number }>(`SELECT COALESCE(SUM(line_total), 0) AS t FROM service_job_labour WHERE job_id = ?1`, [jobId]);
  const parts = Number(p?.t ?? 0);
  const labour = Number(l?.t ?? 0);
  await execute(`UPDATE service_jobs SET parts_total = ?2, labour_total = ?3, updated_at = ?4 WHERE id = ?1`, [jobId, parts, labour, nowIso()]);
  return { parts, labour };
}

// ─── Parts (consume stock) ───────────────────────────────────────────────────

/**
 * Add a part to a job, consuming it from stock FEFO (an inventory
 * adjustment). Throws if there isn't enough stock. unit_price defaults to
 * the product's selling price.
 */
export async function addPart(jobId: string, input: {
  product_id: string;
  quantity: number;
  unit_price?: number;
}): Promise<void> {
  await assertModuleEntitled("hardware");
  await requirePermission("hardware.equipment.manage", { entityType: "service_job", entityId: jobId });
  const qty = input.quantity;
  if (!(qty > 0)) throw new Error("Quantity must be greater than zero.");

  const [prod] = await query<{ name: string; selling_price: number }>(
    `SELECT p.name, COALESCE(pp.selling_price, 0) AS selling_price
     FROM products p
     LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.price_list_id = 'default'
     WHERE p.id = ?1`,
    [input.product_id],
  );
  if (!prod) throw new Error("Product not found.");

  const batches = await query<{ id: string; quantity: number; buying_price: number }>(
    `SELECT id, quantity, COALESCE(buying_price, 0) AS buying_price FROM batches
     WHERE product_id = ?1 AND quantity > 0
       AND (expiry_date IS NULL OR expiry_date > date('now'))
     ORDER BY expiry_date ASC NULLS LAST, received_at ASC`,
    [input.product_id],
  );
  const available = batches.reduce((s, b) => s + b.quantity, 0);
  if (available < qty) throw new Error(`Not enough stock — need ${qty}, have ${available}.`);

  const unitPrice = input.unit_price ?? prod.selling_price;
  const firstBatch = batches[0];
  const stmts: { sql: string; params: unknown[] }[] = [];
  let remaining = qty;
  for (const b of batches) {
    if (remaining <= 0) break;
    const deduct = Math.min(remaining, b.quantity);
    stmts.push({ sql: `UPDATE batches SET quantity = MAX(0, quantity - ?1) WHERE id = ?2`, params: [deduct, b.id] });
    stmts.push({
      sql: `INSERT INTO stock_movements (id, product_id, batch_id, type, quantity, reference_type, reference_id, notes)
            VALUES (?1, ?2, ?3, 'adjustment', ?4, 'service_job', ?5, 'Consumed in service')`,
      params: [uid(), input.product_id, b.id, -deduct, jobId],
    });
    remaining -= deduct;
  }
  stmts.push({
    sql: `INSERT INTO service_job_parts (id, job_id, product_id, product_name, batch_id, quantity, unit_cost, unit_price, line_total)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    params: [uid(), jobId, input.product_id, prod.name, firstBatch?.id ?? null, qty,
      firstBatch?.buying_price ?? 0, unitPrice, unitPrice * qty],
  });
  await transaction(stmts);
  await recomputeTotals(jobId);
}

/** Remove a part from a job, returning the quantity to stock. */
export async function removePart(partId: string): Promise<void> {
  await assertModuleEntitled("hardware");
  await requirePermission("hardware.equipment.manage", { entityType: "service_job_part", entityId: partId });
  const [part] = await query<{ job_id: string; product_id: string; batch_id: string | null; quantity: number }>(
    `SELECT job_id, product_id, batch_id, quantity FROM service_job_parts WHERE id = ?1`, [partId],
  );
  if (!part) return;
  // Restock: return to the original batch if known, else the newest batch.
  let batchId = part.batch_id;
  if (!batchId) {
    const [b] = await query<{ id: string }>(`SELECT id FROM batches WHERE product_id = ?1 ORDER BY received_at DESC LIMIT 1`, [part.product_id]);
    batchId = b?.id ?? null;
  }
  const stmts: { sql: string; params: unknown[] }[] = [
    { sql: `DELETE FROM service_job_parts WHERE id = ?1`, params: [partId] },
  ];
  if (batchId) {
    stmts.push({ sql: `UPDATE batches SET quantity = quantity + ?1 WHERE id = ?2`, params: [part.quantity, batchId] });
    stmts.push({
      sql: `INSERT INTO stock_movements (id, product_id, batch_id, type, quantity, reference_type, reference_id, notes)
            VALUES (?1, ?2, ?3, 'adjustment', ?4, 'service_job', ?5, 'Returned from service')`,
      params: [uid(), part.product_id, batchId, part.quantity, part.job_id],
    });
  }
  await transaction(stmts);
  await recomputeTotals(part.job_id);
}

// ─── Labour ──────────────────────────────────────────────────────────────────

export async function addLabour(jobId: string, input: {
  description: string;
  hours: number;
  rate: number;
  technician_id?: string | null;
}): Promise<void> {
  await assertModuleEntitled("hardware");
  await requirePermission("hardware.equipment.manage", { entityType: "service_job", entityId: jobId });
  const total = (input.hours || 0) * (input.rate || 0);
  await execute(
    `INSERT INTO service_job_labour (id, job_id, description, hours, rate, line_total, technician_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    [uid(), jobId, input.description, input.hours || 0, input.rate || 0, total, input.technician_id ?? null],
  );
  await recomputeTotals(jobId);
}

export async function removeLabour(labourId: string): Promise<void> {
  await assertModuleEntitled("hardware");
  await requirePermission("hardware.equipment.manage", { entityType: "service_job_labour", entityId: labourId });
  const [row] = await query<{ job_id: string }>(`SELECT job_id FROM service_job_labour WHERE id = ?1`, [labourId]);
  if (!row) return;
  await execute(`DELETE FROM service_job_labour WHERE id = ?1`, [labourId]);
  await recomputeTotals(row.job_id);
}

// ─── Invoicing ───────────────────────────────────────────────────────────────

/**
 * Bill a completed non-warranty job: raise a standard invoice from the parts
 * (at selling price) + labour lines, link it back, and mark the job invoiced.
 * Warranty jobs carry no charge and cannot be invoiced. Stock was already
 * consumed when parts were added, so the invoice does not touch inventory.
 */
export async function invoiceJob(jobId: string, opts: { dueDate: string; userId: string }): Promise<string> {
  await assertModuleEntitled("hardware");
  await requirePermission("hardware.equipment.manage", { entityType: "service_job", entityId: jobId });
  const detail = await getServiceJob(jobId);
  if (!detail) throw new Error("Job not found.");
  const { job, parts, labour } = detail;
  if (job.is_warranty) throw new Error("Warranty jobs are not charged.");
  if (job.invoice_id) throw new Error("This job has already been invoiced.");
  if (job.status !== "completed") throw new Error("Complete the job before invoicing.");
  if (parts.length === 0 && labour.length === 0) throw new Error("Nothing to invoice.");

  const [cust] = job.customer_id
    ? await query<{ name: string; phone: string | null; email: string | null; address: string | null }>(
        `SELECT name, phone, email, address FROM customers WHERE id = ?1`, [job.customer_id])
    : [undefined];

  const items = [
    ...parts.map((p) => ({
      product_id: p.product_id,
      description: p.product_name,
      quantity: p.quantity,
      unit_price: p.unit_price,
    })),
    ...labour.map((l) => ({
      description: `Labour — ${l.description} (${l.hours}h @ ${l.rate})`,
      quantity: 1,
      unit_price: l.line_total,
    })),
  ];

  const invoiceId = await createInvoice({
    customer_id: job.customer_id ?? undefined,
    customer_name: cust?.name ?? "Walk-in",
    customer_phone: cust?.phone ?? undefined,
    customer_email: cust?.email ?? undefined,
    customer_address: cust?.address ?? undefined,
    due_date: opts.dueDate,
    user_id: opts.userId,
    notes: `Service job ${job.job_number} — ${job.serial_number ?? ""}`.trim(),
    items,
  });

  await execute(
    `UPDATE service_jobs SET invoice_id = ?2, status = 'invoiced', updated_at = ?3 WHERE id = ?1`,
    [jobId, invoiceId, nowIso()],
  );
  return invoiceId;
}
