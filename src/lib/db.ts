import Database from "@tauri-apps/plugin-sql";
import { fetch } from "@tauri-apps/plugin-http";

let db: Database | null = null;

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
    db = await Database.load("sqlite:omnix.db");
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
    db = await Database.load("sqlite:omnix.db");
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
