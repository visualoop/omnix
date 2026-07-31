export type RuntimeTarget = "desktop" | "android" | "web";

export type FormFactor = "phone" | "tablet" | "desktop";

export interface RuntimeSignals {
  readonly isTauri: boolean;
  readonly userAgent: string;
  readonly viewportWidth: number;
  readonly maxTouchPoints: number;
}

export interface RuntimeCapabilities {
  readonly target: RuntimeTarget;
  readonly formFactor: FormFactor;
  readonly isNative: boolean;
  readonly isTouchCapable: boolean;
  readonly canUseCamera: boolean;
  readonly canUseBiometrics: boolean;
  readonly canUseSecureStorage: boolean;
  readonly canReceiveNotifications: boolean;
  readonly canShare: boolean;
  readonly canJoinPrivateMesh: boolean;
  readonly canObserveLifecycle: boolean;
  readonly canInstallApkUpdates: boolean;
}

export function detectRuntimeTarget(signals: RuntimeSignals): RuntimeTarget {
  if (!signals.isTauri) return "web";
  return /\bAndroid\b/i.test(signals.userAgent) ? "android" : "desktop";
}

export function resolveFormFactor(
  target: RuntimeTarget,
  viewportWidth: number,
): FormFactor {
  const safeWidth = Number.isFinite(viewportWidth) && viewportWidth > 0
    ? viewportWidth
    : 1280;
  if (target === "android") return safeWidth < 720 ? "phone" : "tablet";
  if (target === "web" && safeWidth < 720) return "phone";
  if (target === "web" && safeWidth < 1180) return "tablet";
  return "desktop";
}

export function resolveRuntimeCapabilities(
  signals: RuntimeSignals,
): RuntimeCapabilities {
  const target = detectRuntimeTarget(signals);
  const isAndroid = target === "android";

  return {
    target,
    formFactor: resolveFormFactor(target, signals.viewportWidth),
    isNative: target !== "web",
    isTouchCapable: signals.maxTouchPoints > 0,
    canUseCamera: isAndroid,
    canUseBiometrics: isAndroid,
    canUseSecureStorage: isAndroid,
    canReceiveNotifications: isAndroid,
    canShare: isAndroid || target === "web",
    canJoinPrivateMesh: isAndroid || target === "desktop",
    canObserveLifecycle: isAndroid,
    canInstallApkUpdates: isAndroid,
  };
}

export function readRuntimeSignals(): RuntimeSignals {
  const scope = globalThis as typeof globalThis & {
    __TAURI_INTERNALS__?: unknown;
  };
  const navigatorValue = typeof navigator === "undefined" ? undefined : navigator;
  const windowValue = typeof window === "undefined" ? undefined : window;

  return {
    isTauri: scope.__TAURI_INTERNALS__ !== undefined,
    userAgent: navigatorValue?.userAgent ?? "",
    viewportWidth: windowValue?.innerWidth ?? 1280,
    maxTouchPoints: navigatorValue?.maxTouchPoints ?? 0,
  };
}
