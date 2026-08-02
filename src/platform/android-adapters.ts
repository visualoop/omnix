import { addPluginListener, invoke } from "@tauri-apps/api/core";
import type {
  AdapterAvailability,
  AndroidBackRequest,
  ApkUpdateRequest,
  BiometricAvailability,
  DeviceNotification,
  NativePermissionState,
  PlatformAdapters,
  ScanOptions,
  SharePayload,
  Unsubscribe,
} from "@/platform/adapters";
import { createSecureStorageKey } from "@/platform/adapters";
import {
  ANDROID_COMMANDS,
  ANDROID_EVENTS,
  ANDROID_PLUGIN_ID,
  ANDROID_PLUGIN_INVOKE_PREFIX,
  exactRecord,
  isRecord,
  normalizePermissionState,
  requiredString,
  requiredUtcTimestamp,
  safeId,
  validateAndroidLocalRoute,
  validateApkUpdateRequest,
  validateApkUpdateStatus,
  validateEmptyResult,
  validateLifecycleState,
  validateMeshStatus,
  validateScanResult,
  type AndroidCommand,
  type AndroidEvent,
} from "@/platform/android-contract";

export interface AndroidNativeBridge {
  invoke(command: AndroidCommand, payload?: Record<string, unknown>): Promise<unknown>;
  listen(event: AndroidEvent, listener: (payload: unknown) => void): Promise<Unsubscribe>;
}

export const TAURI_ANDROID_BRIDGE: AndroidNativeBridge = {
  invoke: (command, payload) => invoke(
    `${ANDROID_PLUGIN_INVOKE_PREFIX}${command}`,
    payload === undefined ? undefined : { payload },
  ),
  listen: async (event, listener) => {
    const registration = await addPluginListener(ANDROID_PLUGIN_ID, event, (received) => {
      listener(received);
    });
    return () => registration.unregister();
  },
};

function availability(value: unknown): AdapterAvailability {
  if (!isRecord(value)) throw new Error("Android availability response is invalid");
  if (value.state === "available") {
    exactRecord(value, ["state"], "Android availability response");
    return { state: "available" };
  }
  if (value.state === "permission-required") {
    const result = exactRecord(value, ["state", "permission"], "Android availability response");
    const permission = requiredString(result.permission, "Android permission", 32);
    if (!["camera", "biometric", "notifications", "sharing", "vpn"].includes(permission)) {
      throw new Error("Android availability permission is invalid");
    }
    return { state: "permission-required", permission: permission as "camera" | "biometric" | "notifications" | "sharing" | "vpn" };
  }
  if (value.state === "unavailable") {
    const result = exactRecord(value, ["state", "reason"], "Android availability response");
    return { state: "unavailable", reason: requiredString(result.reason, "Android unavailable reason", 256) };
  }
  throw new Error("Android availability state is invalid");
}

async function permission(
  bridge: AndroidNativeBridge,
  command: AndroidCommand,
): Promise<NativePermissionState> {
  return normalizePermissionState(await bridge.invoke(command));
}

function booleanResult(value: unknown, field: string): boolean {
  const result = exactRecord(value, [field], `Android ${field} response`);
  if (typeof result[field] !== "boolean") {
    throw new Error(`Android ${field} response is invalid`);
  }
  return result[field] as boolean;
}

async function invokeEmpty(
  bridge: AndroidNativeBridge,
  command: AndroidCommand,
  payload?: Record<string, unknown>,
): Promise<void> {
  validateEmptyResult(await bridge.invoke(command, payload), command);
}

function validateSharePayload(value: SharePayload): SharePayload {
  const payload = exactRecord(value, ["title", "text", "url", "attachments"], "Share payload");
  const title = requiredString(payload.title, "Share title", 160);
  const text = payload.text === undefined ? undefined : requiredString(payload.text, "Share text", 16_384);
  let url: string | undefined;
  if (payload.url !== undefined) {
    let parsed: URL;
    try {
      parsed = new URL(requiredString(payload.url, "Share URL", 2048));
    } catch {
      throw new Error("Share URL is invalid");
    }
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new Error("Share URL is invalid");
    }
    url = parsed.toString();
  }
  if (payload.attachments !== undefined && !Array.isArray(payload.attachments)) {
    throw new Error("Share attachments are invalid");
  }
  const attachments = (payload.attachments as readonly unknown[] | undefined)?.map((value) => {
    const attachment = exactRecord(
      value,
      ["attachmentId", "mimeType", "displayName"],
      "Share attachment",
    );
    return {
      attachmentId: safeId(attachment.attachmentId, "Share attachment id"),
      mimeType: requiredString(attachment.mimeType, "Share MIME type", 128),
      displayName: requiredString(attachment.displayName, "Share display name", 255),
    };
  });
  if (!text && !url && (!attachments || attachments.length === 0)) {
    throw new Error("Share payload has no content");
  }
  if ((attachments?.length ?? 0) > 10) throw new Error("Share payload has too many attachments");
  return { title, text, url, attachments };
}

function validateNotification(value: DeviceNotification): DeviceNotification {
  const notification = exactRecord(
    value,
    ["id", "title", "body", "route", "scheduledFor"],
    "Notification",
  );
  return {
    id: safeId(notification.id, "Notification id"),
    title: requiredString(notification.title, "Notification title", 160),
    body: requiredString(notification.body, "Notification body", 4096),
    route: notification.route === undefined
      ? undefined
      : validateAndroidLocalRoute(notification.route, "Notification route"),
    scheduledFor: notification.scheduledFor === undefined
      ? undefined
      : requiredUtcTimestamp(notification.scheduledFor, "Notification schedule"),
  };
}

const REQUESTABLE_BARCODE_FORMATS = new Set([
  "code-128",
  "ean-8",
  "ean-13",
  "qr",
  "data-matrix",
]);

function validateScanOptions(value: ScanOptions | undefined): ScanOptions | undefined {
  if (value === undefined) return undefined;
  const options = exactRecord(value, ["formats", "prompt"], "Scan options");
  if (options.formats !== undefined && !Array.isArray(options.formats)) {
    throw new Error("Scan formats are invalid");
  }
  const formats = options.formats as readonly unknown[] | undefined;
  if ((formats?.length ?? 0) > 8) throw new Error("Too many scan formats");
  if (formats?.some((format) => typeof format !== "string" || !REQUESTABLE_BARCODE_FORMATS.has(format))) {
    throw new Error("Scan format is invalid");
  }
  return {
    formats: formats ? [...new Set(formats)] as ScanOptions["formats"] : undefined,
    prompt: options.prompt === undefined
      ? undefined
      : requiredString(options.prompt, "Scanner prompt", 160),
  };
}

export function createAndroidPlatformAdapters(
  bridge: AndroidNativeBridge = TAURI_ANDROID_BRIDGE,
): PlatformAdapters {
  return {
    secureStorage: {
      availability: async () => availability(await bridge.invoke(ANDROID_COMMANDS.secureStorageAvailability)),
      get: async (key) => {
        const safeKey = createSecureStorageKey(key.namespace, key.accountId, key.name);
        const result = exactRecord(
          await bridge.invoke(ANDROID_COMMANDS.secureStorageGet, { key: safeKey }),
          ["value"],
          "Android secure storage response",
        );
        if (result.value !== null && typeof result.value !== "string") {
          throw new Error("Android secure storage response is invalid");
        }
        return result.value as string | null;
      },
      set: async (key, value) => {
        const safeKey = createSecureStorageKey(key.namespace, key.accountId, key.name);
        if (!value || value.length > 65_536) throw new Error("Secure storage value is invalid");
        await invokeEmpty(bridge, ANDROID_COMMANDS.secureStorageSet, { key: safeKey, value });
      },
      remove: async (key) => {
        const safeKey = createSecureStorageKey(key.namespace, key.accountId, key.name);
        await invokeEmpty(bridge, ANDROID_COMMANDS.secureStorageRemove, { key: safeKey });
      },
    },
    biometrics: {
      availability: async (): Promise<BiometricAvailability> => {
        const result = exactRecord(
          await bridge.invoke(ANDROID_COMMANDS.biometricAvailability),
          ["status", "kinds", "enrolled"],
          "Android biometric response",
        );
        if (!Array.isArray(result.kinds) || typeof result.enrolled !== "boolean") {
          throw new Error("Android biometric response is invalid");
        }
        const kinds = result.kinds.map((kind) => requiredString(kind, "Biometric kind", 32));
        if (kinds.some((kind) => !["fingerprint", "face", "device-credential"].includes(kind))) {
          throw new Error("Android biometric kind is invalid");
        }
        return {
          status: availability(result.status),
          kinds: kinds as BiometricAvailability["kinds"],
          enrolled: result.enrolled,
        };
      },
      permission: () => permission(bridge, ANDROID_COMMANDS.biometricPermission),
      requestPermission: () => permission(bridge, ANDROID_COMMANDS.biometricRequestPermission),
      authenticate: async (reason) => ({
        verified: booleanResult(await bridge.invoke(ANDROID_COMMANDS.biometricAuthenticate, {
          reason: requiredString(reason, "Biometric reason", 160),
        }), "verified"),
      }),
    },
    scanner: {
      availability: async () => availability(await bridge.invoke(ANDROID_COMMANDS.scannerAvailability)),
      permission: () => permission(bridge, ANDROID_COMMANDS.scannerPermission),
      requestPermission: () => permission(bridge, ANDROID_COMMANDS.scannerRequestPermission),
      scan: async (options) => validateScanResult(await bridge.invoke(ANDROID_COMMANDS.scannerScan, {
        options: validateScanOptions(options),
      })),
      cancel: () => invokeEmpty(bridge, ANDROID_COMMANDS.scannerCancel),
    },
    share: {
      availability: async () => availability(await bridge.invoke(ANDROID_COMMANDS.shareAvailability)),
      permission: () => permission(bridge, ANDROID_COMMANDS.sharePermission),
      requestPermission: () => permission(bridge, ANDROID_COMMANDS.shareRequestPermission),
      share: async (payload) => ({
        completed: booleanResult(await bridge.invoke(ANDROID_COMMANDS.share, {
          payload: validateSharePayload(payload),
        }), "completed"),
      }),
    },
    notifications: {
      availability: async () => availability(await bridge.invoke(ANDROID_COMMANDS.notificationAvailability)),
      permission: () => permission(bridge, ANDROID_COMMANDS.notificationPermission),
      requestPermission: () => permission(bridge, ANDROID_COMMANDS.notificationRequestPermission),
      post: (notification) => invokeEmpty(bridge, ANDROID_COMMANDS.notificationPost, {
        notification: validateNotification(notification),
      }),
      cancel: (notificationId) => invokeEmpty(bridge, ANDROID_COMMANDS.notificationCancel, {
        notificationId: safeId(notificationId, "Notification id"),
      }),
    },
    mesh: {
      availability: async () => availability(await bridge.invoke(ANDROID_COMMANDS.meshAvailability)),
      status: async () => validateMeshStatus(await bridge.invoke(ANDROID_COMMANDS.meshStatus)),
      start: async (request) => validateMeshStatus(await bridge.invoke(ANDROID_COMMANDS.meshStart, {
        request: {
          accountId: safeId(request.accountId, "Mesh account id"),
          branchId: safeId(request.branchId, "Mesh branch id"),
          enrollmentId: safeId(request.enrollmentId, "Mesh enrollment id"),
        },
      })),
      stop: () => invokeEmpty(bridge, ANDROID_COMMANDS.meshStop),
    },
    lifecycle: {
      currentState: async () => validateLifecycleState(await bridge.invoke(ANDROID_COMMANDS.lifecycleCurrentState)),
      onStateChange: (listener) => bridge.listen(ANDROID_EVENTS.lifecycle, (payload) => {
        const event = exactRecord(payload, ["state"], "Android lifecycle event");
        listener(validateLifecycleState(event.state));
      }),
      onBackRequested: (listener) => bridge.listen(ANDROID_EVENTS.backRequested, (payload) => {
        const event = exactRecord(
          payload,
          ["requestId", "canGoBack"],
          "Android back event",
        );
        if (typeof event.canGoBack !== "boolean") {
          throw new Error("Android back event is invalid");
        }
        const request: AndroidBackRequest = {
          requestId: safeId(event.requestId, "Back request id"),
          canGoBack: event.canGoBack,
        };
        Promise.resolve(listener(request))
          .then((handled) => handled === true)
          .catch(() => false)
          .then((handled) => invokeEmpty(bridge, ANDROID_COMMANDS.lifecycleCompleteBack, {
            requestId: request.requestId,
            handled,
          }))
          .catch(() => undefined);
      }),
    },
    apkUpdates: {
      availability: async () => availability(await bridge.invoke(ANDROID_COMMANDS.apkUpdateAvailability)),
      status: async () => validateApkUpdateStatus(await bridge.invoke(ANDROID_COMMANDS.apkUpdateStatus)),
      stage: async (request: ApkUpdateRequest) => validateApkUpdateStatus(
        await bridge.invoke(ANDROID_COMMANDS.apkUpdateStage, { request: validateApkUpdateRequest(request) }),
      ),
      install: async (releaseId) => validateApkUpdateStatus(
        await bridge.invoke(ANDROID_COMMANDS.apkUpdateInstall, {
          releaseId: safeId(releaseId, "Release id"),
        }),
      ),
      cancel: (releaseId) => invokeEmpty(bridge, ANDROID_COMMANDS.apkUpdateCancel, {
        releaseId: safeId(releaseId, "Release id"),
      }),
    },
  };
}
