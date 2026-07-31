import type {
  AdapterAvailability,
  BiometricKind,
  MeshConnectionState,
  NativePermissionState,
  NotificationPermission,
} from "@/platform/adapters";

export interface MobileAccountIdentity {
  readonly userId: string;
  readonly username: string;
  readonly fullName: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly role: "owner" | "manager" | "cashier" | "viewer";
}

export interface MobileDeviceIdentity {
  readonly deviceId: string;
  readonly deviceName: string;
  readonly platform: "android";
  readonly osVersion: string;
  readonly appVersion: string;
}

export interface MobileSecurityStatus {
  readonly secureStorage: AdapterAvailability;
  readonly biometricStatus: AdapterAvailability;
  readonly biometricPermission: NativePermissionState;
  readonly biometricKinds: readonly BiometricKind[];
  readonly biometricEnrolled: boolean;
  readonly notificationPermission: NotificationPermission;
}

export interface MobileSyncStatus {
  readonly state: "synced" | "syncing" | "pending" | "offline" | "error";
  readonly pendingCommands: number;
  readonly lastSuccessfulAt: string | null;
  readonly hubName: string | null;
}

export interface MobileMeshStatus {
  readonly state: MeshConnectionState;
  readonly nodeId: string | null;
  readonly hubName: string | null;
  readonly lastHandshakeAt: string | null;
}

export interface MobileStorageStatus {
  readonly usedBytes: number;
  readonly totalBytes: number;
  readonly cacheBytes: number;
  readonly lastCalculatedAt: string | null;
}

export interface MobileDeviceActivity {
  readonly id: string;
  readonly label: string;
  readonly detail: string | null;
  readonly occurredAt: string;
}

export interface AccountDeviceModel {
  readonly account: MobileAccountIdentity;
  readonly device: MobileDeviceIdentity;
  readonly security: MobileSecurityStatus;
  readonly sync: MobileSyncStatus;
  readonly mesh: MobileMeshStatus;
  readonly storage: MobileStorageStatus;
  readonly activity: readonly MobileDeviceActivity[];
}

function requiredIdentity(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function optionalContact(value: string | null): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function validByteCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * Validates account/device data returned by the native boundary before UI use.
 * Passwords, PINs, secrets, and enrollment tokens are deliberately absent.
 */
export function createAccountDeviceModel(
  input: AccountDeviceModel,
): AccountDeviceModel {
  if (input.device.platform !== "android") {
    throw new Error("Mobile account device must be Android");
  }
  if (!Number.isSafeInteger(input.sync.pendingCommands) || input.sync.pendingCommands < 0) {
    throw new Error("Pending sync command count is invalid");
  }
  if (
    !validByteCount(input.storage.usedBytes) ||
    !validByteCount(input.storage.totalBytes) ||
    !validByteCount(input.storage.cacheBytes) ||
    input.storage.usedBytes > input.storage.totalBytes ||
    input.storage.cacheBytes > input.storage.usedBytes
  ) {
    throw new Error("Device storage totals are invalid");
  }

  const activityIds = new Set<string>();
  const activity = input.activity.map((event) => {
    const id = requiredIdentity(event.id, "Activity id");
    if (activityIds.has(id)) throw new Error(`Activity id is duplicated: ${id}`);
    activityIds.add(id);
    return {
      id,
      label: requiredIdentity(event.label, "Activity label"),
      detail: optionalContact(event.detail),
      occurredAt: requiredIdentity(event.occurredAt, "Activity timestamp"),
    };
  });

  return {
    account: {
      ...input.account,
      userId: requiredIdentity(input.account.userId, "Account id"),
      username: requiredIdentity(input.account.username, "Username"),
      fullName: requiredIdentity(input.account.fullName, "Account name"),
      email: optionalContact(input.account.email),
      phone: optionalContact(input.account.phone),
    },
    device: {
      ...input.device,
      deviceId: requiredIdentity(input.device.deviceId, "Device id"),
      deviceName: requiredIdentity(input.device.deviceName, "Device name"),
      osVersion: requiredIdentity(input.device.osVersion, "OS version"),
      appVersion: requiredIdentity(input.device.appVersion, "App version"),
    },
    security: {
      ...input.security,
      secureStorage: { ...input.security.secureStorage },
      biometricStatus: { ...input.security.biometricStatus },
      biometricKinds: [...input.security.biometricKinds],
    },
    sync: { ...input.sync },
    mesh: { ...input.mesh },
    storage: { ...input.storage },
    activity,
  };
}

export function accountInitials(account: MobileAccountIdentity): string {
  const names = account.fullName.trim().split(/\s+/).filter(Boolean);
  if (names.length === 0) return account.username.slice(0, 2).toUpperCase();
  return names.slice(0, 2).map((name) => name[0]).join("").toUpperCase();
}

export function connectionLabel(model: AccountDeviceModel): string {
  if (model.sync.state === "offline") return "Offline — changes stay on this device";
  if (model.sync.state === "error") return "Sync needs attention";
  if (model.sync.pendingCommands > 0) {
    return `${model.sync.pendingCommands} change${model.sync.pendingCommands === 1 ? "" : "s"} waiting to sync`;
  }
  return "Up to date";
}
