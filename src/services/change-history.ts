/**
 * Per-record change history.
 *
 * Wraps a mutation with `withHistory` — the callback runs, we capture
 * before + after states as JSON, and log to record_history. Callers use it
 * for money-touching entities: products, prices, invoices, sales, expenses.
 *
 * Read side: `listHistory(entity_kind, entity_id)` returns diffs newest-first.
 */
import { execute, query } from "@/lib/db";

export interface HistoryEntry {
  id: string;
  entity_kind: string;
  entity_id: string;
  action: "create" | "update" | "delete";
  before_state: string | null;
  after_state: string | null;
  changed_by: string | null;
  changed_at: string;
}

function newId(): string { return crypto.randomUUID().replace(/-/g, "").slice(0, 16); }

export async function logHistory(input: {
  entity_kind: string;
  entity_id: string;
  action: "create" | "update" | "delete";
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  changed_by?: string;
}): Promise<void> {
  await execute(
    `INSERT INTO record_history (id, entity_kind, entity_id, action, before_state, after_state, changed_by)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    [
      newId(), input.entity_kind, input.entity_id, input.action,
      input.before ? JSON.stringify(input.before) : null,
      input.after ? JSON.stringify(input.after) : null,
      input.changed_by ?? null,
    ],
  );
}

/**
 * Higher-order wrapper: run the mutation, capture before/after via provided
 * loaders. Best-effort — history logging failures don't rollback the mutation.
 */
export async function withHistory<T>(
  entityKind: string,
  entityId: string,
  changedBy: string | undefined,
  loadBefore: () => Promise<Record<string, unknown> | null>,
  mutate: () => Promise<T>,
  loadAfter: () => Promise<Record<string, unknown> | null>,
): Promise<T> {
  const before = await loadBefore().catch(() => null);
  const result = await mutate();
  const after = await loadAfter().catch(() => null);
  const action: "create" | "update" | "delete" =
    !before && after ? "create" :
    before && !after ? "delete" :
    "update";
  await logHistory({ entity_kind: entityKind, entity_id: entityId, action, before, after, changed_by: changedBy }).catch(() => {});
  return result;
}

export async function listHistory(entityKind: string, entityId: string, limit = 50): Promise<HistoryEntry[]> {
  return query<HistoryEntry>(
    `SELECT id, entity_kind, entity_id, action, before_state, after_state, changed_by, changed_at
     FROM record_history
     WHERE entity_kind = ?1 AND entity_id = ?2
     ORDER BY changed_at DESC
     LIMIT ${limit}`,
    [entityKind, entityId],
  );
}

/**
 * Compute a shallow diff between before + after. Only returns fields that changed.
 */
export function diff(before: Record<string, unknown> | null, after: Record<string, unknown> | null): Array<{
  field: string;
  before: unknown;
  after: unknown;
}> {
  const out: Array<{ field: string; before: unknown; after: unknown }> = [];
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const k of keys) {
    const b = before?.[k];
    const a = after?.[k];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      out.push({ field: k, before: b, after: a });
    }
  }
  return out;
}
