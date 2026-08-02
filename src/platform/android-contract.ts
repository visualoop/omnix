import type {
  ApkUpdateRequest,
  ApkUpdateStatus,
  AppLifecycleState,
  BarcodeFormat,
  MeshStatus,
  NativePermissionState,
  ScanResult,
} from "@/platform/adapters";

export const ANDROID_PLUGIN_ID = "omnix-mobile" as const;
export const ANDROID_PLUGIN_INVOKE_PREFIX = `plugin:${ANDROID_PLUGIN_ID}|` as const;

export const ANDROID_COMMANDS = {
  secureStorageAvailability: "secure_storage_availability",
  secureStorageGet: "secure_storage_get",
  secureStorageSet: "secure_storage_set",
  secureStorageRemove: "secure_storage_remove",
  biometricAvailability: "biometric_availability",
  biometricPermission: "biometric_permission",
  biometricRequestPermission: "biometric_request_permission",
  biometricAuthenticate: "biometric_authenticate",
  scannerAvailability: "scanner_availability",
  scannerPermission: "scanner_permission",
  scannerRequestPermission: "scanner_request_permission",
  scannerScan: "scanner_scan",
  scannerCancel: "scanner_cancel",
  shareAvailability: "share_availability",
  sharePermission: "share_permission",
  shareRequestPermission: "share_request_permission",
  share: "share",
  notificationAvailability: "notification_availability",
  notificationPermission: "notification_permission",
  notificationRequestPermission: "notification_request_permission",
  notificationPost: "notification_post",
  notificationCancel: "notification_cancel",
  meshAvailability: "mesh_availability",
  meshStatus: "mesh_status",
  meshStart: "mesh_start",
  meshStop: "mesh_stop",
  lifecycleCurrentState: "lifecycle_current_state",
  lifecycleCompleteBack: "lifecycle_complete_back",
  apkUpdateAvailability: "apk_update_availability",
  apkUpdateStatus: "apk_update_status",
  apkUpdateStage: "apk_update_stage",
  apkUpdateInstall: "apk_update_install",
  apkUpdateCancel: "apk_update_cancel",
} as const;

export type AndroidCommand = typeof ANDROID_COMMANDS[keyof typeof ANDROID_COMMANDS];

export const ANDROID_EVENTS = {
  lifecycle: "lifecycle",
  backRequested: "back-requested",
  apkUpdateProgress: "apk-update-progress",
  notificationOpened: "notification-opened",
} as const;

export type AndroidEvent = typeof ANDROID_EVENTS[keyof typeof ANDROID_EVENTS];

const PERMISSION_STATES = new Set([
  "granted",
  "denied",
  "prompt",
  "prompt-with-rationale",
  "restricted",
  "unavailable",
]);
const BARCODE_FORMATS = new Set<BarcodeFormat>([
  "code-128",
  "ean-8",
  "ean-13",
  "qr",
  "data-matrix",
  "unknown",
]);
const LIFECYCLE_STATES = new Set<AppLifecycleState>(["active", "inactive", "background"]);
const APK_STATES = new Set<ApkUpdateStatus["state"]>([
  "idle",
  "downloading",
  "ready",
  "awaiting-user-consent",
  "installing",
  "failed",
]);
const UPDATE_HOSTS = new Set(["media.omnix.co.ke", "omnix.co.ke"]);
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SHA256 = /^[a-fA-F0-9]{64}$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function exactRecord(
  value: unknown,
  fields: readonly string[],
  label: string,
): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const allowed = new Set(fields);
  if (Object.keys(value).some((field) => !allowed.has(field))) {
    throw new Error(`${label} contains an unknown field`);
  }
  return value;
}

export function requiredString(value: unknown, field: string, max = 2048): string {
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error(`${field} is invalid`);
  return normalized;
}

export function safeId(value: unknown, field: string): string {
  const normalized = requiredString(value, field, 128);
  if (!SAFE_ID.test(normalized)) throw new Error(`${field} is invalid`);
  return normalized;
}

export function requiredUtcTimestamp(value: unknown, field: string): string {
  const normalized = requiredString(value, field, 64);
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/.exec(normalized);
  if (!match) throw new Error(`${field} must be a UTC ISO 8601 timestamp`);
  const expected = `${match[1]}.${(match[2] ?? "000").padEnd(3, "0")}Z`;
  const parsed = new Date(expected);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== expected) {
    throw new Error(`${field} must be a valid UTC ISO 8601 timestamp`);
  }
  return normalized;
}

export function androidLocalPathname(value: unknown, field: string): string {
  const route = requiredString(value, field, 512);
  if (!route.startsWith("/") || route.startsWith("//") || route.includes("\\") || /[\u0000-\u001f]/.test(route)) {
    throw new Error(`${field} is invalid`);
  }
  const encodedPath = route.split(/[?#]/, 1)[0];
  try {
    return decodeURIComponent(encodedPath).replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
  } catch {
    throw new Error(`${field} is invalid`);
  }
}

export function validateAndroidLocalRoute(value: unknown, field: string): string {
  const route = requiredString(value, field, 512);
  const lower = androidLocalPathname(route, field).toLowerCase();
  if (lower === "/settings" || lower.startsWith("/settings/")) {
    throw new Error(`${field} cannot target business Settings`);
  }
  return route;
}

export function normalizePermissionState(value: unknown): NativePermissionState {
  if (typeof value !== "string" || !PERMISSION_STATES.has(value)) {
    throw new Error("Android permission response is invalid");
  }
  return value === "prompt-with-rationale" ? "prompt" : value as NativePermissionState;
}

export function validateLifecycleState(value: unknown): AppLifecycleState {
  if (typeof value !== "string" || !LIFECYCLE_STATES.has(value as AppLifecycleState)) {
    throw new Error("Android lifecycle state is invalid");
  }
  return value as AppLifecycleState;
}

export function validateScanResult(value: unknown): ScanResult | null {
  if (value === null) return null;
  const result = exactRecord(value, ["value", "format", "capturedAt"], "Android scan response");
  const format = requiredString(result.format, "Scan format", 32) as BarcodeFormat;
  if (!BARCODE_FORMATS.has(format)) throw new Error("Scan format is invalid");
  return {
    value: requiredString(result.value, "Scan value", 4096),
    format,
    capturedAt: requiredUtcTimestamp(result.capturedAt, "Scan timestamp"),
  };
}

export function validateMeshStatus(value: unknown): MeshStatus {
  const result = exactRecord(
    value,
    ["state", "nodeId", "hubName", "lastHandshakeAt"],
    "Android mesh response",
  );
  const state = requiredString(result.state, "Mesh state", 32);
  if (!["disabled", "permission-denied", "starting", "connected", "degraded", "offline"].includes(state)) {
    throw new Error("Mesh state is invalid");
  }
  const nullable = (field: string): string | null => result[field] === null
    ? null
    : requiredString(result[field], `Mesh ${field}`, 256);
  return {
    state: state as MeshStatus["state"],
    nodeId: nullable("nodeId"),
    hubName: nullable("hubName"),
    lastHandshakeAt: result.lastHandshakeAt === null
      ? null
      : requiredUtcTimestamp(result.lastHandshakeAt, "Mesh lastHandshakeAt"),
  };
}

export function validateApkUpdateRequest(input: ApkUpdateRequest): ApkUpdateRequest {
  const request = exactRecord(
    input,
    ["releaseId", "versionName", "versionCode", "downloadUrl", "sha256", "signingCertificateSha256", "sizeBytes"],
    "APK update request",
  );
  const releaseId = safeId(request.releaseId, "Release id");
  const versionName = requiredString(request.versionName, "Version name", 64);
  if (!Number.isSafeInteger(request.versionCode) || (request.versionCode as number) <= 0) {
    throw new Error("Version code is invalid");
  }
  if (!Number.isSafeInteger(request.sizeBytes) || (request.sizeBytes as number) <= 0) {
    throw new Error("APK size is invalid");
  }
  let url: URL;
  try {
    url = new URL(requiredString(request.downloadUrl, "APK download URL", 2048));
  } catch {
    throw new Error("APK download URL is invalid");
  }
  if (
    url.protocol !== "https:" ||
    !UPDATE_HOSTS.has(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    !url.pathname.toLowerCase().endsWith(".apk")
  ) {
    throw new Error("APK download URL is not allowlisted");
  }
  if (!SHA256.test(String(request.sha256)) || !SHA256.test(String(request.signingCertificateSha256))) {
    throw new Error("APK verification digest is invalid");
  }
  return {
    releaseId,
    versionName,
    versionCode: request.versionCode as number,
    downloadUrl: url.toString(),
    sha256: String(request.sha256).toLowerCase(),
    signingCertificateSha256: String(request.signingCertificateSha256).toLowerCase(),
    sizeBytes: request.sizeBytes as number,
  };
}

export function validateApkUpdateStatus(value: unknown): ApkUpdateStatus {
  const result = exactRecord(
    value,
    ["state", "releaseId", "downloadedBytes", "totalBytes", "errorCode"],
    "Android update response",
  );
  const state = requiredString(result.state, "Update state", 32) as ApkUpdateStatus["state"];
  if (!APK_STATES.has(state)) throw new Error("Update state is invalid");
  const integer = (field: string): number => {
    const candidate = result[field];
    if (!Number.isSafeInteger(candidate) || (candidate as number) < 0) {
      throw new Error(`Update ${field} is invalid`);
    }
    return candidate as number;
  };
  const downloadedBytes = integer("downloadedBytes");
  const totalBytes = integer("totalBytes");
  if (downloadedBytes > totalBytes) throw new Error("Update byte totals are invalid");
  const releaseId = result.releaseId === null ? null : safeId(result.releaseId, "Update release id");
  if (state !== "idle" && state !== "failed" && releaseId === null) {
    throw new Error("Update release id is required for an active update");
  }
  if (["ready", "awaiting-user-consent", "installing"].includes(state) && downloadedBytes !== totalBytes) {
    throw new Error("Completed update bytes are inconsistent");
  }
  return {
    state,
    releaseId,
    downloadedBytes,
    totalBytes,
    errorCode: result.errorCode === null ? null : requiredString(result.errorCode, "Update error", 128),
  };
}

export function validateEmptyResult(value: unknown, command: string): void {
  exactRecord(value, [], `Android ${command} response`);
}
