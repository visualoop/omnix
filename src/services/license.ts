import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import { query, execute } from "@/lib/db";
import { VARIANT } from "@/lib/variant";

/**
 * Omnix licensing server base URL. Override with VITE_OMNIX_API at build time
 * (e.g. staging). Defaults to production.
 */
const ACTIVATION_API_BASE = (
  import.meta.env.VITE_OMNIX_API || "https://omnix.co.ke"
).replace(/\/$/, "");

/** Canonical entitlements returned by the activation/validation server. */
export interface ServerEntitlements {
  modules: string[];
  maxDevices: number;
  maxBranches: number;
  maintenanceUntil: string | null;
  trialEndsAt: string | null;
  majorVersionCap: number;
  status: string;
}

interface ActivateResponse {
  ok: boolean;
  authToken?: string;
  action?: string;
  entitlements?: ServerEntitlements;
  error?: string;
}

export interface LicensePayload {
  kid: string;
  name: string;
  email: string;
  issued: string;
  maint_exp: string;
  type: "perpetual" | "trial" | "subscription";
  feat: string[];
  /** Paid verticals (v2). v1 keys omit this; derive from feat via licensePayloadModules(). */
  modules?: string[];
  /** Seat count (v2). v1 keys omit this; treat missing/0 as 1. */
  max_devices?: number;
  ver: number;
}

/** Resolve licensed modules from a payload regardless of schema version (mirrors Rust effective_modules). */
export function licensePayloadModules(p: Pick<LicensePayload, "modules" | "feat">): string[] {
  if (p.modules && p.modules.length > 0) return p.modules;
  const out: string[] = [];
  for (const f of p.feat ?? []) {
    if (f === "pharmacy") out.push("dawa");
    else if (f === "retail") out.push("retail");
    else if (f === "hardware") out.push("hardware");
    else if (f === "hospitality") out.push("hospitality");
  }
  return out.length > 0 ? out : ["dawa"];
}

export interface MachineInfo {
  fingerprint: string;
  formatted: string;
}

export interface ActiveLicense {
  id: string;
  license_key: string;
  license_kid: string;
  customer_name: string;
  customer_email: string;
  issued_at: string;
  maintenance_expires_at: string;
  license_type: string;
  features_json: string;
  modules_json: string;
  max_devices: number;
  activation_token: string | null;
  server_validated: number;
  machine_fingerprint: string;
  activated_at: string;
  last_verified_at: string;
}

export interface LicenseStatus {
  activated: boolean;
  license: ActiveLicense | null;
  features: string[];
  /** Paid verticals unlocked by this license/trial. Drives module gating. */
  modules: string[];
  max_devices: number;
  /** False when activated via signed key only and not yet server-validated (offline path). */
  server_validated: boolean;
  maintenance_active: boolean;
  maintenance_days_remaining: number;
  machine: MachineInfo;
  trial?: TrialState;
}

/** Get the current machine's fingerprint */
export async function getMachineInfo(): Promise<MachineInfo> {
  return invoke<MachineInfo>("get_machine_info");
}

/** Verify a license key (does NOT activate) */
export async function verifyKey(key: string): Promise<{ valid: boolean; payload?: LicensePayload; error?: string }> {
  const result = await invoke<{ valid: boolean; payload: LicensePayload | null; error: string | null }>(
    "verify_license",
    { key }
  );
  return {
    valid: result.valid,
    payload: result.payload || undefined,
    error: result.error || undefined,
  };
}

/**
 * POST the license + machine fingerprint to the Omnix server to register a
 * seat and obtain a machine-bound token + canonical entitlements.
 * Returns null on any network/transport failure (caller falls back offline).
 */
async function activateOnline(
  key: string,
  fingerprint: string,
): Promise<{ ok: boolean; body?: ActivateResponse; seatFull?: boolean; error?: string } | null> {
  try {
    const res = await fetch(`${ACTIVATION_API_BASE}/api/licensing/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey: key, machineId: fingerprint, variant: VARIANT }),
    });
    if (res.ok) {
      const body = (await res.json()) as ActivateResponse;
      return { ok: true, body };
    }
    // 409 = seat cap; surface a hard error (do NOT fall back offline).
    let error = `Activation rejected (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) error = j.error;
    } catch {
      /* ignore */
    }
    return { ok: false, seatFull: res.status === 409, error };
  } catch {
    // Network unreachable — signal offline fallback to the caller.
    return null;
  }
}

/**
 * Recognise the key format. Two formats are supported:
 *
 * - "compact": OMNIX-PRO-XXXX-XXXX-XXXX (5 segments, ≤ 30 chars). Issued by
 *   the website. Server-validated. The desktop trusts what the server returns
 *   from /api/licensing/activate — there's no offline RSA signature to verify.
 *
 * - "rsa": OMNIX-<base64url(payload)>.<base64url(signature)> (one big blob,
 *   typically > 400 chars). Issued by the legacy licensing tool, RSA-verified
 *   in Rust by `verify_license_key`. Works offline.
 */
function isCompactKey(key: string): boolean {
  const cleaned = key.replace(/\s+/g, "").toUpperCase();
  // Compact format: 4–6 segments separated by '-', each segment 2–10 chars,
  // and no '.' separator (which RSA-signed keys always have).
  if (cleaned.includes(".")) return false;
  const parts = cleaned.split("-").filter((p) => p.length > 0);
  if (parts.length < 4 || parts.length > 6) return false;
  if (parts[0] !== "OMNIX") return false;
  return cleaned.length <= 40;
}

/** Activate a license key on this machine (online-first, offline fallback). */
export async function activateLicense(key: string): Promise<{ ok: boolean; error?: string; pending?: boolean }> {
  const cleaned = key.replace(/\s+/g, "");
  const machine = await getMachineInfo();

  // ── Block obvious local conflict — same on both code paths ──
  const existing = await query<ActiveLicense>("SELECT * FROM license WHERE id = 'active'");
  if (existing[0] && existing[0].machine_fingerprint !== machine.fingerprint) {
    return { ok: false, error: "License already activated on a different machine" };
  }

  if (isCompactKey(cleaned)) {
    // ── Server-validated path ─────────────────────────────────
    // No offline signature on these keys — the website-issued key only
    // means anything once /api/licensing/activate accepts it.
    const online = await activateOnline(cleaned, machine.fingerprint);
    if (!online) {
      return {
        ok: false,
        error: "Couldn't reach the licensing server. Check your internet and try again.",
      };
    }
    if (!online.ok) {
      return { ok: false, error: online.error || "Activation rejected by server" };
    }
    const ent = online.body?.entitlements;
    const modules = ent?.modules?.length ? ent.modules : ["core"];
    const maxDevices = ent?.maxDevices ?? 1;
    const token = online.body?.authToken ?? null;

    // The license table has NOT NULL constraints on customer_name,
    // customer_email and maintenance_expires_at. Compact keys don't carry
    // those fields; use safe empty / future defaults so the INSERT succeeds.
    const customerName = "";
    const customerEmail = "";
    const maintenanceExpiresAt =
      ent?.maintenanceUntil ?? ent?.trialEndsAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    try {
      await execute(
        `INSERT OR REPLACE INTO license
         (id, license_key, license_kid, customer_name, customer_email, issued_at,
          maintenance_expires_at, license_type, features_json, modules_json, max_devices,
          activation_token, server_validated, last_server_check_at,
          machine_fingerprint, activated_at, last_verified_at)
         VALUES ('active', ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, datetime('now'), datetime('now'))`,
        [
          cleaned,
          cleaned, // use the key itself as kid
          customerName,
          customerEmail,
          new Date().toISOString(),
          maintenanceExpiresAt,
          ent?.status === "active" ? "perpetual" : "trial",
          JSON.stringify([]),
          JSON.stringify(modules),
          maxDevices,
          token,
          1, // server-validated
          new Date().toISOString(),
          machine.fingerprint,
        ],
      );
    } catch (e) {
      const msg = String(e);
      console.error("[license] local SQLite write failed:", msg);
      return { ok: false, error: `Server accepted the key but local storage rejected it: ${msg}` };
    }

    await logActivationEvent(cleaned, "activated", null);
    return { ok: true };
  }

  // ── Legacy RSA-signed path (offline-capable) ───────────────
  const result = await verifyKey(cleaned);
  if (!result.valid || !result.payload) {
    await logActivationEvent("unknown", "failed", result.error);
    return { ok: false, error: result.error || "Invalid license key" };
  }

  const payload = result.payload;

  // Try online activation for seat enforcement + canonical entitlements.
  const online = await activateOnline(cleaned, machine.fingerprint);
  if (online && !online.ok) {
    return { ok: false, error: online.error || "Activation rejected by server" };
  }

  const serverEnt = online?.body?.entitlements;
  const modules = serverEnt?.modules?.length ? serverEnt.modules : licensePayloadModules(payload);
  const maxDevices =
    serverEnt?.maxDevices ?? (payload.max_devices && payload.max_devices > 0 ? payload.max_devices : 1);
  const token = online?.body?.authToken ?? null;
  const serverValidated = online ? 1 : 0;

  await execute(
    `INSERT OR REPLACE INTO license
     (id, license_key, license_kid, customer_name, customer_email, issued_at,
      maintenance_expires_at, license_type, features_json, modules_json, max_devices,
      activation_token, server_validated, last_server_check_at,
      machine_fingerprint, activated_at, last_verified_at)
     VALUES ('active', ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, datetime('now'), datetime('now'))`,
    [
      cleaned, payload.kid, payload.name, payload.email, payload.issued,
      payload.maint_exp, payload.type, JSON.stringify(payload.feat ?? []),
      JSON.stringify(modules), maxDevices,
      token, serverValidated, online ? new Date().toISOString() : null,
      machine.fingerprint,
    ],
  );

  await logActivationEvent(payload.kid, "activated", online ? null : "offline-pending");
  return { ok: true, pending: !online };
}

interface ValidateResponse {
  status: string;
  lockoutMode?: string;
  modules?: string[];
  maxMachines?: number;
  maintenanceUntil?: string | null;
  message?: string;
}

/**
 * Silent re-validation against the server. Safe to call on startup / online
 * windows. On success refreshes entitlements + clears the pending flag; on
 * network failure it's a no-op (offline-first — never blocks the app).
 * Returns true if the server confirmed a usable license, null if offline.
 */
export async function revalidateLicense(): Promise<boolean | null> {
  const rows = await query<ActiveLicense>("SELECT * FROM license WHERE id = 'active'");
  const active = rows[0];
  if (!active) return null;

  const machine = await getMachineInfo();
  try {
    const res = await fetch(`${ACTIVATION_API_BASE}/api/licensing/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey: active.license_key, machineId: machine.fingerprint, variant: VARIANT }),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as ValidateResponse;

    // Revoked/suspended licenses lose all modules.
    const revoked = body.status === "suspended" || body.status === "cancelled" || body.status === "invalid";
    const modules = revoked ? [] : body.modules?.length ? body.modules : parseModules(active);

    await execute(
      `UPDATE license SET modules_json = ?1, max_devices = ?2, server_validated = ?3,
         last_server_check_at = ?4, maintenance_expires_at = COALESCE(?5, maintenance_expires_at)
       WHERE id = 'active'`,
      [
        JSON.stringify(modules),
        body.maxMachines ?? active.max_devices ?? 1,
        revoked ? 0 : 1,
        new Date().toISOString(),
        body.maintenanceUntil ?? null,
      ],
    );
    return !revoked;
  } catch {
    return null; // offline — keep running on last-known entitlements
  }
}

/** Re-verify the active license (call on app startup) */
export async function getLicenseStatus(): Promise<LicenseStatus> {
  const machine = await getMachineInfo();
  const rows = await query<ActiveLicense>("SELECT * FROM license WHERE id = 'active'");
  const active = rows[0];

  if (!active) {
    // Check trial
    const trial = await getTrialState();
    if (trial.active) {
      return {
        activated: true,
        license: null,
        features: ["etims", "insurance", "lan", "reports"],
        modules: trial.modules ?? [],
        max_devices: 1,
        server_validated: false,
        maintenance_active: true,
        maintenance_days_remaining: trial.days_remaining,
        machine,
        trial,
      };
    }
    return {
      activated: false,
      license: null,
      features: [],
      modules: [],
      max_devices: 0,
      server_validated: false,
      maintenance_active: false,
      maintenance_days_remaining: 0,
      machine,
      trial,
    };
  }

  // Re-verify signature on every startup. Compact server-validated keys
  // (OMNIX-DAWA-XXXX-XXXX-XXXX) have no offline RSA signature, so we trust
  // what the server told us at activate-time (cached in modules_json /
  // max_devices) and let revalidateLicense() refresh it while online.
  if (!isCompactKey(active.license_key)) {
    const result = await verifyKey(active.license_key);
    if (!result.valid) {
      await logActivationEvent(active.license_kid, "failed", result.error);
      return {
        activated: false,
        license: null,
        features: [],
        modules: [],
        max_devices: 0,
        server_validated: false,
        maintenance_active: false,
        maintenance_days_remaining: 0,
        machine,
      };
    }
  }

  // Check machine binding
  if (active.machine_fingerprint !== machine.fingerprint) {
    return {
      activated: false,
      license: null,
      features: [],
      modules: [],
      max_devices: 0,
      server_validated: false,
      maintenance_active: false,
      maintenance_days_remaining: 0,
      machine,
    };
  }

  // Update last verified
  await execute("UPDATE license SET last_verified_at = datetime('now') WHERE id = 'active'");
  await logActivationEvent(active.license_kid, "verified", null);

  // Compute maintenance status
  const expiry = new Date(active.maintenance_expires_at);
  const now = new Date();
  const daysRemaining = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return {
    activated: true,
    license: active,
    features: JSON.parse(active.features_json) as string[],
    modules: parseModules(active),
    max_devices: active.max_devices ?? 1,
    server_validated: !!active.server_validated,
    maintenance_active: daysRemaining >= 0,
    maintenance_days_remaining: Math.max(0, daysRemaining),
    machine,
  };
}

/** Parse stored modules, falling back to feat-derived modules for pre-v2 activations. */
function parseModules(active: ActiveLicense): string[] {
  try {
    const mods = JSON.parse(active.modules_json || "[]") as string[];
    if (mods.length > 0) return mods;
  } catch {
    /* fall through */
  }
  const feat = (() => {
    try {
      return JSON.parse(active.features_json || "[]") as string[];
    } catch {
      return [];
    }
  })();
  return licensePayloadModules({ feat });
}

/** Modules unlocked by the active license/trial. Empty when not activated. */
export async function licensedModules(): Promise<string[]> {
  const status = await getLicenseStatus();
  return status.activated ? status.modules : [];
}

/** Whether a specific module is unlocked by the active license/trial. */
export async function isModuleLicensed(moduleId: string): Promise<boolean> {
  const mods = await licensedModules();
  return mods.includes(moduleId);
}

/**
 * Backend-authoritative module gate. Re-verifies the RSA-signed key in Rust
 * (cannot be spoofed from JS) and confirms `module` membership. Throws when the
 * module isn't licensed — call this at the top of module-scoped service writes.
 * No-op under VITE_SKIP_LICENSE (dev).
 */
export async function assertModuleEntitled(moduleId: string): Promise<void> {
  if (moduleId === "core") return;
  if (import.meta.env.VITE_SKIP_LICENSE === "1") return;
  const rows = await query<ActiveLicense>("SELECT license_key, modules_json FROM license WHERE id = 'active'");
  const row = rows[0];
  const key = row?.license_key;
  if (!key) {
    // Trial (no key) — fall back to the local entitlement check.
    if (await isModuleLicensed(moduleId)) return;
    throw new Error(`The ${moduleId} module is not included in your licence.`);
  }

  // Compact server-validated keys can't be RSA-verified. Use the locally
  // cached entitlements that the server sent on activate (refreshed by
  // revalidateLicense() while online).
  if (isCompactKey(key)) {
    const modules: string[] = row?.modules_json ? safeParseModules(row.modules_json) : [];
    if (!modules.includes(moduleId)) {
      throw new Error(`The ${moduleId} module is not included in your licence.`);
    }
    return;
  }

  const result = await invoke<{ entitled: boolean; error?: string }>("verify_module_entitled", {
    key,
    module: moduleId,
  });
  if (!result.entitled) {
    throw new Error(`The ${moduleId} module is not included in your licence.`);
  }
}

function safeParseModules(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Deactivate license (allows installing on another machine via support process) */
export async function deactivateLicense(): Promise<void> {
  const rows = await query<ActiveLicense>("SELECT license_kid FROM license WHERE id = 'active'");
  if (rows[0]) {
    await logActivationEvent(rows[0].license_kid, "deactivated", null);
  }
  await execute("DELETE FROM license WHERE id = 'active'");
}

async function logActivationEvent(
  kid: string,
  event: "activated" | "verified" | "failed" | "deactivated",
  error: string | null | undefined
): Promise<void> {
  const machine = await getMachineInfo();
  await execute(
    `INSERT INTO license_activations (id, license_kid, machine_fingerprint, event, error_message)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
    [crypto.randomUUID(), kid, machine.fingerprint, event, error || null]
  );
}

/** Format license key for display (groups of 5 chars, max 4 lines) */
export function formatKeyForDisplay(key: string): string {
  return key.match(/.{1,40}/g)?.join("\n") || key;
}

// ─── Trial mode (no server) ──────────────────────────────────────────
export interface TrialState {
  active: boolean;
  consumed: boolean;
  started_at: string | null;
  expires_at: string | null;
  duration_days: number;
  days_remaining: number;
  /** Single module the trial unlocks (v2). Populated by server-registered trials (Task 7). */
  modules?: string[];
}

const TRIAL_DURATION_DAYS = 30;

/** Get the current trial state (or null if never started). */
export async function getTrialState(): Promise<TrialState> {
  const rows = await query<{
    started_at: string;
    machine_fingerprint: string;
    duration_days: number;
    consumed: number;
    module: string;
  }>("SELECT * FROM trial_state WHERE id = 1");
  const row = rows[0];

  if (!row) {
    return {
      active: false,
      consumed: false,
      started_at: null,
      expires_at: null,
      duration_days: TRIAL_DURATION_DAYS,
      days_remaining: TRIAL_DURATION_DAYS,
      modules: [],
    };
  }

  // Verify machine binding — copying the DB to another machine doesn't extend the trial
  const machine = await getMachineInfo();
  if (row.machine_fingerprint !== machine.fingerprint) {
    return {
      active: false,
      consumed: true,           // treat as consumed to prevent abuse
      started_at: row.started_at,
      expires_at: null,
      duration_days: row.duration_days,
      days_remaining: 0,
      modules: [],
    };
  }

  const startedMs = new Date(row.started_at).getTime();
  const expiresMs = startedMs + row.duration_days * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const daysRemaining = Math.max(0, Math.ceil((expiresMs - now) / (24 * 60 * 60 * 1000)));
  const active = now < expiresMs;

  return {
    active,
    consumed: true,
    started_at: row.started_at,
    expires_at: new Date(expiresMs).toISOString(),
    duration_days: row.duration_days,
    days_remaining: daysRemaining,
    // A trial unlocks exactly one module (plus Core, which is never gated).
    modules: active ? [row.module] : [],
  };
}

/**
 * Best-effort server registration of a trial fingerprint so the same machine
 * can't farm repeated trials after reinstall. Never blocks (offline-friendly).
 */
async function registerTrialOnline(moduleId: string, fingerprint: string): Promise<boolean> {
  try {
    const res = await fetch(`${ACTIVATION_API_BASE}/api/trials/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleId, machineId: fingerprint }),
    });
    // 409 = already used on this fingerprint server-side.
    if (res.status === 409) return false;
    return res.ok;
  } catch {
    return false; // offline — allow local trial, server reconciles later
  }
}

/**
 * Start a single-module trial. Idempotent: if already started (or expired),
 * returns existing state. Registers the fingerprint server-side when online.
 */
export async function startTrial(moduleId: string = "dawa"): Promise<TrialState> {
  const existing = await getTrialState();
  if (existing.consumed) {
    return existing;
  }
  const machine = await getMachineInfo();
  const serverOk = await registerTrialOnline(moduleId, machine.fingerprint);
  await execute(
    `INSERT OR IGNORE INTO trial_state (id, started_at, machine_fingerprint, duration_days, consumed, module, server_registered)
     VALUES (1, datetime('now'), ?1, ?2, 1, ?3, ?4)`,
    [machine.fingerprint, TRIAL_DURATION_DAYS, moduleId, serverOk ? 1 : 0],
  );
  return getTrialState();
}


/**
 * Read the machine bearer token from local SQLite (set by activateLicense).
 * Used by cloud-backup endpoints + any other server-bound machine API call.
 * Returns null when the licence is offline-only (signed key without online activation).
 */
export async function getMachineAuthToken(): Promise<string | null> {
  const rows = await query<{ activation_token: string | null }>(
    `SELECT activation_token FROM license WHERE id = 'active' LIMIT 1`,
  );
  return rows[0]?.activation_token ?? null;
}


/**
 * Read the active licence key from local SQLite. Used to derive the
 * cloud-backup encryption key (the licence key is the stable, cross-device
 * identifier so backups remain decryptable on a fresh install).
 */
export async function getLicenseKey(): Promise<string | null> {
  const rows = await query<{ license_key: string | null }>(
    `SELECT license_key FROM license WHERE id = 'active' LIMIT 1`,
  );
  return rows[0]?.license_key ?? null;
}
