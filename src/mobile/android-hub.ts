import { invoke } from "@tauri-apps/api/core";
import type { User } from "@/services/auth";
import type { Branch } from "@/services/branches";
import type { ModuleId } from "@/stores/active-module";
import type { CountryCode } from "@/lib/countries";

export interface AndroidHubBranch {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface AndroidHubSession {
  readonly accessToken: string;
  readonly user: User;
  readonly activeBranchId: string;
  readonly assignedBranchIds: readonly string[];
  readonly permissions: readonly string[];
  readonly enabledModules: readonly string[];
  readonly expiresAt: string;
}

export interface AndroidHubConfig {
  readonly version: 1;
  readonly baseUrl: string;
  readonly nodeId: string;
  readonly businessName: string;
  readonly branches: readonly AndroidHubBranch[];
  readonly countryCode: CountryCode;
  readonly activeModule: ModuleId;
  /** Opaque native secure-storage record id for the currently enrolled branch. */
  readonly meshEnrollmentId: string | null;
  readonly session: AndroidHubSession | null;
}

export interface AndroidHubResponse {
  readonly status: number;
  readonly body: unknown;
}

export interface AndroidHubBridge {
  discover(timeoutMs: number): Promise<readonly { name: string; url: string }[]>;
  request(input: {
    baseUrl: string;
    method: "GET" | "POST";
    path: string;
    bearerToken?: string;
    body?: object;
  }): Promise<AndroidHubResponse>;
  load(): Promise<string | null>;
  save(value: string): Promise<void>;
  clear(): Promise<void>;
}

export const TAURI_ANDROID_HUB_BRIDGE: AndroidHubBridge = {
  discover: (timeoutMs) => invoke("discover_lan_servers", { timeoutMs }),
  request: (request) => invoke("android_hub_request", { request }),
  load: () => invoke("android_hub_config_get"),
  save: (value) => invoke("android_hub_config_set", { value }),
  clear: () => invoke("android_hub_config_clear"),
};

export type AndroidFirstRunFailure = "hub-unreachable" | "pairing-rejected" | "database-unavailable" | "storage-unavailable";

export interface AndroidFirstRunDiagnostic {
  readonly kind: AndroidFirstRunFailure;
  readonly title: string;
  readonly message: string;
  readonly retryable: boolean;
}

export class AndroidHubError extends Error {
  constructor(
    readonly kind: AndroidFirstRunFailure,
    message: string,
  ) {
    super(message);
    this.name = "AndroidHubError";
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} is invalid`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max = 256): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new Error(`${label} is invalid`);
  return value.trim();
}

function uuid(value: unknown, label: string): string {
  const normalized = text(value, label, 64);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new Error(`${label} is invalid`);
  }
  return normalized;
}

function country(value: unknown): CountryCode {
  return value === "UG" || value === "TZ" || value === "RW" ? value : "KE";
}

function moduleId(value: unknown): ModuleId {
  return value === "retail" || value === "hardware" || value === "hospitality" || value === "salon" || value === "core"
    ? value
    : "dawa";
}

function branch(value: unknown): AndroidHubBranch {
  const item = record(value, "Branch choice");
  return {
    id: uuid(item.id, "Branch id"),
    code: text(item.code, "Branch code", 64),
    name: text(item.name, "Branch name", 160),
  };
}

function userRole(value: unknown): User["role"] {
  return value === "owner" || value === "manager" || value === "cashier" ? value : "viewer";
}

function stringList(value: unknown, label: string, max = 100): string[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`${label} is invalid`);
  return [...new Set(value.map((item) => text(item, label, 256)))];
}

function normalizedBaseUrl(host: string, port: string): string {
  const raw = host.trim();
  if (!raw) throw new Error("Enter the hub host or IP address");
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Enter a valid hub host or IP address");
  }
  if (!port.trim() || !/^\d{1,5}$/.test(port.trim())) throw new Error("Enter a valid hub port");
  const portNumber = Number(port);
  if (portNumber < 1 || portNumber > 65_535) throw new Error("Enter a valid hub port");
  if (!url.hostname || url.username || url.password || (url.pathname !== "/" && url.pathname !== "") || url.search || url.hash) {
    throw new Error("Enter only the hub host or IP address");
  }
  url.protocol = url.protocol === "https:" ? "https:" : "http:";
  url.port = port.trim();
  url.pathname = "/";
  return url.toString().replace(/\/$/, "");
}

export function splitHubUrl(value: string): { host: string; port: string } {
  try {
    const url = new URL(value);
    return {
      host: url.hostname,
      port: url.port || (url.protocol === "https:" ? "443" : "80"),
    };
  } catch {
    return { host: value, port: "8765" };
  }
}

function responseError(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const candidate = body as { error?: unknown; code?: unknown };
    if (typeof candidate.error === "string" && candidate.error.trim()) return candidate.error;
    if (typeof candidate.code === "string" && candidate.code.trim()) return candidate.code;
  }
  return fallback;
}

export async function discoverAndroidHubs(
  bridge: AndroidHubBridge = TAURI_ANDROID_HUB_BRIDGE,
): Promise<readonly { name: string; url: string }[]> {
  return bridge.discover(2_500);
}

export async function pairAndroidHub(
  input: { host: string; port: string; code: string; deviceName: string; fingerprint: string },
  bridge: AndroidHubBridge = TAURI_ANDROID_HUB_BRIDGE,
): Promise<AndroidHubConfig> {
  const baseUrl = normalizedBaseUrl(input.host, input.port);
  const code = input.code.trim();
  if (!/^\d{6}$/.test(code)) throw new AndroidHubError("pairing-rejected", "Enter the six-digit code shown on the branch hub");
  const deviceName = text(input.deviceName, "Device name", 120);

  let health: AndroidHubResponse;
  try {
    health = await bridge.request({ baseUrl, method: "GET", path: "/api/health" });
  } catch (error) {
    throw new AndroidHubError("hub-unreachable", error instanceof Error ? error.message : "The branch hub did not respond");
  }
  if (health.status !== 200) throw new AndroidHubError("hub-unreachable", "The address responded, but it is not an available Omnix branch hub");

  let paired: AndroidHubResponse;
  try {
    paired = await bridge.request({
      baseUrl,
      method: "POST",
      path: "/api/auth/pair",
      body: { code, device_name: deviceName, device_fingerprint: input.fingerprint },
    });
  } catch (error) {
    throw new AndroidHubError("hub-unreachable", error instanceof Error ? error.message : "The branch hub did not respond");
  }
  if (paired.status < 200 || paired.status >= 300) {
    throw new AndroidHubError("pairing-rejected", responseError(paired.body, "The pairing code was rejected or expired"));
  }
  const result = record(paired.body, "Pairing response");
  const branches = Array.isArray(result.branches) ? result.branches.map(branch) : [];
  if (branches.length === 0) throw new AndroidHubError("pairing-rejected", "The hub has no active branch. Create a branch on the desktop hub, then retry.");
  const config: AndroidHubConfig = {
    version: 1,
    baseUrl,
    nodeId: uuid(result.node_id, "Paired node id"),
    businessName: text(result.business_name, "Business name", 160),
    branches,
    countryCode: country(result.country_code),
    activeModule: moduleId(result.active_module),
    meshEnrollmentId: null,
    session: null,
  };
  try {
    await bridge.save(JSON.stringify(config));
  } catch (error) {
    throw new AndroidHubError("storage-unavailable", error instanceof Error ? error.message : "The paired hub could not be saved securely");
  }
  return config;
}

export async function loginAndroidHub(
  config: AndroidHubConfig,
  input: { username: string; password: string; branchId: string },
  bridge: AndroidHubBridge = TAURI_ANDROID_HUB_BRIDGE,
): Promise<AndroidHubConfig> {
  if (!config.branches.some((candidate) => candidate.id === input.branchId)) {
    throw new Error("Choose a branch advertised by this hub");
  }
  let response: AndroidHubResponse;
  try {
    response = await bridge.request({
      baseUrl: config.baseUrl,
      method: "POST",
      path: "/api/v1/auth/branch-local-login",
      body: {
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        loginType: "auth.branchLocalLogin.v1",
        nodeId: config.nodeId,
        branchId: input.branchId,
        username: text(input.username, "Username", 128),
        password: input.password,
        requestedAccess: "android",
      },
    });
  } catch (error) {
    throw new AndroidHubError("hub-unreachable", error instanceof Error ? error.message : "The branch hub did not respond");
  }
  if (response.status < 200 || response.status >= 300) {
    throw new AndroidHubError("pairing-rejected", responseError(response.body, "The username, password, or branch assignment was rejected"));
  }
  const result = record(response.body, "Login response");
  const assignedBranchIds = stringList(result.assignedBranchIds, "Assigned branches").map((id) => uuid(id, "Assigned branch id"));
  const activeBranchId = uuid(result.branchId, "Active branch id");
  if (!assignedBranchIds.includes(activeBranchId)) throw new Error("The hub returned an invalid branch assignment");
  const meshEnrollmentId = result.meshEnrollmentId == null
    ? null
    : uuid(result.meshEnrollmentId, "Private Mesh enrollment id");
  const next: AndroidHubConfig = {
    ...config,
    meshEnrollmentId,
    session: {
      accessToken: text(result.accessToken, "Access token", 512),
      user: {
        id: uuid(result.userId, "User id"),
        username: input.username.trim(),
        full_name: text(result.fullName, "Full name", 160),
        role: userRole(result.role),
        active: 1,
      },
      activeBranchId,
      assignedBranchIds,
      permissions: stringList(result.permissions, "Permissions", 500),
      enabledModules: stringList(result.enabledModules, "Enabled modules", 32),
      expiresAt: text(result.expiresAt, "Session expiry", 64),
    },
  };
  await bridge.save(JSON.stringify(next));
  return next;
}

export function parseAndroidHubConfig(value: string): AndroidHubConfig {
  const raw = record(JSON.parse(value) as unknown, "Saved hub");
  if (raw.version !== 1) throw new Error("Saved hub version is unsupported");
  const branches = Array.isArray(raw.branches) ? raw.branches.map(branch) : [];
  const base: AndroidHubConfig = {
    version: 1,
    baseUrl: text(raw.baseUrl, "Saved hub address", 2048),
    nodeId: uuid(raw.nodeId, "Saved node id"),
    businessName: text(raw.businessName, "Saved business name", 160),
    branches,
    countryCode: country(raw.countryCode),
    activeModule: moduleId(raw.activeModule),
    meshEnrollmentId: raw.meshEnrollmentId == null
      ? null
      : uuid(raw.meshEnrollmentId, "Saved Private Mesh enrollment id"),
    session: null,
  };
  if (raw.session === null || raw.session === undefined) return base;
  const saved = record(raw.session, "Saved session");
  const savedUser = record(saved.user, "Saved user");
  const assignedBranchIds = stringList(saved.assignedBranchIds, "Saved assigned branches").map((id) => uuid(id, "Saved branch id"));
  const activeBranchId = uuid(saved.activeBranchId, "Saved active branch id");
  if (!assignedBranchIds.includes(activeBranchId)) throw new Error("Saved session branch is invalid");
  return {
    ...base,
    session: {
      accessToken: text(saved.accessToken, "Saved access token", 512),
      user: {
        id: uuid(savedUser.id, "Saved user id"),
        username: text(savedUser.username, "Saved username", 128),
        full_name: text(savedUser.full_name, "Saved full name", 160),
        role: userRole(savedUser.role),
        active: 1,
      },
      activeBranchId,
      assignedBranchIds,
      permissions: stringList(saved.permissions, "Saved permissions", 500),
      enabledModules: stringList(saved.enabledModules, "Saved modules", 32),
      expiresAt: text(saved.expiresAt, "Saved session expiry", 64),
    },
  };
}

export async function loadAndroidHub(
  bridge: AndroidHubBridge = TAURI_ANDROID_HUB_BRIDGE,
): Promise<AndroidHubConfig | null> {
  const value = await bridge.load();
  if (!value) return null;
  const config = parseAndroidHubConfig(value);
  if (config.session && Date.parse(config.session.expiresAt) <= Date.now()) {
    const expired = { ...config, session: null };
    await bridge.save(JSON.stringify(expired));
    return expired;
  }
  return config;
}

export async function clearAndroidHubSession(
  config: AndroidHubConfig,
  bridge: AndroidHubBridge = TAURI_ANDROID_HUB_BRIDGE,
): Promise<AndroidHubConfig> {
  const next = { ...config, session: null };
  await bridge.save(JSON.stringify(next));
  return next;
}

export function toBranch(branch: AndroidHubBranch): Branch {
  return {
    ...branch,
    address: null,
    phone: null,
    email: null,
    manager_id: null,
    is_default: 0,
    active: 1,
    timezone: "Africa/Nairobi",
    kra_pin: null,
    etims_device_id: null,
    open_time: null,
    close_time: null,
    notes: null,
    created_at: "",
  };
}

export function diagnosticFor(error: unknown): AndroidFirstRunDiagnostic {
  if (error instanceof AndroidHubError) {
    const titles: Record<AndroidFirstRunFailure, string> = {
      "hub-unreachable": "Branch hub not reached",
      "pairing-rejected": "Pairing not accepted",
      "database-unavailable": "Local database unavailable",
      "storage-unavailable": "Secure storage unavailable",
    };
    return { kind: error.kind, title: titles[error.kind], message: error.message, retryable: true };
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/database|sqlite|plugin:sql|local workspace/i.test(message)) {
    return {
      kind: "database-unavailable",
      title: "Local database unavailable",
      message: "Android uses the branch hub as its source of record. Connect to a hub below; a local business database is not required.",
      retryable: true,
    };
  }
  return {
    kind: "storage-unavailable",
    title: "Enrollment could not be loaded",
    message: `${message}. Retry, or pair this device again.`,
    retryable: true,
  };
}

let activeAndroidHub: AndroidHubConfig | null = null;

export function setActiveAndroidHub(config: AndroidHubConfig | null): void {
  activeAndroidHub = config;
}

export function getActiveAndroidHubTransport(): {
  url: string;
  nodeId: string;
  accessToken: string;
  userId: string;
} | null {
  const session = activeAndroidHub?.session;
  if (!activeAndroidHub || !session) return null;
  return {
    url: activeAndroidHub.baseUrl,
    nodeId: activeAndroidHub.nodeId,
    accessToken: session.accessToken,
    userId: session.user.id,
  };
}

export async function requestActiveAndroidHub<T>(
  path: string,
  body: object,
): Promise<T> {
  const transport = getActiveAndroidHubTransport();
  if (!transport) throw new Error("An authenticated Android branch-hub session is required");
  const response = await TAURI_ANDROID_HUB_BRIDGE.request({
    baseUrl: transport.url,
    method: "POST",
    path,
    bearerToken: transport.accessToken,
    body,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(responseError(response.body, `Command failed (${response.status})`));
  }
  return response.body as T;
}

export async function forgetAndroidHub(
  bridge: AndroidHubBridge = TAURI_ANDROID_HUB_BRIDGE,
): Promise<void> {
  activeAndroidHub = null;
  await bridge.clear();
}

export async function selectAndroidHubBranch(
  config: AndroidHubConfig,
  branchId: string,
  bridge: AndroidHubBridge = TAURI_ANDROID_HUB_BRIDGE,
): Promise<AndroidHubConfig> {
  if (!config.session || !config.session.assignedBranchIds.includes(branchId)) {
    throw new Error("This branch is not assigned to your account");
  }
  const next: AndroidHubConfig = {
    ...config,
    meshEnrollmentId: branchId === config.session.activeBranchId ? config.meshEnrollmentId : null,
    session: { ...config.session, activeBranchId: branchId },
  };
  await bridge.save(JSON.stringify(next));
  activeAndroidHub = next;
  return next;
}
