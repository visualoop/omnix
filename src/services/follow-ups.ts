/**
 * Follow-ups service.
 * Manages reminders on customers, invoices, and other entities.
 */
import { execute, query } from "@/lib/db";

export type FollowUpStatus = "pending" | "done" | "cancelled";

export interface FollowUp {
  id: string;
  customer_id: string | null;
  entity_kind: string | null;
  entity_id: string | null;
  title: string;
  notes: string | null;
  due_at: string;
  assignee_id: string | null;
  status: FollowUpStatus;
  completed_at: string | null;
}

function newId(): string { return crypto.randomUUID().replace(/-/g, "").slice(0, 16); }

export async function createFollowUp(input: {
  customer_id?: string;
  entity_kind?: string;
  entity_id?: string;
  title: string;
  notes?: string;
  due_at: string;
  assignee_id?: string;
  created_by?: string;
}): Promise<string> {
  const id = newId();
  await execute(
    `INSERT INTO follow_ups (id, customer_id, entity_kind, entity_id, title, notes, due_at, assignee_id, created_by)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    [
      id, input.customer_id ?? null, input.entity_kind ?? null, input.entity_id ?? null,
      input.title, input.notes ?? null, input.due_at, input.assignee_id ?? null, input.created_by ?? null,
    ],
  );
  return id;
}

export async function listPending(assigneeId?: string): Promise<FollowUp[]> {
  if (assigneeId) {
    return query<FollowUp>(
      `SELECT * FROM follow_ups WHERE status = 'pending' AND (assignee_id = ?1 OR assignee_id IS NULL) ORDER BY due_at ASC`,
      [assigneeId],
    );
  }
  return query<FollowUp>(
    `SELECT * FROM follow_ups WHERE status = 'pending' ORDER BY due_at ASC LIMIT 200`,
  );
}

export async function complete(id: string): Promise<void> {
  await execute(
    `UPDATE follow_ups SET status = 'done', completed_at = datetime('now') WHERE id = ?1`,
    [id],
  );
}

export async function cancel(id: string): Promise<void> {
  await execute(`UPDATE follow_ups SET status = 'cancelled' WHERE id = ?1`, [id]);
}

// ─── Communications ──────────────────────────────────────
export type Channel = "sms" | "email" | "whatsapp" | "call" | "in_person";
export type Direction = "outbound" | "inbound";

export async function logCommunication(input: {
  customer_id: string;
  channel: Channel;
  direction: Direction;
  subject?: string;
  body?: string;
  staff_id?: string;
  external_ref?: string;
}): Promise<string> {
  const id = newId();
  await execute(
    `INSERT INTO customer_communications
      (id, customer_id, channel, direction, subject, body, staff_id, external_ref)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    [
      id, input.customer_id, input.channel, input.direction,
      input.subject ?? null, input.body ?? null,
      input.staff_id ?? null, input.external_ref ?? null,
    ],
  );
  return id;
}

export async function listCommunications(customerId: string): Promise<Array<{
  id: string;
  channel: Channel;
  direction: Direction;
  subject: string | null;
  body: string | null;
  occurred_at: string;
  status: string;
}>> {
  return query<{
    id: string;
    channel: Channel;
    direction: Direction;
    subject: string | null;
    body: string | null;
    occurred_at: string;
    status: string;
  }>(
    `SELECT id, channel, direction, subject, body, occurred_at, status
     FROM customer_communications
     WHERE customer_id = ?1
     ORDER BY occurred_at DESC
     LIMIT 200`,
    [customerId],
  );
}
