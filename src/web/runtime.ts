import type { BranchScope, ReadonlyWebSession, WebRuntimeState } from "@/web/contracts";
import { resolveWebRoute, routeDefinitionFor, type WebRouteMatch } from "@/web/routes";

export const WEB_SNAPSHOT_STORAGE_KEY = "omnix:web:last-updated";

export function currentWebRoute(location: Pick<Location, "pathname" | "search" | "hash"> = window.location): WebRouteMatch | null {
  if (location.search || location.hash) return null;
  return resolveWebRoute(location.pathname);
}

export function navigateWeb(path: string, replace = false): WebRouteMatch | null {
  const route = resolveWebRoute(path);
  if (!route) return null;
  if (replace) window.history.replaceState(null, "", path);
  else window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  return route;
}

export function normalizeScopeForRoute(
  session: ReadonlyWebSession,
  route: WebRouteMatch,
  scope: BranchScope | null,
): BranchScope {
  const definition = routeDefinitionFor(route);
  if (scope?.kind === "branch" && session.assignedBranchIds.includes(scope.branchId)) return scope;
  if (scope?.kind === "all" && session.role === "manager" && definition.allBranches === "analytics") return scope;
  const branchId = session.assignedBranchIds[0];
  if (!branchId) throw new Error("The browser session has no assigned branch.");
  return { kind: "branch", branchId };
}

export function runtimeForFailure(
  error: unknown,
  hubName: string,
  lastUpdatedAt: string | null,
  online = typeof navigator === "undefined" ? true : navigator.onLine,
): WebRuntimeState {
  const status = typeof error === "object" && error !== null && "status" in error
    ? Number((error as { readonly status: unknown }).status)
    : 0;
  if (status === 401) return { kind: "session-expired", expiredAt: new Date().toISOString() };
  if (status === 403) return { kind: "forbidden" };
  if (!online) return { kind: "offline", lastUpdatedAt };
  return { kind: "lan-unreachable", hubName, lastUpdatedAt };
}

export function readLastUpdated(storage: Pick<Storage, "getItem"> | null = typeof sessionStorage === "undefined" ? null : sessionStorage): string | null {
  try {
    return storage?.getItem(WEB_SNAPSHOT_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeLastUpdated(value: string, storage: Pick<Storage, "setItem"> | null = typeof sessionStorage === "undefined" ? null : sessionStorage): void {
  try {
    storage?.setItem(WEB_SNAPSHOT_STORAGE_KEY, value);
  } catch {
    // Storage is optional. Never block a live LAN projection if it is unavailable.
  }
}

export function registerWebServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/web-service-worker.js", { scope: "/web/" }).catch(() => {
      // The LAN app remains fully usable online when PWA registration is unsupported.
    });
  }, { once: true });
}
