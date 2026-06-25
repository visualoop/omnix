/**
 * Local licences — multi-license per machine, mirror of the server-side
 * /api/licensing/sync flow.
 *
 * The desktop holds N licence keys at any time (Dawa + Retail +
 * Hospitality is fine; Pro excludes the four trade variants — that's
 * enforced server-side at activation).
 *
 * Lifecycle:
 *   1. App starts → load all rows from local_licenses
 *   2. After sign-in → POST /api/licensing/sync to refresh status
 *   3. User clicks "Add another licence" → POST /api/licensing/activate
 *      with the new key. On 200 we insert / upsert into local_licenses.
 *   4. Active workspace pointer (`settings.local_licenses.active_key`)
 *      drives which variant the UI is currently rendering.
 *
 * Why mirror the server: offline-first. Even with no internet, the
 * desktop has the last-known licence state and can keep running until
 * the grace window for maintenance / status expires.
 */
import { query, execute } from "@/lib/db"
import { fetch as tauriFetch } from "@tauri-apps/plugin-http"

const SYNC_ENDPOINT = "https://omnix.co.ke/api/licensing/sync"
const ACTIVATE_ENDPOINT = "https://omnix.co.ke/api/licensing/activate"

export type LicenseVariant = "pro" | "dawa" | "retail" | "hospitality" | "hardware"

export interface LocalLicense {
  license_key: string
  license_id: string | null
  variant: LicenseVariant
  tier: string
  status: string
  signed_key: string | null
  modules: string | null // JSON array as string
  max_machines: number
  max_branches: number
  auth_token: string | null
  auth_token_hash: string | null
  last_synced_at: string | null
  sync_status: string | null
  sync_message: string | null
  trial_ends_at: string | null
  maintenance_until: string | null
  activated_at: string
  last_verified_at: string | null
}

export type SyncStatus =
  | "verified"
  | "foreign"
  | "orphan_payload"
  | "recreated"
  | "seat_taken"

export interface SyncResult {
  key: string
  status: SyncStatus
  message?: string
  license?: {
    id: string
    licenseKey: string
    variant: LicenseVariant
    tier: string
    status: string
    modules: string[]
    maxBranches: number
    maxMachines: number
    maintenanceUntil: string | null
    trialEndsAt: string | null
  }
}

/** Load every local licence row, newest first. */
export async function listLocalLicenses(): Promise<LocalLicense[]> {
  return query<LocalLicense>(
    `SELECT * FROM local_licenses ORDER BY activated_at DESC`,
  )
}

/** Active key — the one currently rendering in the UI. */
export async function getActiveLicenseKey(): Promise<string | null> {
  const rows = await query<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'local_licenses.active_key'`,
  )
  return rows[0]?.value || null
}

export async function setActiveLicenseKey(key: string): Promise<void> {
  await execute(
    `INSERT INTO settings (key, value, category)
     VALUES ('local_licenses.active_key', ?1, 'licensing')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    [key],
  )
  // Pin the workspace's active module to match the licence's variant.
  // We pick the first allowed module: Pro defaults to "dawa" (most
  // common starting point), trade licences default to their own module.
  // The user can still drill into other modules via the sidebar after
  // load; this just decides what they land in after a switch.
  const rows = await query<{ variant: string; modules: string | null }>(
    `SELECT variant, modules FROM local_licenses WHERE license_key = ?1 LIMIT 1`,
    [key],
  )
  const row = rows[0]
  if (!row) return
  const defaultModule =
    row.variant === "pro"
      ? "dawa"
      : row.variant === "dawa"
        ? "dawa"
        : row.variant === "retail"
          ? "retail"
          : row.variant === "hardware"
            ? "hardware"
            : row.variant === "hospitality"
              ? "hospitality"
              : "dawa"
  await execute(
    `INSERT INTO settings (key, value, category)
     VALUES ('app.active_module', ?1, 'app')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    [defaultModule],
  )
}

/** The active local licence, full row (or null if none set / set value
 *  no longer exists). */
export async function getActiveLicense(): Promise<LocalLicense | null> {
  const key = await getActiveLicenseKey()
  if (!key) {
    // Fall back to the first row by activated_at if nothing is pinned.
    const rows = await listLocalLicenses()
    return rows[0] ?? null
  }
  const rows = await query<LocalLicense>(
    `SELECT * FROM local_licenses WHERE license_key = ?1 LIMIT 1`,
    [key],
  )
  return rows[0] ?? null
}

/**
 * POST /api/licensing/sync — bulk classify every locally-stored key
 * against the server. Updates local rows with the verified license_id,
 * status, modules, etc. so the desktop has fresh entitlement data.
 */
export async function syncLicenses(email: string, machineId: string): Promise<SyncResult[]> {
  const local = await listLocalLicenses()
  const keys = local.map((l) => l.license_key)
  if (keys.length === 0) return []

  const resp = await tauriFetch(SYNC_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, machineId, keys }),
  })
  if (!resp.ok) {
    throw new Error(`Sync failed: ${resp.status} ${resp.statusText}`)
  }
  const data = (await resp.json()) as { ok: boolean; results: SyncResult[] }
  if (!data.ok) throw new Error("Sync returned ok=false")

  // Reflect server truth into local_licenses.
  for (const r of data.results) {
    const message = r.message ?? null
    if (r.status === "verified" && r.license) {
      await execute(
        `UPDATE local_licenses SET
            license_id = ?1,
            variant = ?2,
            tier = ?3,
            status = ?4,
            modules = ?5,
            max_machines = ?6,
            max_branches = ?7,
            trial_ends_at = ?8,
            maintenance_until = ?9,
            sync_status = 'verified',
            sync_message = NULL,
            last_synced_at = datetime('now'),
            last_verified_at = datetime('now')
          WHERE license_key = ?10`,
        [
          r.license.id,
          r.license.variant,
          r.license.tier,
          r.license.status,
          JSON.stringify(r.license.modules),
          r.license.maxMachines,
          r.license.maxBranches,
          r.license.trialEndsAt,
          r.license.maintenanceUntil,
          r.key,
        ],
      )
    } else {
      await execute(
        `UPDATE local_licenses SET
            sync_status = ?1,
            sync_message = ?2,
            last_synced_at = datetime('now')
          WHERE license_key = ?3`,
        [r.status, message, r.key],
      )
    }
  }

  return data.results
}

/**
 * POST /api/licensing/activate — claim a seat for `licenseKey` on this
 * machine. Returns the licence the user owns + an auth token used for
 * subsequent telemetry / heartbeat calls.
 */
export async function activateLicense(input: {
  licenseKey: string
  email: string
  machineId: string
  variant?: string
  hostname?: string
  os?: string
  osVersion?: string
  arch?: string
  currentVersion?: string
}): Promise<{ ok: boolean; code?: string; error?: string; license?: LocalLicense }> {
  const resp = await tauriFetch(ACTIVATE_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  const data = (await resp.json()) as {
    ok: boolean
    code?: string
    error?: string
    authToken?: string
    action?: string
    entitlements?: {
      modules: string[]
      maxDevices: number
      maxBranches: number
      maintenanceUntil: string | null
      trialEndsAt: string | null
      majorVersionCap: number
      status: string
      variant: LicenseVariant
      licenseKey: string
    }
  }
  if (!resp.ok || !data.ok) {
    return { ok: false, code: data.code, error: data.error ?? `HTTP ${resp.status}` }
  }
  const e = data.entitlements!
  await execute(
    `INSERT INTO local_licenses (
        license_key, variant, tier, status, modules,
        max_machines, max_branches, auth_token,
        trial_ends_at, maintenance_until,
        sync_status, last_synced_at, last_verified_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'verified', datetime('now'), datetime('now'))
      ON CONFLICT(license_key) DO UPDATE SET
        variant = excluded.variant,
        tier = excluded.tier,
        status = excluded.status,
        modules = excluded.modules,
        max_machines = excluded.max_machines,
        max_branches = excluded.max_branches,
        auth_token = excluded.auth_token,
        trial_ends_at = excluded.trial_ends_at,
        maintenance_until = excluded.maintenance_until,
        sync_status = 'verified',
        last_synced_at = datetime('now'),
        last_verified_at = datetime('now')`,
    [
      e.licenseKey,
      e.variant,
      e.status === "trial" ? "trial" : e.variant === "pro" ? "business" : "starter",
      e.status,
      JSON.stringify(e.modules),
      e.maxDevices,
      e.maxBranches,
      data.authToken ?? null,
      e.trialEndsAt,
      e.maintenanceUntil,
    ],
  )
  // Auto-set as active when adding the first licence; otherwise leave
  // the user's current selection untouched.
  const current = await getActiveLicenseKey()
  if (!current) await setActiveLicenseKey(e.licenseKey)

  const row = (
    await query<LocalLicense>(`SELECT * FROM local_licenses WHERE license_key = ?1`, [e.licenseKey])
  )[0]
  return { ok: true, license: row }
}

/** Remove a licence from this machine. Does NOT release the server-side
 *  seat — call /api/licensing/deactivate (TODO) for that. */
export async function removeLocalLicense(key: string): Promise<void> {
  await execute(`DELETE FROM local_licenses WHERE license_key = ?1`, [key])
  const active = await getActiveLicenseKey()
  if (active === key) {
    const remaining = await listLocalLicenses()
    await setActiveLicenseKey(remaining[0]?.license_key ?? "")
  }
}

/** Pure helper — given the variants the user owns, return the
 *  human-readable list ("Dawa + Retail"). Used by the dashboard
 *  /downloads page and the desktop welcome banner. */
export function describeOwnedVariants(variants: LicenseVariant[]): string {
  const labels: Record<LicenseVariant, string> = {
    pro: "Pro (all trades)",
    dawa: "Dawa",
    retail: "Retail",
    hospitality: "Hospitality",
    hardware: "Hardware",
  }
  const ordered = [...new Set(variants)].sort()
  return ordered.map((v) => labels[v]).join(" + ")
}
