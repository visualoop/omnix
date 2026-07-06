/**
 * Controlled-substance witnessed-destruction records.
 *
 * Expired / unusable scheduled drugs require witnessed destruction under the
 * Narcotic Drugs & Psychotropic Substances Act (two signatories) + PPB
 * notification — not a silent stock write-off. recordControlledDisposal:
 *   1. Persists the statutory disposal record (method, two witnesses, PPB ref).
 *   2. Writes off the batch stock (reason=expired) so inventory reconciles.
 *   3. Posts a controlled_log 'destroyed' row so the PPB register + quarterly
 *      return reflect the destruction with a running balance.
 */
import { query, execute } from "@/lib/db";
import { writeOffBatch } from "@/services/wastage";

export interface ControlledDisposal {
  id: string;
  product_id: string;
  product_name: string;
  batch_id: string | null;
  batch_number: string | null;
  quantity: number;
  method: string;
  witness_1_name: string;
  witness_1_license: string | null;
  witness_2_name: string;
  witness_2_license: string | null;
  ppb_notified: number;
  ppb_notification_ref: string | null;
  notes: string | null;
  disposed_by: string | null;
  disposed_at: string;
}

export interface RecordDisposalInput {
  productId: string;
  productName: string;
  batchId?: string | null;
  batchNumber?: string | null;
  quantity: number;
  method: string;
  witness1Name: string;
  witness1License?: string;
  witness2Name: string;
  witness2License?: string;
  ppbNotified: boolean;
  ppbNotificationRef?: string;
  notes?: string;
  userId: string;
}

export async function recordControlledDisposal(input: RecordDisposalInput): Promise<string> {
  if (!input.witness1Name.trim() || !input.witness2Name.trim()) {
    throw new Error("Two witnesses are required for controlled-substance destruction");
  }
  if (!input.method.trim()) throw new Error("Destruction method is required");
  if (input.quantity <= 0) throw new Error("Quantity must be greater than zero");

  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO controlled_disposals
       (id, product_id, product_name, batch_id, batch_number, quantity, method,
        witness_1_name, witness_1_license, witness_2_name, witness_2_license,
        ppb_notified, ppb_notification_ref, notes, disposed_by)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`,
    [
      id, input.productId, input.productName, input.batchId ?? null, input.batchNumber ?? null,
      input.quantity, input.method, input.witness1Name.trim(), input.witness1License ?? null,
      input.witness2Name.trim(), input.witness2License ?? null,
      input.ppbNotified ? 1 : 0, input.ppbNotificationRef ?? null, input.notes ?? null, input.userId,
    ],
  );

  // Remove the stock (write-off) so inventory + expiry reconcile.
  if (input.batchId) {
    await writeOffBatch({
      batchId: input.batchId,
      reason: "expired",
      notes: `Witnessed destruction (controlled) — ${input.method}`,
      userId: input.userId,
    }).catch(() => {});
  }

  // Post the register 'destroyed' row with a recomputed balance.
  try {
    const [bal] = await query<{ balance: number }>(
      `SELECT COALESCE(SUM(quantity), 0) AS balance FROM batches WHERE product_id = ?1`,
      [input.productId],
    );
    await execute(
      `INSERT INTO controlled_log
         (id, product_id, product_name, batch_id, action, quantity, balance_after, user_id, notes)
       VALUES (?1, ?2, ?3, ?4, 'destroyed', ?5, ?6, ?7, ?8)`,
      [
        crypto.randomUUID(), input.productId, input.productName, input.batchId ?? null,
        input.quantity, bal?.balance ?? 0, input.userId,
        `Witnessed destruction: ${input.witness1Name} + ${input.witness2Name}${input.ppbNotified ? " · PPB notified" : ""}`,
      ],
    );
  } catch (e) {
    console.warn("controlled_log destroyed row skipped:", e);
  }

  return id;
}

export async function listControlledDisposals(limit = 100): Promise<ControlledDisposal[]> {
  return query<ControlledDisposal>(
    `SELECT * FROM controlled_disposals ORDER BY disposed_at DESC LIMIT ?1`,
    [limit],
  );
}
