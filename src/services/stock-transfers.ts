/**
 * Stock Transfers — move stock between branches.
 *
 * Flow:
 *  1. Create transfer (status='draft') with items → stock NOT yet decremented
 *  2. Mark in_transit → stock decremented from source branch
 *  3. Receive at destination → stock added to destination branch (with possibly
 *     different quantity_received if shrinkage during transit)
 */
import { query, execute } from "@/lib/db";

export interface StockTransfer {
  id: string;
  transfer_number: string;
  from_branch_id: string;
  to_branch_id: string;
  status: "draft" | "in_transit" | "received" | "cancelled";
  transfer_date: string;
  received_date: string | null;
  user_id: string;
  received_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface StockTransferWithDetails extends StockTransfer {
  from_branch_name: string;
  to_branch_name: string;
  user_name: string;
  received_by_name: string | null;
  item_count: number;
  total_quantity: number;
}

export interface StockTransferItem {
  id: string;
  transfer_id: string;
  product_id: string;
  batch_id: string | null;
  product_name: string;
  quantity_sent: number;
  quantity_received: number;
  unit_cost: number | null;
  notes: string | null;
}

export async function listTransfers(
  branchId?: string,
  status?: StockTransfer["status"],
): Promise<StockTransferWithDetails[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  if (branchId) {
    conditions.push("(t.from_branch_id = ? OR t.to_branch_id = ?)");
    params.push(branchId, branchId);
  }
  if (status) {
    conditions.push("t.status = ?");
    params.push(status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return query<StockTransferWithDetails>(
    `SELECT t.*,
       fb.name AS from_branch_name,
       tb.name AS to_branch_name,
       COALESCE(u.full_name, u.username) AS user_name,
       (SELECT COALESCE(rb.full_name, rb.username) FROM users rb WHERE rb.id = t.received_by) AS received_by_name,
       (SELECT COUNT(*) FROM stock_transfer_items WHERE transfer_id = t.id) AS item_count,
       (SELECT COALESCE(SUM(quantity_sent), 0) FROM stock_transfer_items WHERE transfer_id = t.id) AS total_quantity
     FROM stock_transfers t
     JOIN branches fb ON fb.id = t.from_branch_id
     JOIN branches tb ON tb.id = t.to_branch_id
     LEFT JOIN users u ON u.id = t.user_id
     ${where}
     ORDER BY t.created_at DESC
     LIMIT 100`,
    params,
  );
}

export async function getTransfer(id: string): Promise<{
  transfer: StockTransferWithDetails;
  items: StockTransferItem[];
} | null> {
  const transfers = await listTransfers();
  const transfer = transfers.find((t) => t.id === id);
  if (!transfer) return null;
  const items = await query<StockTransferItem>(
    `SELECT * FROM stock_transfer_items WHERE transfer_id = ?1 ORDER BY product_name`,
    [id],
  );
  return { transfer, items };
}

export async function createTransfer(input: {
  from_branch_id: string;
  to_branch_id: string;
  user_id: string;
  notes?: string;
  items: Array<{ product_id: string; product_name: string; batch_id?: string; quantity: number; unit_cost?: number }>;
}): Promise<string> {
  if (input.from_branch_id === input.to_branch_id) {
    throw new Error("Source and destination branches must differ");
  }
  if (input.items.length === 0) {
    throw new Error("Add at least one item to transfer");
  }
  const id = crypto.randomUUID();
  const number = await getNextTransferNumber();

  await execute(
    `INSERT INTO stock_transfers (id, transfer_number, from_branch_id, to_branch_id, user_id, notes)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    [id, number, input.from_branch_id, input.to_branch_id, input.user_id, input.notes || null],
  );

  for (const item of input.items) {
    await execute(
      `INSERT INTO stock_transfer_items (id, transfer_id, product_id, batch_id, product_name, quantity_sent, unit_cost)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      [crypto.randomUUID(), id, item.product_id, item.batch_id || null, item.product_name, item.quantity, item.unit_cost || null],
    );
  }
  return id;
}

/** Mark transfer as in-transit; decrements stock from source branch. */
export async function dispatchTransfer(transferId: string): Promise<void> {
  const items = await query<StockTransferItem>(
    `SELECT * FROM stock_transfer_items WHERE transfer_id = ?1`,
    [transferId],
  );
  const [transfer] = await query<{ from_branch_id: string; status: string }>(
    `SELECT from_branch_id, status FROM stock_transfers WHERE id = ?1`,
    [transferId],
  );
  if (!transfer) throw new Error("Transfer not found");
  if (transfer.status !== "draft") throw new Error("Transfer already dispatched");

  // Decrement stock at source branch (FIFO from oldest batches)
  for (const item of items) {
    let remaining = item.quantity_sent;
    const batches = await query<{ id: string; quantity: number }>(
      `SELECT id, quantity FROM batches
       WHERE product_id = ?1 AND branch_id = ?2 AND quantity > 0
         AND (expiry_date IS NULL OR expiry_date > date('now'))
       ORDER BY expiry_date ASC NULLS LAST, created_at ASC`,
      [item.product_id, transfer.from_branch_id],
    );
    for (const batch of batches) {
      if (remaining <= 0) break;
      const take = Math.min(batch.quantity, remaining);
      await execute(`UPDATE batches SET quantity = quantity - ?1 WHERE id = ?2`, [take, batch.id]);
      remaining -= take;
    }
    if (remaining > 0) {
      throw new Error(`Insufficient stock for ${item.product_name} at source branch`);
    }
  }

  await execute(
    `UPDATE stock_transfers SET status = 'in_transit' WHERE id = ?1`,
    [transferId],
  );
}

/** Receive transfer at destination; adds stock to destination branch. */
export async function receiveTransfer(
  transferId: string,
  receivedBy: string,
  receivedItems: Array<{ id: string; quantity_received: number; notes?: string }>,
): Promise<void> {
  const [transfer] = await query<{ to_branch_id: string; status: string }>(
    `SELECT to_branch_id, status FROM stock_transfers WHERE id = ?1`,
    [transferId],
  );
  if (!transfer) throw new Error("Transfer not found");
  if (transfer.status !== "in_transit") throw new Error("Transfer is not in transit");

  for (const recv of receivedItems) {
    // Update received quantity on item
    await execute(
      `UPDATE stock_transfer_items SET quantity_received = ?1, notes = ?2 WHERE id = ?3`,
      [recv.quantity_received, recv.notes || null, recv.id],
    );
    if (recv.quantity_received <= 0) continue;

    // Get item details
    const [item] = await query<{ product_id: string; unit_cost: number | null }>(
      `SELECT product_id, unit_cost FROM stock_transfer_items WHERE id = ?1`,
      [recv.id],
    );

    // Add as a new batch at destination
    await execute(
      `INSERT INTO batches (id, product_id, branch_id, quantity, buying_price)
       VALUES (?1, ?2, ?3, ?4, ?5)`,
      [crypto.randomUUID(), item.product_id, transfer.to_branch_id, recv.quantity_received, item.unit_cost || 0],
    );
  }

  await execute(
    `UPDATE stock_transfers SET status = 'received', received_by = ?1, received_date = date('now') WHERE id = ?2`,
    [receivedBy, transferId],
  );
}

export async function cancelTransfer(transferId: string): Promise<void> {
  const [t] = await query<{ status: string }>(`SELECT status FROM stock_transfers WHERE id = ?1`, [transferId]);
  if (!t) return;
  if (t.status === "received") throw new Error("Cannot cancel a received transfer");
  if (t.status === "in_transit") {
    // Roll stock back to source — for now we just leave it as a manual fix
    throw new Error("Cancel from in-transit not supported. Receive with quantity 0 instead.");
  }
  await execute(`UPDATE stock_transfers SET status = 'cancelled' WHERE id = ?1`, [transferId]);
}

async function getNextTransferNumber(): Promise<string> {
  const [r] = await query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM stock_transfers WHERE date(created_at) = date('now')`,
  );
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `TR-${date}-${String((r?.count || 0) + 1).padStart(3, "0")}`;
}
