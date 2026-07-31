export type NativePermission =
  | "camera"
  | "biometric"
  | "notifications"
  | "sharing";

export type NativePermissionState =
  | "granted"
  | "denied"
  | "prompt"
  | "restricted"
  | "unavailable";

export type AdapterAvailability =
  | { readonly state: "available" }
  | {
      readonly state: "permission-required";
      readonly permission: NativePermission;
    }
  | { readonly state: "unavailable"; readonly reason: string };

export interface NativePermissionAdapter {
  permission(): Promise<NativePermissionState>;
  requestPermission(): Promise<NativePermissionState>;
}

export interface SecureStorageKey {
  readonly namespace: "session" | "device" | "mesh";
  readonly accountId: string;
  readonly name: string;
}

export interface SecureStorageAdapter {
  availability(): Promise<AdapterAvailability>;
  get(key: SecureStorageKey): Promise<string | null>;
  set(key: SecureStorageKey, value: string): Promise<void>;
  remove(key: SecureStorageKey): Promise<void>;
}

const SECURE_KEY_PART = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/**
 * Builds the only key shape accepted at the React/native boundary.
 * Native implementations must repeat this validation before touching Keystore.
 */
export function createSecureStorageKey(
  namespace: SecureStorageKey["namespace"],
  accountId: string,
  name: string,
): SecureStorageKey {
  const normalizedAccountId = accountId.trim();
  const normalizedName = name.trim();
  if (!SECURE_KEY_PART.test(normalizedAccountId)) {
    throw new Error("Secure storage accountId is invalid");
  }
  if (!SECURE_KEY_PART.test(normalizedName)) {
    throw new Error("Secure storage key name is invalid");
  }
  return { namespace, accountId: normalizedAccountId, name: normalizedName };
}

export type BiometricKind = "fingerprint" | "face" | "device-credential";

export interface BiometricAvailability {
  readonly status: AdapterAvailability;
  readonly kinds: readonly BiometricKind[];
  readonly enrolled: boolean;
}

export interface BiometricAdapter extends NativePermissionAdapter {
  availability(): Promise<BiometricAvailability>;
  authenticate(reason: string): Promise<{ readonly verified: boolean }>;
}

export type BarcodeFormat =
  | "code-128"
  | "ean-8"
  | "ean-13"
  | "qr"
  | "data-matrix"
  | "unknown";

export interface ScanOptions {
  readonly formats?: readonly BarcodeFormat[];
  readonly prompt?: string;
}

export interface ScanResult {
  readonly value: string;
  readonly format: BarcodeFormat;
  readonly capturedAt: string;
}

export interface ScannerAdapter extends NativePermissionAdapter {
  availability(): Promise<AdapterAvailability>;
  scan(options?: ScanOptions): Promise<ScanResult | null>;
  cancel(): Promise<void>;
}

export interface ShareAttachment {
  /** Opaque id for an app-owned export resolved natively; never a filesystem path. */
  readonly attachmentId: string;
  readonly mimeType: string;
  readonly displayName: string;
}

export interface SharePayload {
  readonly title: string;
  readonly text?: string;
  readonly url?: string;
  readonly attachments?: readonly ShareAttachment[];
}

export interface ShareAdapter extends NativePermissionAdapter {
  availability(): Promise<AdapterAvailability>;
  share(payload: SharePayload): Promise<{ readonly completed: boolean }>;
}

export type NotificationPermission = NativePermissionState;

export interface DeviceNotification {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly route?: string;
  readonly scheduledFor?: string;
}

export interface NotificationAdapter extends NativePermissionAdapter {
  availability(): Promise<AdapterAvailability>;
  post(notification: DeviceNotification): Promise<void>;
  cancel(notificationId: string): Promise<void>;
}

export type MeshConnectionState =
  | "disabled"
  | "starting"
  | "connected"
  | "degraded"
  | "offline";

export interface MeshStatus {
  readonly state: MeshConnectionState;
  readonly nodeId: string | null;
  readonly hubName: string | null;
  readonly lastHandshakeAt: string | null;
}

export interface MeshStartRequest {
  readonly accountId: string;
  readonly branchId: string;
  /** Opaque enrollment record id; the token itself remains in native secure storage. */
  readonly enrollmentId: string;
}

export interface MeshAdapter {
  availability(): Promise<AdapterAvailability>;
  status(): Promise<MeshStatus>;
  start(request: MeshStartRequest): Promise<MeshStatus>;
  stop(): Promise<void>;
}

export type AppLifecycleState = "active" | "inactive" | "background";

export interface AndroidBackRequest {
  readonly requestId: string;
  readonly canGoBack: boolean;
}

export type Unsubscribe = () => void;

export interface LifecycleAdapter {
  currentState(): Promise<AppLifecycleState>;
  onStateChange(listener: (state: AppLifecycleState) => void): Promise<Unsubscribe>;
  onBackRequested(
    listener: (request: AndroidBackRequest) => boolean | Promise<boolean>,
  ): Promise<Unsubscribe>;
}

export type ApkUpdateState =
  | "idle"
  | "downloading"
  | "ready"
  | "awaiting-user-consent"
  | "installing"
  | "failed";

export interface ApkUpdateRequest {
  readonly releaseId: string;
  readonly versionName: string;
  readonly versionCode: number;
  readonly downloadUrl: string;
  readonly sha256: string;
  readonly signingCertificateSha256: string;
  readonly sizeBytes: number;
}

export interface ApkUpdateStatus {
  readonly state: ApkUpdateState;
  readonly releaseId: string | null;
  readonly downloadedBytes: number;
  readonly totalBytes: number;
  readonly errorCode: string | null;
}

export interface ApkUpdateAdapter {
  availability(): Promise<AdapterAvailability>;
  status(): Promise<ApkUpdateStatus>;
  stage(request: ApkUpdateRequest): Promise<ApkUpdateStatus>;
  install(releaseId: string): Promise<ApkUpdateStatus>;
  cancel(releaseId: string): Promise<void>;
}

export interface PlatformAdapters {
  readonly secureStorage: SecureStorageAdapter;
  readonly biometrics: BiometricAdapter;
  readonly scanner: ScannerAdapter;
  readonly share: ShareAdapter;
  readonly notifications: NotificationAdapter;
  readonly mesh: MeshAdapter;
  readonly lifecycle: LifecycleAdapter;
  readonly apkUpdates: ApkUpdateAdapter;
}

function unavailable(reason: string): AdapterAvailability {
  return { state: "unavailable", reason };
}

function rejectUnavailable(reason: string): Promise<never> {
  return Promise.reject(new Error(reason));
}

export function createUnavailablePlatformAdapters(
  reason = "Native Android adapter is not registered",
): PlatformAdapters {
  return {
    secureStorage: {
      availability: async () => unavailable(reason),
      get: () => rejectUnavailable(reason),
      set: () => rejectUnavailable(reason),
      remove: () => rejectUnavailable(reason),
    },
    biometrics: {
      availability: async () => ({
        status: unavailable(reason),
        kinds: [],
        enrolled: false,
      }),
      permission: async () => "unavailable",
      requestPermission: async () => "unavailable",
      authenticate: () => rejectUnavailable(reason),
    },
    scanner: {
      availability: async () => unavailable(reason),
      permission: async () => "unavailable",
      requestPermission: async () => "unavailable",
      scan: () => rejectUnavailable(reason),
      cancel: async () => undefined,
    },
    share: {
      availability: async () => unavailable(reason),
      permission: async () => "unavailable",
      requestPermission: async () => "unavailable",
      share: () => rejectUnavailable(reason),
    },
    notifications: {
      availability: async () => unavailable(reason),
      permission: async () => "unavailable",
      requestPermission: async () => "unavailable",
      post: () => rejectUnavailable(reason),
      cancel: async () => undefined,
    },
    mesh: {
      availability: async () => unavailable(reason),
      status: async () => ({
        state: "disabled",
        nodeId: null,
        hubName: null,
        lastHandshakeAt: null,
      }),
      start: () => rejectUnavailable(reason),
      stop: async () => undefined,
    },
    lifecycle: {
      currentState: () => rejectUnavailable(reason),
      onStateChange: () => rejectUnavailable(reason),
      onBackRequested: () => rejectUnavailable(reason),
    },
    apkUpdates: {
      availability: async () => unavailable(reason),
      status: async () => ({
        state: "idle",
        releaseId: null,
        downloadedBytes: 0,
        totalBytes: 0,
        errorCode: null,
      }),
      stage: () => rejectUnavailable(reason),
      install: () => rejectUnavailable(reason),
      cancel: async () => undefined,
    },
  };
}
