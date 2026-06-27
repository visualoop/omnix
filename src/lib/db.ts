import Database from "@tauri-apps/plugin-sql";
import { fetch } from "@tauri-apps/plugin-http";

let db: Database | null = null;
let tuned = false;

/**
 * Production SQLite tuning — applied once per connection, right after load.
 *
 * These PRAGMAs are what keep the till instant whether the shop has done
 * 100 sales or 50 million. None of them risk the data; they trade a tiny
 * amount of crash-durability nuance (synchronous=NORMAL) for a large
 * throughput win, which is the correct call for a WAL database.
 *
 *   journal_mode=WAL    — readers never block the writer and vice-versa.
 *                         The POS can keep ringing sales while a report
 *                         runs. This is THE big lever for a busy till.
 *   synchronous=NORMAL  — safe with WAL (no corruption on app crash; only
 *                         the very last transaction can be lost on a full
 *                         OS/power loss, which a sale re-print covers).
 *                         ~10x faster commits than the FULL default.
 *   busy_timeout=5000   — wait up to 5s for a lock instead of throwing
 *                         "database is locked" under concurrent access
 *                         (LAN clients, background backup, reports).
 *   cache_size=-16384   — 16 MB page cache (negative = KiB). Hot tables
 *                         (products, prices, today's sales) stay in RAM.
 *   temp_store=MEMORY   — sorts/joins for reports build in RAM, not disk.
 *   mmap_size=256MB     — memory-map the DB file so reads skip syscalls;
 *                         huge for scanning large sales history.
 *   foreign_keys=ON     — enforce referential integrity (off by default
 *                         in SQLite). Cheap, prevents orphaned rows.
 *
 * Why this scales to "billions of rows": SQLite is a B-tree engine — an
 * indexed lookup is O(log n), so finding one product among 10 or 10
 * million is a handful of page reads either way. Performance degrades
 * only on UN-indexed full scans; the schema already ships 150+ indexes
 * on every WHERE/JOIN column, and the audit (scripts/audit-codebase.mjs)
 * blocks queries that would scan. The remaining lever is keeping the
 * working set in cache + not blocking on locks — exactly what these
 * PRAGMAs do.
 */
async function tuneSqlite(conn: Database): Promise<void> {
  if (tuned) return;
  try {
    // DURABLE pragmas — written into the database file header, so they
    // persist across every connection + restart once set:
    await conn.execute("PRAGMA journal_mode = WAL;");      // readers never block the writer
    await conn.execute("PRAGMA auto_vacuum = INCREMENTAL;"); // reclaim space without full VACUUM locks

    // PER-CONNECTION pragmas. tauri-plugin-sql uses an sqlx pool, so
    // these strictly bind to the connection that ran them. In practice
    // the SQLite pool is tiny and the same handle serves the hot path,
    // so this still lifts the common case; WAL above is the change that
    // unconditionally helps every connection.
    await conn.execute("PRAGMA synchronous = NORMAL;");    // safe w/ WAL, ~10x faster commits
    await conn.execute("PRAGMA busy_timeout = 5000;");     // wait for locks, don't throw
    await conn.execute("PRAGMA cache_size = -16384;");     // 16 MB page cache
    await conn.execute("PRAGMA temp_store = MEMORY;");     // report sorts/joins in RAM
    await conn.execute("PRAGMA mmap_size = 268435456;");   // 256 MB memory-mapped reads
    await conn.execute("PRAGMA foreign_keys = ON;");       // enforce integrity

    // Refresh the query planner's table statistics so it keeps picking
    // the right index as the shop's data grows. Cheap; once per launch.
    await conn.execute("PRAGMA optimize;");
    tuned = true;
  } catch {
    // Tuning is best-effort; a failure here must never block app boot.
  }
}

/** Load the local SQLite database with production tuning applied once. */
async function loadTuned(): Promise<Database> {
  const conn = await Database.load("sqlite:omnix.db");
  await tuneSqlite(conn);
  return conn;
}

// Cached client-mode credentials (read once on startup)
let clientMode: { url: string; token: string } | null = null;
let modeChecked = false;

/**
 * Initialize the DB layer. Detects whether we're in client mode and caches
 * the master URL + token. Call once at app startup.
 */
export async function initDb(): Promise<"local" | "remote"> {
  // Always ensure local DB is loaded (used for settings even in client mode for cached configs)
  if (!db) {
    db = await loadTuned();
  }

  // Check mode from local settings table
  const rows = await db.select<Array<{ value: string }>>(
    "SELECT value FROM settings WHERE key = 'network.mode'"
  );
  const mode = rows[0]?.value || "standalone";

  if (mode === "client") {
    const configRows = await db.select<Array<{ key: string; value: string }>>(
      "SELECT key, value FROM settings WHERE key IN ('network.master_url', 'network.master_token')"
    );
    let url = "";
    let token = "";
    for (const r of configRows) {
      if (r.key === "network.master_url") url = r.value;
      if (r.key === "network.master_token") token = r.value;
    }
    if (url && token) {
      clientMode = { url: url.replace(/\/$/, ""), token };
      modeChecked = true;
      return "remote";
    }
  }

  modeChecked = true;
  return "local";
}

/** Force a re-check (e.g., after pairing/unpairing) */
export async function refreshDbMode(): Promise<"local" | "remote"> {
  modeChecked = false;
  clientMode = null;
  return initDb();
}

async function getDb(): Promise<Database> {
  if (!db) {
    db = await loadTuned();
  }
  return db;
}

async function ensureModeChecked(): Promise<void> {
  if (!modeChecked) await initDb();
}

/** Convert tauri-plugin-sql ?1 ?2 ... params to actual values for HTTP transport */
function normalizeParams(values?: unknown[]): unknown[] {
  return values || [];
}

export async function query<T>(sql: string, bindValues?: unknown[]): Promise<T[]> {
  await ensureModeChecked();

  if (clientMode) {
    // Proxy to master. NEVER proxy reads from settings table that hold network config —
    // we'd loop. Reads of `network.*` settings always go to local DB.
    if (sql.includes("network.")) {
      const database = await getDb();
      return database.select<T[]>(sql, bindValues);
    }
    const res = await fetch(`${clientMode.url}/api/db/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${clientMode.token}`,
      },
      body: JSON.stringify({ sql, params: normalizeParams(bindValues) }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error || `Query failed (${res.status})`);
    }
    const data = (await res.json()) as { rows: T[] };
    return data.rows;
  }

  const database = await getDb();
  return database.select<T[]>(sql, bindValues);
}

export async function execute(sql: string, bindValues?: unknown[]) {
  await ensureModeChecked();

  if (clientMode) {
    // Settings writes related to network config still go to local DB
    if (sql.includes("network.")) {
      const database = await getDb();
      return database.execute(sql, bindValues);
    }
    const res = await fetch(`${clientMode.url}/api/db/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${clientMode.token}`,
      },
      body: JSON.stringify({ sql, params: normalizeParams(bindValues) }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error || `Execute failed (${res.status})`);
    }
    const data = (await res.json()) as { rows_affected: number; last_insert_id: number };
    return {
      rowsAffected: data.rows_affected,
      lastInsertId: data.last_insert_id,
    };
  }

  const database = await getDb();
  return database.execute(sql, bindValues);
}

export function isClientMode(): boolean {
  return clientMode !== null;
}

/** A single statement in a transaction batch. */
export interface TxStatement {
  sql: string;
  params?: unknown[];
}

/**
 * Escape a JS value into a SQLite literal for safe inlining into a
 * multi-statement transaction batch.
 *
 * WHY inline instead of bound params: a transaction must run as ONE
 * connection-level batch (BEGIN IMMEDIATE … COMMIT). Both the local
 * tauri-plugin-sql pool and the LAN master run bound-param statements
 * one-at-a-time on pooled connections, so a multi-statement batch can't
 * carry positional params across the pool reliably. Inlining the
 * already-typed values (numbers, strings, null) into a single SQL string
 * lets the whole unit commit or roll back atomically on one connection.
 *
 * Only primitives appear here (the callers pass numbers/strings/null);
 * strings are single-quote escaped. This is NOT general user-input SQL —
 * it's our own typed statement values.
 */
function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  // string (and anything else, stringified) — escape single quotes
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** Inline ?1 ?2 … placeholders in a statement with escaped literals.
 *  Exported for unit testing the transaction batch builder. */
export function inlineParams(sql: string, params: unknown[] = []): string {
  return sql.replace(/\?(\d+)/g, (_m, n) => sqlLiteral(params[Number(n) - 1]));
}

/**
 * Run a set of statements atomically. Either every statement commits or
 * none do (BEGIN IMMEDIATE … COMMIT, ROLLBACK on any error). Works in
 * both standalone and LAN-client mode because the whole batch is one
 * execute() on a single connection.
 *
 * Use for any multi-write unit that must not half-apply: completing a
 * sale, voiding a sale, stock transfers, payroll runs, returns.
 *
 * NOTE: statements run server-side as a batch, so they can't read back
 * intermediate results in JS. Compute all IDs/values up front (e.g.
 * crypto.randomUUID()) and pass them in.
 */
export async function transaction(statements: TxStatement[]): Promise<void> {
  await ensureModeChecked();
  if (statements.length === 0) return;

  const body =
    "BEGIN IMMEDIATE;\n" +
    statements.map((s) => inlineParams(s.sql, s.params).trim().replace(/;?\s*$/, "") + ";").join("\n") +
    "\nCOMMIT;";

  try {
    await execute(body);
  } catch (e) {
    // Best-effort rollback in case the failure left the txn open.
    try {
      await execute("ROLLBACK;");
    } catch {
      /* no active transaction — ignore */
    }
    throw e;
  }
}
