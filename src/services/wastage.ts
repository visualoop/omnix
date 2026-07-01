/**
 * Batch write-off + wastage reporting.
 *
 * When a batch expires or is damaged, the operator writes it off:
 *   - stock_movements gets a negative-quantity row of type='damage'
 *     with a canonical reason prefix in the notes ("Expired:", "Damaged:",
 *     "Return-to-supplier:") — the wastage report groups by that prefix.
 *   - The batch row is zeroed so it stops appearing in FEFO picks and
 *     the expiry tracker.
 *
 * We reuse the existing type='damage' bucket rather than adding a new
 * enum value because SQLite CHECK constraints can't be altered without
 * rebuilding the table. Every write-off is auditable via the notes
 * prefix + reference_id (the batch id).
 */
import { query, execute } from "@/lib/db"

export type WriteOffReason = "expired" | "damaged" | "returned_to_supplier" | "other"

const REASON_LABEL: Record<WriteOffReason, string> = {
  expired: "Expired",
  damaged: "Damaged",
  returned_to_supplier: "Return-to-supplier",
  other: "Other",
}

export interface WriteOffInput {
  batchId: string
  reason: WriteOffReason
  notes?: string
  userId: string
}

/**
 * Write off a whole batch. Records a negative stock_movement + zeros
 * the batch quantity. Safe to call twice on the same batch — the second
 * call becomes a no-op because quantity is already 0.
 */
export async function writeOffBatch(input: WriteOffInput): Promise<void> {
  const rows = await query<{ id: string; product_id: string; quantity: number; batch_number: string | null }>(
    `SELECT id, product_id, quantity, batch_number FROM batches WHERE id = ?1`,
    [input.batchId],
  )
  const batch = rows[0]
  if (!batch) throw new Error("Batch not found")
  if (batch.quantity <= 0) return // Already written off — idempotent

  const notePrefix = REASON_LABEL[input.reason]
  const noteBody = input.notes?.trim()
  const combinedNote = noteBody ? `${notePrefix}: ${noteBody}` : `${notePrefix}: batch ${batch.batch_number ?? batch.id}`

  await execute(
    `INSERT INTO stock_movements (id, product_id, batch_id, type, quantity, reference_type, reference_id, notes, user_id)
     VALUES (?1, ?2, ?3, 'damage', ?4, 'write_off', ?3, ?5, ?6)`,
    [crypto.randomUUID(), batch.product_id, batch.id, -batch.quantity, combinedNote, input.userId],
  )
  await execute(`UPDATE batches SET quantity = 0 WHERE id = ?1`, [batch.id])
}

export interface WastageRow {
  reason: WriteOffReason | "unknown"
  product_id: string
  product_name: string
  batch_id: string | null
  batch_number: string | null
  quantity: number
  cost_value: number
  notes: string | null
  written_off_at: string
  user_name: string | null
}

/**
 * Wastage report — every write-off in the date range. The reason is
 * derived from the notes-prefix. Cost value is the batch cost × qty
 * (falls back to product cost when the batch record has been purged).
 */
export async function getWastageReport(opts?: {
  startDate?: string
  endDate?: string
  branchId?: string
}): Promise<WastageRow[]> {
  const conditions: string[] = ["m.type = 'damage'", "(m.reference_type = 'write_off' OR m.notes LIKE 'Expired%' OR m.notes LIKE 'Damaged%' OR m.notes LIKE 'Return-to-supplier%')"]
  const params: unknown[] = []
  if (opts?.startDate) {
    conditions.push(`date(m.created_at) >= ?${params.length + 1}`)
    params.push(opts.startDate)
  }
  if (opts?.endDate) {
    conditions.push(`date(m.created_at) <= ?${params.length + 1}`)
    params.push(opts.endDate)
  }
  const where = `WHERE ${conditions.join(" AND ")}`

  const rows = await query<{
    product_id: string
    product_name: string
    batch_id: string | null
    batch_number: string | null
    quantity: number
    cost_value: number
    notes: string | null
    created_at: string
    user_name: string | null
  }>(
    `SELECT
       m.product_id,
       p.name AS product_name,
       m.batch_id,
       b.batch_number,
       ABS(m.quantity) AS quantity,
       ABS(m.quantity) * COALESCE(b.buying_price, 0) AS cost_value,
       m.notes,
       m.created_at,
       u.full_name AS user_name
     FROM stock_movements m
     JOIN products p ON p.id = m.product_id
     LEFT JOIN batches b ON b.id = m.batch_id
     LEFT JOIN users u ON u.id = m.user_id
     ${where}
     ORDER BY m.created_at DESC
     LIMIT 500`,
    params,
  )

  return rows.map((r) => ({
    reason: parseReason(r.notes),
    product_id: r.product_id,
    product_name: r.product_name,
    batch_id: r.batch_id,
    batch_number: r.batch_number,
    quantity: r.quantity,
    cost_value: r.cost_value ?? 0,
    notes: r.notes,
    written_off_at: r.created_at,
    user_name: r.user_name,
  }))
}

function parseReason(notes: string | null): WriteOffReason | "unknown" {
  if (!notes) return "unknown"
  const lower = notes.toLowerCase()
  if (lower.startsWith("expired")) return "expired"
  if (lower.startsWith("damaged")) return "damaged"
  if (lower.startsWith("return-to-supplier")) return "returned_to_supplier"
  if (lower.startsWith("other")) return "other"
  return "unknown"
}

export interface WastageSummary {
  total_cost: number
  total_units: number
  by_reason: Array<{ reason: WriteOffReason | "unknown"; label: string; cost: number; units: number }>
}

export async function getWastageSummary(opts?: { startDate?: string; endDate?: string }): Promise<WastageSummary> {
  const rows = await getWastageReport(opts)
  const buckets = new Map<WriteOffReason | "unknown", { cost: number; units: number }>()
  let totalCost = 0
  let totalUnits = 0
  for (const r of rows) {
    totalCost += r.cost_value
    totalUnits += r.quantity
    const b = buckets.get(r.reason) ?? { cost: 0, units: 0 }
    b.cost += r.cost_value
    b.units += r.quantity
    buckets.set(r.reason, b)
  }
  return {
    total_cost: totalCost,
    total_units: totalUnits,
    by_reason: Array.from(buckets.entries()).map(([reason, v]) => ({
      reason,
      label: reason === "unknown" ? "Unknown" : REASON_LABEL[reason],
      ...v,
    })),
  }
}
