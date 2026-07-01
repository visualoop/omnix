/**
 * Notification centre — central alerts store.
 *
 * Callers emit notifications via `emit(kind, ...)`. Consumers read via
 * `listNotifications(...)` and `countUnread()`. UI renders in the top-bar
 * bell + a dedicated /notifications page.
 *
 * Deduplication: caller supplies a stable `dedupeKey` (e.g. `low_stock:sku-123`)
 * and we skip if there's already an unread notification with that kind + link.
 * This prevents the same low-stock alert firing every minute for the same SKU.
 */
import { execute, query } from "@/lib/db";

function newId(): string {
  // Compact, URL-safe. crypto.randomUUID is available in Tauri webview + jsdom.
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

export type NotificationKind =
  | "expiry"
  | "low_stock"
  | "unpaid_invoice"
  | "cold_chain"
  | "po_ready"
  | "refill_due"
  | "variance"
  | "system";

export type Severity = "info" | "warning" | "critical";

export interface Notification {
  id: string;
  kind: NotificationKind;
  severity: Severity;
  title: string;
  body: string | null;
  link: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  snoozed_until: string | null;
  created_at: string;
}

export interface EmitOptions {
  kind: NotificationKind;
  severity?: Severity;
  title: string;
  body?: string;
  link?: string;
  metadata?: Record<string, unknown>;
  /** Skip if an unread notification with this key already exists. */
  dedupeKey?: string;
}

/**
 * Emit a notification. Returns the id, or null if deduped.
 */
export async function emit(opts: EmitOptions): Promise<string | null> {
  // Dedupe: skip if an unread + not-snoozed row already exists for this kind + link.
  if (opts.dedupeKey) {
    const existing = await query<{ id: string }>(
      `SELECT id FROM notifications
        WHERE kind = ?1
          AND (link = ?2 OR json_extract(metadata, '$.dedupeKey') = ?3)
          AND read_at IS NULL
          AND (snoozed_until IS NULL OR snoozed_until < datetime('now'))
        LIMIT 1`,
      [opts.kind, opts.link ?? null, opts.dedupeKey],
    );
    if (existing.length > 0) return null;
  }

  const id = newId();
  const metadata = { ...(opts.metadata ?? {}) };
  if (opts.dedupeKey) metadata.dedupeKey = opts.dedupeKey;

  await execute(
    `INSERT INTO notifications
      (id, kind, severity, title, body, link, metadata, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))`,
    [
      id,
      opts.kind,
      opts.severity ?? "info",
      opts.title,
      opts.body ?? null,
      opts.link ?? null,
      JSON.stringify(metadata),
    ],
  );
  return id;
}

export interface ListOptions {
  onlyUnread?: boolean;
  limit?: number;
  offset?: number;
}

export async function listNotifications(opts: ListOptions = {}): Promise<Notification[]> {
  const conditions: string[] = ["(snoozed_until IS NULL OR snoozed_until < datetime('now'))"];
  if (opts.onlyUnread) conditions.push("read_at IS NULL");
  const where = `WHERE ${conditions.join(" AND ")}`;
  const limit = Math.min(opts.limit ?? 100, 500);
  const offset = opts.offset ?? 0;

  const rows = await query<{
    id: string;
    kind: NotificationKind;
    severity: Severity;
    title: string;
    body: string | null;
    link: string | null;
    metadata: string;
    read_at: string | null;
    snoozed_until: string | null;
    created_at: string;
  }>(
    `SELECT id, kind, severity, title, body, link, metadata, read_at, snoozed_until, created_at
     FROM notifications ${where}
     ORDER BY created_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
  );

  return rows.map((r) => ({
    ...r,
    metadata: safeParse(r.metadata),
  }));
}

function safeParse(s: string | null | undefined): Record<string, unknown> {
  try { return s ? JSON.parse(s) : {}; } catch { return {}; }
}

export async function countUnread(): Promise<number> {
  const rows = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM notifications
      WHERE read_at IS NULL
        AND (snoozed_until IS NULL OR snoozed_until < datetime('now'))`,
  );
  return rows[0]?.n ?? 0;
}

export async function markRead(id: string): Promise<void> {
  await execute(
    `UPDATE notifications SET read_at = datetime('now') WHERE id = ?1 AND read_at IS NULL`,
    [id],
  );
}

export async function markAllRead(): Promise<void> {
  await execute(`UPDATE notifications SET read_at = datetime('now') WHERE read_at IS NULL`);
}

export async function snooze(id: string, until: string): Promise<void> {
  await execute(`UPDATE notifications SET snoozed_until = ?2 WHERE id = ?1`, [id, until]);
}

export async function dismiss(id: string): Promise<void> {
  await execute(`DELETE FROM notifications WHERE id = ?1`, [id]);
}

/** Prune read notifications older than 90 days. */
export async function pruneOld(): Promise<number> {
  const res = await execute(
    `DELETE FROM notifications WHERE read_at IS NOT NULL AND read_at < datetime('now', '-90 days')`,
  );
  return typeof res === "number" ? res : 0;
}
