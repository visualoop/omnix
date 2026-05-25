import { invoke } from "@tauri-apps/api/core";
import { query, execute } from "@/lib/db";

export interface LicensePayload {
  kid: string;
  name: string;
  email: string;
  issued: string;
  maint_exp: string;
  type: "perpetual" | "trial" | "subscription";
  feat: string[];
  ver: number;
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
  machine_fingerprint: string;
  activated_at: string;
  last_verified_at: string;
}

export interface LicenseStatus {
  activated: boolean;
  license: ActiveLicense | null;
  features: string[];
  maintenance_active: boolean;
  maintenance_days_remaining: number;
  machine: MachineInfo;
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

/** Activate a license key on this machine */
export async function activateLicense(key: string): Promise<{ ok: boolean; error?: string }> {
  // 1. Verify signature
  const result = await verifyKey(key);
  if (!result.valid || !result.payload) {
    await logActivationEvent("unknown", "failed", result.error);
    return { ok: false, error: result.error || "Invalid license key" };
  }

  const payload = result.payload;
  const machine = await getMachineInfo();

  // 2. Check if already activated on a different machine
  const existing = await query<ActiveLicense>("SELECT * FROM license WHERE id = 'active'");
  if (existing[0] && existing[0].machine_fingerprint !== machine.fingerprint) {
    return { ok: false, error: "License already activated on a different machine" };
  }

  // 3. Insert/update
  await execute(
    `INSERT OR REPLACE INTO license 
     (id, license_key, license_kid, customer_name, customer_email, issued_at, 
      maintenance_expires_at, license_type, features_json, machine_fingerprint, 
      activated_at, last_verified_at)
     VALUES ('active', ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, datetime('now'), datetime('now'))`,
    [
      key, payload.kid, payload.name, payload.email, payload.issued,
      payload.maint_exp, payload.type, JSON.stringify(payload.feat),
      machine.fingerprint,
    ]
  );

  await logActivationEvent(payload.kid, "activated", null);
  return { ok: true };
}

/** Re-verify the active license (call on app startup) */
export async function getLicenseStatus(): Promise<LicenseStatus> {
  const machine = await getMachineInfo();
  const rows = await query<ActiveLicense>("SELECT * FROM license WHERE id = 'active'");
  const active = rows[0];

  if (!active) {
    return {
      activated: false,
      license: null,
      features: [],
      maintenance_active: false,
      maintenance_days_remaining: 0,
      machine,
    };
  }

  // Re-verify signature on every startup
  const result = await verifyKey(active.license_key);
  if (!result.valid) {
    await logActivationEvent(active.license_kid, "failed", result.error);
    return {
      activated: false,
      license: null,
      features: [],
      maintenance_active: false,
      maintenance_days_remaining: 0,
      machine,
    };
  }

  // Check machine binding
  if (active.machine_fingerprint !== machine.fingerprint) {
    return {
      activated: false,
      license: null,
      features: [],
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
    maintenance_active: daysRemaining >= 0,
    maintenance_days_remaining: Math.max(0, daysRemaining),
    machine,
  };
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
