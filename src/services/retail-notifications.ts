/**
 * Layby + special-order customer notifications (RT-17).
 *
 * Stages messages into customer_notifications for a downstream SMS/print
 * job to flush. Two triggers:
 *   • Layby installment due / layby expiring within N days.
 *   • Special order marked 'received' → ready for collection.
 *
 * Idempotent per (reference_id, kind) within a 7-day window so a customer
 * isn't spammed on every scheduler tick.
 */
import { query, execute } from "@/lib/db";

export interface CustomerNotification {
  id: string;
  kind: "layby_due" | "layby_expiring" | "special_order_ready" | "other";
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  reference_type: string | null;
  reference_id: string | null;
  message: string;
  queued_at: string;
  sent_at: string | null;
}

async function alreadyQueued(referenceId: string, kind: string): Promise<boolean> {
  const [r] = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM customer_notifications
      WHERE reference_id = ?1 AND kind = ?2 AND julianday('now') - julianday(queued_at) < 7`,
    [referenceId, kind],
  );
  return (r?.n ?? 0) > 0;
}

async function enqueue(n: Omit<CustomerNotification, "id" | "queued_at" | "sent_at">): Promise<void> {
  if (n.reference_id && (await alreadyQueued(n.reference_id, n.kind))) return;
  await execute(
    `INSERT INTO customer_notifications
       (id, kind, customer_id, customer_name, customer_phone, reference_type, reference_id, message)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    [crypto.randomUUID(), n.kind, n.customer_id, n.customer_name, n.customer_phone, n.reference_type, n.reference_id, n.message],
  );
}

/** Scan active laybys for those expiring within `withinDays` and stage a reminder. */
export async function queueLaybyReminders(withinDays = 7): Promise<number> {
  const rows = await query<{
    id: string; layby_number: string; customer_id: string; customer_name: string;
    customer_phone: string | null; balance_due: number; expires_at: string;
  }>(
    `SELECT id, layby_number, customer_id, customer_name, customer_phone, balance_due, expires_at
       FROM laybys
      WHERE status = 'active' AND balance_due > 0
        AND julianday(expires_at) - julianday('now') BETWEEN 0 AND ?1`,
    [withinDays],
  );
  let queued = 0;
  for (const l of rows) {
    if (!l.customer_phone) continue;
    await enqueue({
      kind: "layby_expiring",
      customer_id: l.customer_id,
      customer_name: l.customer_name,
      customer_phone: l.customer_phone,
      reference_type: "layby",
      reference_id: l.id,
      message: `Hi ${l.customer_name}, your layby ${l.layby_number} has a balance of KES ${l.balance_due.toFixed(0)} due by ${l.expires_at}. Please complete payment to collect your items.`,
    });
    queued++;
  }
  return queued;
}

/** Stage a ready-for-collection notice for special orders marked 'received'. */
export async function queueSpecialOrderReady(): Promise<number> {
  const rows = await query<{
    id: string; customer_id: string | null; customer_name: string | null; customer_phone: string | null;
  }>(
    `SELECT id, customer_id, customer_name, customer_phone
       FROM special_orders WHERE status = 'received' AND customer_phone IS NOT NULL`,
  );
  let queued = 0;
  for (const o of rows) {
    await enqueue({
      kind: "special_order_ready",
      customer_id: o.customer_id,
      customer_name: o.customer_name,
      customer_phone: o.customer_phone,
      reference_type: "special_order",
      reference_id: o.id,
      message: `Hi ${o.customer_name ?? "customer"}, your special order is ready for collection.`,
    });
    queued++;
  }
  return queued;
}

/** Combined scheduler entry point. */
export async function queueRetailNotifications(): Promise<{ layby: number; specialOrder: number }> {
  const [layby, specialOrder] = await Promise.all([queueLaybyReminders(), queueSpecialOrderReady()]);
  return { layby, specialOrder };
}

export async function listPendingNotifications(): Promise<CustomerNotification[]> {
  return query<CustomerNotification>(
    `SELECT * FROM customer_notifications WHERE sent_at IS NULL ORDER BY queued_at ASC LIMIT 200`,
  );
}
