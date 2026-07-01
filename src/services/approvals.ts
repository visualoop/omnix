/**
 * Approvals — request/approve/reject workflow for POs + expenses.
 *
 * Usage pattern from callers:
 *   const rule = await findRule('purchase_order', poAmount);
 *   if (rule) await createRequest({ kind:'purchase_order', resource_id: poId, amount });
 *   else proceed directly.
 *
 * Approvers see pending requests on /approvals (renders next).
 */
import { execute, query } from "@/lib/db";

export type ApprovalKind = "purchase_order" | "expense" | "stock_transfer" | "debit_note";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface ApprovalRequest {
  id: string;
  kind: ApprovalKind;
  resource_id: string;
  amount: number;
  status: ApprovalStatus;
  requested_by: string;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  metadata: string;
}

export interface ApprovalRule {
  id: string;
  kind: ApprovalKind;
  branch_id: string | null;
  min_amount: number;
  max_amount: number | null;
  approver_role: string;
  active: number;
}

function newId(): string { return crypto.randomUUID().replace(/-/g, "").slice(0, 16); }

/**
 * Find the strictest rule matching (kind, amount) — returns the one with the
 * highest min_amount whose threshold is met. Null if approval isn't required.
 */
export async function findRule(kind: ApprovalKind, amount: number, branchId?: string): Promise<ApprovalRule | null> {
  const rows = await query<ApprovalRule>(
    `SELECT * FROM approval_rules
      WHERE kind = ?1
        AND active = 1
        AND min_amount <= ?2
        AND (max_amount IS NULL OR max_amount >= ?2)
        AND (branch_id IS NULL OR branch_id = ?3)
      ORDER BY min_amount DESC
      LIMIT 1`,
    [kind, amount, branchId ?? null],
  );
  return rows[0] ?? null;
}

export async function createRequest(input: {
  kind: ApprovalKind;
  resource_id: string;
  amount: number;
  requested_by: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const id = newId();
  await execute(
    `INSERT INTO approval_requests (id, kind, resource_id, amount, requested_by, metadata, status)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending')`,
    [id, input.kind, input.resource_id, input.amount, input.requested_by, JSON.stringify(input.metadata ?? {})],
  );
  return id;
}

export async function listPending(kind?: ApprovalKind): Promise<ApprovalRequest[]> {
  if (kind) {
    return query<ApprovalRequest>(
      `SELECT * FROM approval_requests WHERE status = 'pending' AND kind = ?1 ORDER BY requested_at ASC`,
      [kind],
    );
  }
  return query<ApprovalRequest>(
    `SELECT * FROM approval_requests WHERE status = 'pending' ORDER BY requested_at ASC`,
  );
}

export async function approve(id: string, decidedBy: string, note?: string): Promise<void> {
  await execute(
    `UPDATE approval_requests SET status = 'approved', decided_by = ?2, decided_at = datetime('now'), decision_note = ?3
     WHERE id = ?1 AND status = 'pending'`,
    [id, decidedBy, note ?? null],
  );
}

export async function reject(id: string, decidedBy: string, note?: string): Promise<void> {
  await execute(
    `UPDATE approval_requests SET status = 'rejected', decided_by = ?2, decided_at = datetime('now'), decision_note = ?3
     WHERE id = ?1 AND status = 'pending'`,
    [id, decidedBy, note ?? null],
  );
}

export async function cancel(id: string): Promise<void> {
  await execute(
    `UPDATE approval_requests SET status = 'cancelled', decided_at = datetime('now')
     WHERE id = ?1 AND status = 'pending'`,
    [id],
  );
}

export async function findByResource(kind: ApprovalKind, resourceId: string): Promise<ApprovalRequest | null> {
  const rows = await query<ApprovalRequest>(
    `SELECT * FROM approval_requests WHERE kind = ?1 AND resource_id = ?2 ORDER BY requested_at DESC LIMIT 1`,
    [kind, resourceId],
  );
  return rows[0] ?? null;
}
