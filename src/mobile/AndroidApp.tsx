import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog";
import { POSSalePage } from "@/pages/pos-sale";
import { AndroidFirstRun, AndroidHubLogin } from "@/mobile/AndroidFirstRun";
import {
  clearAndroidHubSession,
  diagnosticFor,
  forgetAndroidHub,
  loadAndroidHub,
  selectAndroidHubBranch,
  setActiveAndroidHub,
  toBranch,
  type AndroidFirstRunDiagnostic,
  type AndroidHubConfig,
} from "@/mobile/android-hub";
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
import type { AdapterAvailability } from "@/platform/adapters";
import type { RuntimeCapabilities } from "@/platform/runtime";
import { getPermissionsForRole } from "@/lib/permissions";
import { getCountry } from "@/lib/countries";
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

function ErrorState({ message, actionLabel, onAction }: {
  readonly message: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
      <section className="max-w-md border-y border-border py-10 text-center">
        <h1 className="text-lg font-semibold">Branch access unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
        {actionLabel && onAction ? (
          <button type="button" onClick={onAction} className="mt-5 text-sm font-medium text-primary underline-offset-4 hover:underline">
            {actionLabel}
          </button>
        ) : null}
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

function hydrateAndroidContext(config: AndroidHubConfig): void {
  const session = config.session;
  if (!session) return;
  const assigned = config.branches
    .filter((branch) => session.assignedBranchIds.includes(branch.id))
    .map(toBranch);
  const active = assigned.find((branch) => branch.id === session.activeBranchId) ?? assigned[0] ?? null;
  const countryProfile = getCountry(config.countryCode) ?? getCountry("KE");
  if (!countryProfile) throw new Error("Android country profile is unavailable");
  const entitledModule = session.enabledModules.includes(config.activeModule)
    ? config.activeModule
    : session.enabledModules.find((module) => module !== "core") as typeof config.activeModule | undefined;

  setActiveAndroidHub(config);
  useAuthStore.setState({
    user: session.user,
    permissions: [...session.permissions],
    isSetupComplete: true,
    setupChecked: true,
    loading: false,
  });
  useActiveBranch.setState((state) => ({
    ...state,
    active,
    available: assigned,
    loaded: true,
    scope: "branch",
    revision: state.revision + 1,
  }));
  useCountry.setState({
    code: countryProfile.code,
    currencyCode: countryProfile.currencyCode,
    loaded: true,
  });
  useActiveModule.setState({
    active: entitledModule ?? config.activeModule,
    loaded: true,
  });
}

function clearAndroidContext(): void {
  setActiveAndroidHub(null);
  useAuthStore.setState({ user: null, permissions: null, isSetupComplete: true, setupChecked: true, loading: false });
  useActiveBranch.getState().clear();
}

function AndroidBoot({ runtime }: AndroidAppProps) {
  const [config, setConfig] = useState<AndroidHubConfig | null | undefined>(undefined);
  const [bootDiagnostic, setBootDiagnostic] = useState<AndroidFirstRunDiagnostic | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAndroidHub()
      .then((saved) => {
        if (cancelled) return;
        if (saved?.session) hydrateAndroidContext(saved);
        setConfig(saved);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        clearAndroidContext();
        setBootDiagnostic(diagnosticFor(error));
        setConfig(null);
      });
    return () => { cancelled = true; };
  }, []);

  if (config === undefined) return <LoadingState label="Checking branch hub enrollment…" />;

  if (!config) {
    return (
      <AndroidFirstRun
        initialDiagnostic={bootDiagnostic}
        onPaired={(paired) => {
          setBootDiagnostic(null);
          setConfig(paired);
        }}
      />
    );
  }

  if (!config.session) {
    return (
      <AndroidHubLogin
        config={config}
        onAuthenticated={(authenticated) => {
          hydrateAndroidContext(authenticated);
          setConfig(authenticated);
        }}
        onChangeHub={() => {
          void forgetAndroidHub()
            .catch((error: unknown) => setBootDiagnostic(diagnosticFor(error)))
            .finally(() => {
              clearAndroidContext();
              setConfig(null);
            });
        }}
      />
    );
  }

  return (
    <>
      <AndroidAuthenticatedApp
        runtime={runtime}
        hubConfig={config}
        onHubConfigChange={setConfig}
      />
      <Toaster position="bottom-center" />
      <ConfirmDialogHost />
    </>
  );
}

interface AndroidAuthenticatedAppProps extends AndroidAppProps {
  readonly hubConfig: AndroidHubConfig;
  readonly onHubConfigChange: (config: AndroidHubConfig) => void;
}

function AndroidAuthenticatedApp({ runtime, hubConfig, onHubConfigChange }: AndroidAuthenticatedAppProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const storedPermissions = useAuthStore((state) => state.permissions);
  const activeBranch = useActiveBranch((state) => state.active);
  const availableBranches = useActiveBranch((state) => state.available);
  const branchesLoaded = useActiveBranch((state) => state.loaded);
  const branchScope = useActiveBranch((state) => state.scope);
  const activeModule = useActiveModule((state) => state.active);
  const countryCode = useCountry((state) => state.code);
  const adapters = useMemo(() => createAndroidPlatformAdapters(), []);
  const [accountDevice, setAccountDevice] = useState<AccountDeviceModel | null>(null);
  const [typedInventory, setTypedInventory] = useState<AndroidInventoryItem[]>([]);
  const [nativeError, setNativeError] = useState<string | null>(null);
  const [meshAvailability, setMeshAvailability] = useState<AdapterAvailability>({
    state: "unavailable",
    reason: "Checking Private Mesh availability…",
  });
  const [meshActionPending, setMeshActionPending] = useState(false);
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
        const [secureStorage, biometrics, biometricPermission, notificationPermission, currentMeshAvailability, mesh, storage] = await Promise.all([
          adapters.secureStorage.availability().catch(() => unavailable("Android Keystore is unavailable")),
          adapters.biometrics.availability().catch(() => ({ status: unavailable("Biometrics are unavailable"), kinds: [], enrolled: false })),
          adapters.biometrics.permission().catch(() => "unavailable" as const),
          adapters.notifications.permission().catch(() => "unavailable" as const),
          adapters.mesh.availability().catch(() => unavailable("Private Mesh is unavailable on this Android build")),
          adapters.mesh.status().catch(() => ({ state: "offline" as const, nodeId: null, hubName: null, lastHandshakeAt: null })),
          navigator.storage?.estimate().catch(() => ({ usage: 0, quota: 0 })) ?? Promise.resolve({ usage: 0, quota: 0 }),
        ]);
        if (!cancelled) setMeshAvailability(currentMeshAvailability);

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
    if (!user || !hubConfig.meshEnrollmentId) return;
    let cancelled = false;
    const refreshMesh = async () => {
      const [availability, status] = await Promise.all([
        adapters.mesh.availability().catch(() => ({ state: "unavailable" as const, reason: "Private Mesh is unavailable on this Android build" })),
        adapters.mesh.status().catch(() => ({ state: "offline" as const, nodeId: null, hubName: null, lastHandshakeAt: null })),
      ]);
      if (cancelled) return;
      setMeshAvailability(availability);
      setAccountDevice((current) => current ? createAccountDeviceModel({ ...current, mesh: status }) : current);
    };
    const onNetworkChange = () => { void refreshMesh(); };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshMesh();
    };
    window.addEventListener("online", onNetworkChange);
    window.addEventListener("offline", onNetworkChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const timer = window.setInterval(() => { void refreshMesh(); }, 5_000);
    void refreshMesh();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("online", onNetworkChange);
      window.removeEventListener("offline", onNetworkChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [adapters, hubConfig.meshEnrollmentId, user]);

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

  const handleSignOut = async () => {
    await Promise.allSettled([
      adapters.mesh.stop(),
      adapters.scanner.cancel(),
    ]);
    try {
      const paired = await clearAndroidHubSession(hubConfig);
      clearAndroidContext();
      onHubConfigChange(paired);
      navigate("/mobile", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The session could not be cleared securely");
    }
  };

  if (!branchesLoaded) return <LoadingState label="Loading assigned branches…" />;
  if (!user) return null;
  if (!context) {
    return (
      <ErrorState
        message="No active branch from this hub is assigned to your account. Ask a desktop administrator to update your branch access, then sign in again."
        actionLabel="Return to sign in"
        onAction={() => { void handleSignOut(); }}
      />
    );
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
    meshEnrollmentReady: hubConfig.meshEnrollmentId !== null,
  }) : null;
  const posEnabled = routes.some((route) => route.id === "pos" && route.access === "full");

  const handleProfileAction = async (action: MobileProfileAction) => {
    if (action === "connect-private-mesh" || action === "disconnect-private-mesh") {
      if (!activeBranch) {
        toast.error("Choose an assigned branch before connecting Private Mesh");
        return;
      }
      if (action === "connect-private-mesh" && !hubConfig.meshEnrollmentId) {
        toast.error("This device still needs Private Mesh approval from the branch hub");
        return;
      }
      setMeshActionPending(true);
      if (action === "connect-private-mesh") {
        setAccountDevice((current) => current ? createAccountDeviceModel({
          ...current,
          mesh: { ...current.mesh, state: "starting" },
        }) : current);
      }
      try {
        const mesh = action === "connect-private-mesh"
          ? await adapters.mesh.start({
              accountId: user.id,
              branchId: activeBranch.id,
              enrollmentId: hubConfig.meshEnrollmentId!,
            })
          : (await adapters.mesh.stop(), {
              state: "disabled" as const,
              nodeId: null,
              hubName: null,
              lastHandshakeAt: null,
            });
        const availability = await adapters.mesh.availability().catch(() => ({
          state: "unavailable" as const,
          reason: "Private Mesh is unavailable on this Android build",
        }));
        setMeshAvailability(availability);
        setAccountDevice((current) => current ? createAccountDeviceModel({ ...current, mesh }) : current);
        if (action === "disconnect-private-mesh") toast.success("Private Mesh disconnected");
        else if (mesh.state === "permission-denied") toast.info("Allow the Android VPN prompt to connect Private Mesh");
        else if (mesh.state === "connected") toast.success("Private Mesh connected");
        else toast.info("Private Mesh is connecting to the branch hub");
      } catch (error) {
        setAccountDevice((current) => current ? createAccountDeviceModel({
          ...current,
          mesh: { ...current.mesh, state: "offline" },
        }) : current);
        toast.error(error instanceof Error ? error.message : "Private Mesh could not reach the branch hub");
      } finally {
        setMeshActionPending(false);
      }
      return;
    }
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
              void selectAndroidHubBranch(hubConfig, branchId)
                .then((next) => {
                  hydrateAndroidContext(next);
                  onHubConfigChange(next);
                })
                .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Branch could not be changed"));
            }}
            onAction={(action) => { void handleProfileAction(action); }}
            onSignOut={() => { void handleSignOut(); }}
            meshAvailability={meshAvailability}
            meshActionPending={meshActionPending}
          />
        ) : <LoadingState label="Loading account profile…" />} />
        <Route path="*" element={<Navigate to="/mobile" replace />} />
      </Routes>
    </MobileShell>
  );
}
