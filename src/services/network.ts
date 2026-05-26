import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";

export interface ServerStatus {
  running: boolean;
  url: string | null;
  mdns_active: boolean;
}

export interface PairingCodeInfo {
  code: string;
  expires_at: string;
}

export interface PairedDevice {
  token: string;            // truncated to first 8 chars + ...
  device_name: string;
  device_fingerprint: string | null;
  created_at: string;
  last_seen_at: string | null;
  revoked: number;
}

export interface DiscoveredServer {
  name: string;
  url: string;
}

export type NetworkMode = "standalone" | "master" | "client";

// ===== Mode + config (stored in settings table) =====

import { query, execute } from "@/lib/db";
import { APP_NAME } from "@/lib/brand";

const MODE_KEY = "network.mode";
const MASTER_URL_KEY = "network.master_url";
const MASTER_TOKEN_KEY = "network.master_token";
const SERVER_PORT_KEY = "network.server_port";
const DEVICE_NAME_KEY = "network.device_name";

export async function getMode(): Promise<NetworkMode> {
  const rows = await query<{ value: string }>("SELECT value FROM settings WHERE key = ?1", [MODE_KEY]);
  return (rows[0]?.value as NetworkMode) || "standalone";
}

export async function setMode(mode: NetworkMode): Promise<void> {
  await setSetting(MODE_KEY, mode);
}

export async function getServerPort(): Promise<number> {
  const rows = await query<{ value: string }>("SELECT value FROM settings WHERE key = ?1", [SERVER_PORT_KEY]);
  return parseInt(rows[0]?.value || "8765", 10);
}

export async function setServerPort(port: number): Promise<void> {
  await setSetting(SERVER_PORT_KEY, String(port));
}

export async function getDeviceName(): Promise<string> {
  const rows = await query<{ value: string }>("SELECT value FROM settings WHERE key = ?1", [DEVICE_NAME_KEY]);
  return rows[0]?.value || `${APP_NAME} Device`;
}

export async function setDeviceName(name: string): Promise<void> {
  await setSetting(DEVICE_NAME_KEY, name);
}

export async function getMasterConfig(): Promise<{ url: string | null; token: string | null }> {
  const rows = await query<{ key: string; value: string }>(
    "SELECT key, value FROM settings WHERE key IN (?1, ?2)",
    [MASTER_URL_KEY, MASTER_TOKEN_KEY]
  );
  let url: string | null = null;
  let token: string | null = null;
  for (const r of rows) {
    if (r.key === MASTER_URL_KEY) url = r.value;
    if (r.key === MASTER_TOKEN_KEY) token = r.value;
  }
  return { url, token };
}

export async function clearMasterConfig(): Promise<void> {
  await execute("DELETE FROM settings WHERE key IN (?1, ?2)", [MASTER_URL_KEY, MASTER_TOKEN_KEY]);
}

async function setSetting(key: string, value: string): Promise<void> {
  await execute(
    `INSERT INTO settings (key, value, category) VALUES (?1, ?2, 'network')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    [key, value]
  );
}

// ===== Master mode (server control) =====

export async function startServer(port: number, businessName: string): Promise<ServerStatus> {
  return invoke<ServerStatus>("start_lan_server", { port, businessName });
}

export async function stopServer(): Promise<void> {
  return invoke("stop_lan_server");
}

export async function getServerStatus(): Promise<ServerStatus> {
  return invoke<ServerStatus>("lan_server_status");
}

export async function generatePairingCode(): Promise<PairingCodeInfo> {
  return invoke<PairingCodeInfo>("generate_pairing_code");
}

export async function listPairedDevices(): Promise<PairedDevice[]> {
  return invoke<PairedDevice[]>("list_paired_devices");
}

export async function revokePairedDevice(tokenPrefix: string): Promise<void> {
  return invoke("revoke_paired_device", { tokenPrefix });
}

// ===== Client mode (pair with master) =====

export async function discoverServers(timeoutMs = 2000): Promise<DiscoveredServer[]> {
  return invoke<DiscoveredServer[]>("discover_lan_servers", { timeoutMs });
}

export interface PairResponse {
  token: string;
  business_name: string;
}

export async function pairWithMaster(
  masterUrl: string,
  code: string,
  deviceName: string,
  fingerprint?: string
): Promise<PairResponse> {
  const url = masterUrl.replace(/\/$/, "");
  const res = await fetch(`${url}/api/auth/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      device_name: deviceName,
      device_fingerprint: fingerprint,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Pairing failed (${res.status})`);
  }
  const data = (await res.json()) as PairResponse;
  // Persist credentials
  await setSetting(MASTER_URL_KEY, url);
  await setSetting(MASTER_TOKEN_KEY, data.token);
  await setMode("client");
  return data;
}

export async function pingMaster(masterUrl: string): Promise<{ ok: boolean; business?: string }> {
  try {
    const res = await fetch(`${masterUrl.replace(/\/$/, "")}/api/health`, { method: "GET" });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { business?: string; ok?: boolean };
    return { ok: !!data.ok, business: data.business };
  } catch {
    return { ok: false };
  }
}

// ===== Connection status (for topbar indicator) =====

export interface ConnectionStatus {
  mode: NetworkMode;
  online: boolean;             // master reachable in client mode, or server running in master mode
  master_url?: string;
  paired_count?: number;       // master mode only
  business_name?: string;
}

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  const mode = await getMode();
  if (mode === "standalone") {
    return { mode, online: true };
  }
  if (mode === "master") {
    const status = await getServerStatus();
    let pairedCount = 0;
    try {
      const devices = await listPairedDevices();
      pairedCount = devices.filter((d) => d.revoked === 0).length;
    } catch { /* ignore */ }
    return {
      mode,
      online: status.running,
      master_url: status.url || undefined,
      paired_count: pairedCount,
    };
  }
  // client
  const config = await getMasterConfig();
  if (!config.url) return { mode, online: false };
  const ping = await pingMaster(config.url);
  return {
    mode,
    online: ping.ok,
    master_url: config.url,
    business_name: ping.business,
  };
}
