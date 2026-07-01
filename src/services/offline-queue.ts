/**
 * Offline queue — protects LAN client tills against master downtime.
 *
 * Flow (LAN client mode only):
 *   1. Client attempts to call the master (via `network.callMaster()`).
 *   2. If it fails with network error → we enqueue the op locally and return "queued".
 *   3. The caller shows a "queued for sync" banner instead of an error.
 *   4. `useOfflineQueueDrainer` runs every 15s: for each pending op, try replay
 *      to the master; on success, mark succeeded_at. On repeat failure (5x), mark
 *      failed_permanently_at so it doesn't loop forever.
 *
 * Standalone / master mode: this is a no-op (nothing to queue against).
 */
import { query, execute } from "@/lib/db";

const MAX_ATTEMPTS = 5;

export type QueuedOp = {
  id: string;
  op_kind: string;
  op_url: string;
  op_method: string;
  payload: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
};

function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

export async function enqueueOp(input: {
  kind: string;
  url: string;
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  payload: unknown;
}): Promise<string> {
  const id = newId();
  await execute(
    `INSERT INTO offline_queue (id, op_kind, op_url, op_method, payload, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))`,
    [id, input.kind, input.url, input.method ?? "POST", JSON.stringify(input.payload)],
  );
  return id;
}

export async function listPending(): Promise<QueuedOp[]> {
  return query<QueuedOp>(
    `SELECT id, op_kind, op_url, op_method, payload, attempts, last_error, created_at
     FROM offline_queue
     WHERE succeeded_at IS NULL AND failed_permanently_at IS NULL
     ORDER BY created_at ASC`,
  );
}

export async function countPending(): Promise<number> {
  const rows = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM offline_queue
      WHERE succeeded_at IS NULL AND failed_permanently_at IS NULL`,
  );
  return rows[0]?.n ?? 0;
}

async function markSucceeded(id: string): Promise<void> {
  await execute(`UPDATE offline_queue SET succeeded_at = datetime('now') WHERE id = ?1`, [id]);
}

async function markFailure(id: string, err: string): Promise<void> {
  await execute(
    `UPDATE offline_queue
     SET attempts = attempts + 1,
         last_error = ?2,
         failed_permanently_at = CASE WHEN attempts + 1 >= ?3 THEN datetime('now') ELSE NULL END
     WHERE id = ?1`,
    [id, err.slice(0, 500), MAX_ATTEMPTS],
  );
}

/**
 * Attempt to replay every pending op against the current master.
 * Returns { attempted, succeeded, failed }.
 * `masterFetch(url, init)` must be provided by the caller (couples to auth token).
 */
export async function drainQueue(
  masterFetch: (url: string, init: RequestInit) => Promise<Response>,
): Promise<{ attempted: number; succeeded: number; failed: number }> {
  const pending = await listPending();
  let succeeded = 0;
  let failed = 0;
  for (const op of pending) {
    try {
      const res = await masterFetch(op.op_url, {
        method: op.op_method,
        headers: { "Content-Type": "application/json" },
        body: op.payload,
      });
      if (res.ok) {
        await markSucceeded(op.id);
        succeeded++;
      } else {
        await markFailure(op.id, `HTTP ${res.status}`);
        failed++;
      }
    } catch (e) {
      await markFailure(op.id, String(e));
      failed++;
    }
  }
  return { attempted: pending.length, succeeded, failed };
}

/** Prune replayed ops older than 30 days so the queue table stays lean. */
export async function pruneSuccess(): Promise<number> {
  const res = await execute(
    `DELETE FROM offline_queue
      WHERE succeeded_at IS NOT NULL AND succeeded_at < datetime('now', '-30 days')`,
  );
  return typeof res === "number" ? res : 0;
}
