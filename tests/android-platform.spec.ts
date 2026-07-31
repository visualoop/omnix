import { describe, expect, it } from "vitest";
import {
  createSecureStorageKey,
  createUnavailablePlatformAdapters,
} from "@/platform/adapters";
import { createAccountDeviceModel } from "@/mobile/models/account-device";
import {
  activeBranchFromContext,
  createOperationalContext,
  requireOperationalBranchFromContext,
  type OperationalContext,
} from "@/platform/operational-context";
import {
  detectRuntimeTarget,
  resolveRuntimeCapabilities,
} from "@/platform/runtime";
import {
  ANDROID_MOBILE_ROUTES,
  resolveAndroidNavigation,
  type MobileRouteDefinition,
} from "@/mobile/navigation";

function context(
  scope: OperationalContext["scope"] = { kind: "branch", branchId: "branch-1" },
): OperationalContext {
  return createOperationalContext({
    userId: "user-1",
    permissions: ["pos.use", "inventory.view", "pharmacy.dispense"],
    assignedBranches: [
      { id: "branch-1", code: "NRB", name: "Nairobi", isPrimary: true },
      { id: "branch-2", code: "MSA", name: "Mombasa", isPrimary: false },
    ],
    scope,
    country: "KE",
  });
}

describe("Android runtime contract", () => {
  it("requires both Tauri and an Android runtime before selecting native Android", () => {
    expect(detectRuntimeTarget({
      isTauri: false,
      userAgent: "Mozilla/5.0 (Linux; Android 15)",
      viewportWidth: 412,
      maxTouchPoints: 5,
    })).toBe("web");

    expect(detectRuntimeTarget({
      isTauri: true,
      userAgent: "Mozilla/5.0 (Linux; Android 15)",
      viewportWidth: 412,
      maxTouchPoints: 5,
    })).toBe("android");
  });

  it("keeps touch capability separate from phone/tablet form factor", () => {
    const runtime = resolveRuntimeCapabilities({
      isTauri: true,
      userAgent: "Android",
      viewportWidth: 900,
      maxTouchPoints: 0,
    });

    expect(runtime.formFactor).toBe("tablet");
    expect(runtime.isTouchCapable).toBe(false);
    expect(runtime.canUseSecureStorage).toBe(true);
    expect(runtime.canObserveLifecycle).toBe(true);
    expect(runtime.canInstallApkUpdates).toBe(true);
  });

  it("falls back safely when a native viewport signal is invalid", () => {
    const runtime = resolveRuntimeCapabilities({
      isTauri: true,
      userAgent: "Android",
      viewportWidth: Number.NaN,
      maxTouchPoints: 1,
    });

    expect(runtime.formFactor).toBe("tablet");
  });
});

describe("Android operational context", () => {
  it("preserves launch-country currency and assigned branch context", () => {
    const active = context();
    expect(active.country).toBe("KE");
    expect(active.currency).toBe("KES");
    expect(active.scope).toEqual({ kind: "branch", branchId: "branch-1" });
  });

  it("resolves an explicit branch and rejects all-branch analytics for commands", () => {
    const branchContext = context();
    expect(activeBranchFromContext(branchContext)?.id).toBe("branch-1");
    expect(requireOperationalBranchFromContext(branchContext).id).toBe("branch-1");

    const analyticsContext = context({ kind: "all-branches" });
    expect(activeBranchFromContext(analyticsContext)).toBeNull();
    expect(() => requireOperationalBranchFromContext(analyticsContext)).toThrow(
      "require one explicit assigned branch",
    );
  });

  it("rejects an active branch not assigned to the account", () => {
    expect(() => context({ kind: "branch", branchId: "branch-3" })).toThrow(
      "not assigned",
    );
  });

  it("rejects duplicate branches and detaches branch data from caller mutation", () => {
    const branch = { id: "branch-1", code: "NRB", name: "Nairobi", isPrimary: true };
    expect(() => createOperationalContext({
      userId: "user-1",
      permissions: [],
      assignedBranches: [branch, { ...branch }],
      scope: { kind: "branch", branchId: "branch-1" },
      country: "KE",
    })).toThrow("duplicated");

    const created = createOperationalContext({
      userId: "user-1",
      permissions: [" inventory.view ", "inventory.view"],
      assignedBranches: [branch],
      scope: { kind: "branch", branchId: "branch-1" },
      country: "KE",
    });
    branch.name = "Changed later";

    expect(created.assignedBranches[0].name).toBe("Nairobi");
    expect(created.permissions).toEqual(["inventory.view"]);
  });
});

describe("Android platform adapters", () => {
  it("fails closed rather than storing sensitive data in an insecure fallback", async () => {
    const adapters = createUnavailablePlatformAdapters("plugin missing");
    await expect(adapters.secureStorage.availability()).resolves.toEqual({
      state: "unavailable",
      reason: "plugin missing",
    });
    await expect(
      adapters.secureStorage.set(
        { namespace: "mesh", accountId: "user-1", name: "private-key" },
        "secret",
      ),
    ).rejects.toThrow("plugin missing");
    await expect(adapters.mesh.status()).resolves.toMatchObject({ state: "disabled" });
    await expect(adapters.scanner.permission()).resolves.toBe("unavailable");
    await expect(adapters.biometrics.requestPermission()).resolves.toBe("unavailable");
    await expect(adapters.share.permission()).resolves.toBe("unavailable");
    await expect(adapters.notifications.permission()).resolves.toBe("unavailable");
    await expect(adapters.lifecycle.currentState()).rejects.toThrow("plugin missing");
    await expect(adapters.apkUpdates.availability()).resolves.toEqual({
      state: "unavailable",
      reason: "plugin missing",
    });
  });

  it("constructs only normalized account-scoped secure storage keys", () => {
    expect(createSecureStorageKey("session", " user-1 ", "refresh-token")).toEqual({
      namespace: "session",
      accountId: "user-1",
      name: "refresh-token",
    });
    expect(() => createSecureStorageKey("mesh", "user/1", "private-key")).toThrow(
      "accountId",
    );
    expect(() => createSecureStorageKey("mesh", "user-1", "../private-key")).toThrow(
      "key name",
    );
  });
});

describe("Android account/device model", () => {
  it("rejects invalid sync state and detaches native arrays", () => {
    const biometricKinds = ["fingerprint"] as const;
    const input = {
      account: {
        userId: "user-1",
        username: "alice",
        fullName: "Alice",
        email: " alice@example.test ",
        phone: null,
        role: "manager" as const,
      },
      device: {
        deviceId: "android-1",
        deviceName: "Front counter",
        platform: "android" as const,
        osVersion: "Android 15",
        appVersion: "0.73.0",
      },
      security: {
        secureStorage: { state: "available" as const },
        biometricStatus: { state: "available" as const },
        biometricPermission: "granted" as const,
        biometricKinds,
        biometricEnrolled: true,
        notificationPermission: "granted" as const,
      },
      sync: {
        state: "synced" as const,
        pendingCommands: 0,
        lastSuccessfulAt: null,
        hubName: null,
      },
      mesh: {
        state: "disabled" as const,
        nodeId: null,
        hubName: null,
        lastHandshakeAt: null,
      },
      storage: {
        usedBytes: 100,
        totalBytes: 1_000,
        cacheBytes: 10,
        lastCalculatedAt: null,
      },
      activity: [{
        id: "event-1",
        label: "Signed in",
        detail: null,
        occurredAt: "2026-07-31T08:00:00Z",
      }],
    };

    const created = createAccountDeviceModel(input);
    expect(created).not.toBe(input);
    expect(created.account.email).toBe("alice@example.test");
    expect(created.activity).not.toBe(input.activity);
    expect(() => createAccountDeviceModel({
      ...input,
      sync: { ...input.sync, pendingCommands: -1 },
    })).toThrow("Pending sync command count");
    expect(() => createAccountDeviceModel({
      ...input,
      storage: { ...input.storage, cacheBytes: 101 },
    })).toThrow("Device storage totals");
  });
});

describe("Android navigation", () => {
  it("shows only routes allowed by permissions and active modules", () => {
    const routes = resolveAndroidNavigation(ANDROID_MOBILE_ROUTES, {
      context: context(),
      activeModules: ["dawa"],
      hubAvailable: true,
    });
    const ids = routes.map((route) => route.id);

    expect(ids).toContain("pos");
    expect(ids).toContain("inventory");
    expect(ids).toContain("pharmacy");
    expect(ids).not.toContain("banking");
    expect(ids).not.toContain("retail");
  });

  it("hard-excludes business Settings even if a caller supplies a full Android capability", () => {
    const settingsRoute: MobileRouteDefinition = {
      id: "settings",
      label: "Settings",
      path: "/Settings/business?tab=license",
      section: "account",
      capability: {
        desktop: true,
        android: "full",
        web: "hidden",
        requiresHub: false,
        permissions: [],
      },
    };

    expect(resolveAndroidNavigation([settingsRoute], {
      context: context(),
      activeModules: ["dawa"],
      hubAvailable: true,
    })).toEqual([]);
  });

  it("rejects duplicate route ids", () => {
    expect(() => resolveAndroidNavigation([
      ANDROID_MOBILE_ROUTES[0],
      { ...ANDROID_MOBILE_ROUTES[0], path: "/mobile/duplicate" },
    ], {
      context: context(),
      activeModules: ["core"],
      hubAvailable: true,
    })).toThrow("Duplicate Android route id");
  });

  it("downgrades every operation to read access in all-branch analytics context", () => {
    const routes = resolveAndroidNavigation(ANDROID_MOBILE_ROUTES, {
      context: context({ kind: "all-branches" }),
      activeModules: ["dawa"],
      hubAvailable: true,
    });

    expect(routes.length).toBeGreaterThan(0);
    expect(routes.every((route) => route.access === "read")).toBe(true);
  });
});
