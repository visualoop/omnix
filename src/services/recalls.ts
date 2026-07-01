/**
 * Pharmacy recall workflow.
 *
 * Issue a recall → all matching batches are quarantined → POS filters them out
 * → dispensing report shows which customers received recalled stock.
 */
import { execute, query } from "@/lib/db";

export type RecallSeverity = "low" | "medium" | "high" | "critical";

export interface Recall {
  id: string;
  recall_number: string;
  product_id: string | null;
  batch_number: string | null;
  reason: string;
  severity: RecallSeverity;
  issued_by: string | null;
  issued_at: string;
  quarantine_action: string | null;
  affected_batches: string;
  status: "active" | "closed";
  notes: string | null;
}

function newId(): string { return crypto.randomUUID().replace(/-/g, "").slice(0, 16); }

async function nextRecallNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const [row] = await query<{ n: string }>(
    `SELECT COALESCE(MAX(CAST(SUBSTR(recall_number, 10) AS INTEGER)), 0) AS n
     FROM recalls WHERE recall_number LIKE ?1`,
    [`RCL-${year}-%`],
  );
  return `RCL-${year}-${String(Number(row?.n ?? 0) + 1).padStart(6, "0")}`;
}

export async function issueRecall(input: {
  product_id: string;
  batch_number?: string;
  reason: string;
  severity: RecallSeverity;
  issued_by?: string;
  quarantine_action?: "return_supplier" | "destroy" | "hold_for_review";
  notes?: string;
  created_by?: string;
}): Promise<string> {
  const id = newId();
  const number = await nextRecallNumber();

  // Find affected batches.
  const batches = input.batch_number
    ? await query<{ id: string }>(
        `SELECT id FROM batches WHERE product_id = ?1 AND batch_number = ?2`,
        [input.product_id, input.batch_number],
      )
    : await query<{ id: string }>(
        `SELECT id FROM batches WHERE product_id = ?1`,
        [input.product_id],
      );
  const affectedIds = batches.map((b) => b.id);

  await execute(
    `INSERT INTO recalls
      (id, recall_number, product_id, batch_number, reason, severity, issued_by,
       quarantine_action, affected_batches, notes, created_by)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    [
      id, number, input.product_id, input.batch_number ?? null,
      input.reason, input.severity, input.issued_by ?? null,
      input.quarantine_action ?? "hold_for_review",
      JSON.stringify(affectedIds), input.notes ?? null, input.created_by ?? null,
    ],
  );

  // Quarantine every affected batch.
  if (affectedIds.length > 0) {
    const placeholders = affectedIds.map((_, i) => `?${i + 1}`).join(",");
    await execute(
      `UPDATE batches SET quarantined = 1 WHERE id IN (${placeholders})`,
      affectedIds,
    );
  }

  return id;
}

export async function closeRecall(id: string): Promise<void> {
  await execute(
    `UPDATE recalls SET status = 'closed', closed_at = datetime('now') WHERE id = ?1`,
    [id],
  );
}

export async function listRecalls(status?: "active" | "closed"): Promise<Recall[]> {
  if (status) {
    return query<Recall>(`SELECT * FROM recalls WHERE status = ?1 ORDER BY issued_at DESC`, [status]);
  }
  return query<Recall>(`SELECT * FROM recalls ORDER BY issued_at DESC LIMIT 200`);
}

/**
 * List customers who received recalled stock. Uses sale_items → batches join.
 */
export async function listAffectedCustomers(recallId: string): Promise<Array<{
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  sale_id: string;
  sale_number: string;
  quantity: number;
  sold_at: string;
}>> {
  const [recall] = await query<{ affected_batches: string }>(
    `SELECT affected_batches FROM recalls WHERE id = ?1`,
    [recallId],
  );
  if (!recall) return [];
  const batchIds: string[] = JSON.parse(recall.affected_batches || "[]");
  if (batchIds.length === 0) return [];

  const placeholders = batchIds.map((_, i) => `?${i + 1}`).join(",");
  return query<{
    customer_id: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    sale_id: string;
    sale_number: string;
    quantity: number;
    sold_at: string;
  }>(
    `SELECT
        s.customer_id,
        c.name AS customer_name,
        c.phone AS customer_phone,
        s.id AS sale_id,
        s.sale_number,
        si.quantity,
        s.created_at AS sold_at
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     LEFT JOIN customers c ON c.id = s.customer_id
     WHERE si.batch_id IN (${placeholders})
     ORDER BY s.created_at DESC`,
    batchIds,
  ).catch(() => []);
}
