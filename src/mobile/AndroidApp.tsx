import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog";
import { LoginPage } from "@/pages/login";
import { SetupWizard } from "@/pages/setup";
import { POSSalePage } from "@/pages/pos-sale";
import { MobileHome } from "@/components/mobile/MobileHome";
import { MobileProfile } from "@/components/mobile/MobileProfile";
import { MobileShell } from "@/components/mobile/MobileShell";
import { createMobileHomeModel } from "@/mobile/models/home";
import { createAccountDeviceModel, type AccountDeviceModel } from "@/mobile/models/account-device";
import { createMobileProfileModel, type MobileProfileAction } from "@/mobile/models/profile";
import { ANDROID_MOBILE_ROUTES, resolveAndroidNavigation } from "@/mobile/navigation";
import { createMobileShellModel } from "@/mobile/shell";
import { registerMobileLifecycle } from "@/mobile/lifecycle";
import { createAndroidPlatformAdapters } from "@/platform/android-adapters";
import { createOperationalContext, type LaunchCountry } from "@/platform/operational-context";
import type { RuntimeCapabilities } from "@/platform/runtime";
import { getPermissionsForRole } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useActiveBranch } from "@/stores/active-branch";
import { useActiveModule } from "@/stores/active-module";
import { useCountry } from "@/stores/country";

import { readAndroidInventory, type AndroidInventoryItem } from "@/lib/command-api";
const ANDROID_ROOT_ROUTE_IDS = new Set(["home", "pos", "profile"]);
const ANDROID_ROOT_ROUTES = ANDROID_MOBILE_ROUTES.filter((route) =>
  ANDROID_ROOT_ROUTE_IDS.has(route.id),
);

interface AndroidAppProps {
  readonly runtime: RuntimeCapabilities;
}

function LoadingState({ label = "Opening local workspace…" }: { readonly label?: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground" aria-busy="true">
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
    </main>
  );
}

function ErrorState({ message }: { readonly message: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
      <section className="max-w-md border-y border-border py-10 text-center">
        <h1 className="text-lg font-semibold">Local workspace unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
      </section>
    </main>
  );
}

function asLaunchCountry(value: string | null): LaunchCountry {
  return value === "UG" || value === "TZ" || value === "RW" ? value : "KE";
}

export function AndroidApp({ runtime }: AndroidAppProps) {
  return (
    <BrowserRouter>
      <AndroidBoot runtime={runtime} />
    </BrowserRouter>
  );
}

function AndroidBoot({ runtime }: AndroidAppProps) {
  const { user, isSetupComplete, setupChecked, refreshSetupState } = useAuthStore();
  const loadBranches = useActiveBranch((state) => state.loadForUser);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("@/lib/db")
      .then(({ initDb }) => initDb())
      .then(async () => {
        await refreshSetupState();
        await Promise.all([
          useCountry.getState().load(),
          useActiveModule.getState().load(),
        ]);
        const currentUser = useAuthStore.getState().user;
        if (currentUser) await loadBranches(currentUser.id);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setBootError(error instanceof Error ? error.message : "The local database could not be opened.");
        }
      });
    return () => { cancelled = true; };
  }, [loadBranches, refreshSetupState]);

  if (bootError) return <ErrorState message={bootError} />;
  if (!setupChecked) return <LoadingState />;

  if (!isSetupComplete) {
    return (
      <>
        <SetupWizard />
        <Toaster position="bottom-center" />
        <ConfirmDialogHost />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <LoginPage />
        <Toaster position="bottom-center" />
      </>
    );
  }

  return (
    <>
      <AndroidAuthenticatedApp runtime={runtime} />
      <Toaster position="bottom-center" />
      <ConfirmDialogHost />
    </>
  );
}

function AndroidAuthenticatedApp({ runtime }: AndroidAppProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const storedPermissions = useAuthStore((state) => state.permissions);
  const signOut = useAuthStore((state) => state.signOut);
  const activeBranch = useActiveBranch((state) => state.active);
  const availableBranches = useActiveBranch((state) => state.available);
  const branchesLoaded = useActiveBranch((state) => state.loaded);
  const branchScope = useActiveBranch((state) => state.scope);
  const switchBranch = useActiveBranch((state) => state.switchTo);
  const activeModule = useActiveModule((state) => state.active);
  const countryCode = useCountry((state) => state.code);
  const adapters = useMemo(() => createAndroidPlatformAdapters(), []);
  const [accountDevice, setAccountDevice] = useState<AccountDeviceModel | null>(null);
  const [typedInventory, setTypedInventory] = useState<AndroidInventoryItem[]>([]);
  const [nativeError, setNativeError] = useState<string | null>(null);
  const historyIndex = useRef(0);
  historyIndex.current = typeof window.history.state?.idx === "number"
    ? window.history.state.idx
    : 0;

  const context = useMemo(() => {
    if (!user || availableBranches.length === 0) return null;
    const assignedBranches = availableBranches.map((branch, index) => ({
      id: branch.id,
      code: branch.code,
      name: branch.name,
      isPrimary: index === 0,
    }));
    return createOperationalContext({
      userId: user.id,
      permissions: storedPermissions ?? getPermissionsForRole(user.role),
      assignedBranches,
      scope: branchScope === "all"
        ? { kind: "all-branches" }
        : { kind: "branch", branchId: activeBranch?.id ?? assignedBranches[0].id },
      country: asLaunchCountry(countryCode),
    });
  }, [activeBranch?.id, availableBranches, branchScope, countryCode, storedPermissions, user]);

  const routes = useMemo(() => context
    ? resolveAndroidNavigation(ANDROID_ROOT_ROUTES, {
        context,
        activeModules: ["core", activeModule],
        hubAvailable: true,
      })
    : [], [activeModule, context]);

  useEffect(() => {
    let cancelled = false;
    let cleanup: () => void = () => {};
    registerMobileLifecycle(adapters.lifecycle, {
      canNavigateBack: () => historyIndex.current > 0,
      navigateBack: () => navigate(-1),
    }).then((registration) => {
      if (cancelled) registration.dispose();
      else cleanup = () => registration.dispose();
    }).catch((error: unknown) => {
      if (!cancelled) setNativeError(error instanceof Error ? error.message : "Android lifecycle integration is unavailable.");
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [adapters, navigate]);

  useEffect(() => {
    if (!user || !context) return;
    let cancelled = false;
    const unavailable = (reason: string) => ({ state: "unavailable" as const, reason });

    void (async () => {
      try {
        const [secureStorage, biometrics, biometricPermission, notificationPermission, mesh, storage] = await Promise.all([
          adapters.secureStorage.availability().catch(() => unavailable("Android Keystore is unavailable")),
          adapters.biometrics.availability().catch(() => ({ status: unavailable("Biometrics are unavailable"), kinds: [], enrolled: false })),
          adapters.biometrics.permission().catch(() => "unavailable" as const),
          adapters.notifications.permission().catch(() => "unavailable" as const),
          adapters.mesh.status().catch(() => ({ state: "disabled" as const, nodeId: null, hubName: null, lastHandshakeAt: null })),
          navigator.storage?.estimate().catch(() => ({ usage: 0, quota: 0 })) ?? Promise.resolve({ usage: 0, quota: 0 }),
        ]);

        let deviceId = `android-${user.id}`;
        if (secureStorage.state === "available") {
          const key = { namespace: "device" as const, accountId: user.id, name: "device-id" };
          const stored = await adapters.secureStorage.get(key).catch(() => null);
          if (stored) deviceId = stored;
          else {
            deviceId = crypto.randomUUID();
            await adapters.secureStorage.set(key, deviceId);
          }
        }

        const usedBytes = Math.max(0, Math.floor(storage.usage ?? 0));
        const totalBytes = Math.max(usedBytes, Math.floor(storage.quota ?? 0), 1);
        const model = createAccountDeviceModel({
          account: {
            userId: user.id,
            username: user.username,
            fullName: user.full_name,
            email: null,
            phone: null,
            role: user.role,
          },
          device: {
            deviceId,
            deviceName: "Omnix Android device",
            platform: "android",
            osVersion: navigator.userAgent.match(/Android\s+([^;)]+)/i)?.[1] ?? "Android",
            appVersion: __APP_VERSION__,
          },
          security: {
            secureStorage,
            biometricStatus: biometrics.status,
            biometricPermission,
            biometricKinds: biometrics.kinds,
            biometricEnrolled: biometrics.enrolled,
            notificationPermission,
          },
          sync: {
            state: navigator.onLine ? "synced" : "offline",
            pendingCommands: 0,
            lastSuccessfulAt: null,
            hubName: activeBranch?.name ?? null,
          },
          mesh,
          storage: {
            usedBytes,
            totalBytes,
            cacheBytes: 0,
            lastCalculatedAt: new Date().toISOString(),
          },
          activity: [],
        });
        if (!cancelled) setAccountDevice(model);
      } catch (error) {
        if (!cancelled) setNativeError(error instanceof Error ? error.message : "Android native adapters returned invalid data.");
      }
    })();

    return () => { cancelled = true; };
  }, [activeBranch?.name, adapters, context, user]);

  useEffect(() => {
    if (!activeBranch?.id || !context) {
      setTypedInventory([]);
      return;
    }
    let cancelled = false;
    readAndroidInventory(activeBranch.id)
      .then((items) => { if (!cancelled) setTypedInventory(items); })
      .catch(() => { if (!cancelled) setTypedInventory([]); });
    return () => { cancelled = true; };
  }, [activeBranch?.id, context]);

  if (!branchesLoaded) return <LoadingState label="Loading assigned branches…" />;
  if (!user) return null;
  if (!context) {
    return <ErrorState message="No branch is assigned to this account. Ask a desktop administrator to assign one, then sign in again." />;
  }

  const shellModel = createMobileShellModel({
    formFactor: runtime.formFactor === "desktop" ? "tablet" : runtime.formFactor,
    activePath: location.pathname,
    context,
    routes,
  });
  const homeModel = accountDevice ? createMobileHomeModel({
    context,
    accountDevice,
    routes,
    kpis: activeBranch ? [{
      id: "typed-inventory",
      label: "Branch items",
      value: String(typedInventory.length),
      detail: "Available in the current branch",
      branchId: activeBranch.id,
      requiredPermissions: ["inventory.view"],
    }] : [],
  }) : null;
  const profileModel = accountDevice ? createMobileProfileModel({
    context,
    accountDevice,
    activeModules: ["core", activeModule],
  }) : null;
  const posEnabled = routes.some((route) => route.id === "pos" && route.access === "full");

  const handleProfileAction = async (action: MobileProfileAction) => {
    if (action === "request-biometric") {
      const state = await adapters.biometrics.requestPermission();
      toast.info(state === "granted" ? "Biometric access is ready" : "Biometric access was not enabled");
      return;
    }
    if (action === "request-notifications") {
      const state = await adapters.notifications.requestPermission();
      toast.info(state === "granted" ? "Notifications are allowed" : "Notifications remain unavailable");
      return;
    }
    if (action === "clear-cache" && "caches" in window) {
      const names = await window.caches.keys();
      await Promise.all(names.map((name) => window.caches.delete(name)));
      toast.success("Local web cache cleared");
      return;
    }
    toast.info("Complete this protected account action from the desktop administrator console.");
  };

  const handleSignOut = async () => {
    await Promise.allSettled([
      adapters.mesh.stop(),
      adapters.scanner.cancel(),
      adapters.secureStorage.remove({ namespace: "session", accountId: user.id, name: "auth-session" }),
    ]);
    signOut();
    navigate("/mobile", { replace: true });
  };

  if (location.pathname === "/pos/sale") {
    if (!posEnabled) return <Navigate to="/mobile" replace />;
    return <POSSalePage formFactor={runtime.formFactor === "desktop" ? "tablet" : runtime.formFactor} />;
  }

  return (
    <MobileShell model={shellModel} onNavigate={(path) => navigate(path)}>
      {nativeError ? (
        <p role="alert" className="mb-4 border-y border-destructive/30 py-3 text-sm text-destructive">
          Native device features are unavailable: {nativeError}
        </p>
      ) : null}
      <Routes>
        <Route path="/mobile" element={homeModel ? <MobileHome model={homeModel} onNavigate={(path) => navigate(path)} /> : <LoadingState label="Loading branch summary…" />} />
        <Route path="/mobile/profile" element={profileModel ? (
          <MobileProfile
            model={profileModel}
            onSelectBranch={(branchId) => {
              const branch = availableBranches.find((candidate) => candidate.id === branchId);
              if (branch) void switchBranch(branch);
            }}
            onAction={(action) => { void handleProfileAction(action); }}
            onSignOut={() => { void handleSignOut(); }}
          />
        ) : <LoadingState label="Loading account profile…" />} />
        <Route path="*" element={<Navigate to="/mobile" replace />} />
      </Routes>
    </MobileShell>
  );
}
