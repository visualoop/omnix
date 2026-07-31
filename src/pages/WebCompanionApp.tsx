import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WebCompanionView } from "@/pages/web-companion";
import { createReadonlyWebApi, WebApiError, type ReadonlyWebApi } from "@/web/api";
import type {
  AlertProjection,
  BranchScope,
  BranchSummary,
  CursorPage,
  DrilldownProjection,
  HomeProjection,
  ProfileProjection,
  ReadonlyWebSession,
  ReportDefinition,
  ReportRowProjection,
  SyncHealthProjection,
  WebRuntimeState,
} from "@/web/contracts";
import { currentWebRoute, navigateWeb, normalizeScopeForRoute, readLastUpdated, runtimeForFailure, writeLastUpdated } from "@/web/runtime";
import type { WebRouteMatch } from "@/web/routes";

const EMPTY_PAGE = Object.freeze({ items: [], nextCursor: null, hasMore: false }) as CursorPage<never>;
const EMPTY_HOME: HomeProjection = { generatedAt: "—", scopeLabel: "Assigned branch", salesToday: "KES 0", transactionCount: 0, lowStockCount: 0, openAlertCount: 0, recentActivity: [] };
const EMPTY_SYNC: SyncHealthProjection = { branchId: "", branchName: "Assigned branch", state: "offline", lastSuccessfulSyncAt: null, pendingRecords: 0, hubReachable: false };
const EMPTY_DRILLDOWN: DrilldownProjection = { id: "", title: "Record unavailable", subtitle: "No record has been loaded.", branchName: "Assigned branch", fields: [], related: EMPTY_PAGE };
const EMPTY_PROFILE: ProfileProjection = { sessionId: "", userId: "", role: "viewer", readonly: true, displayName: "", roleLabel: "Viewer", assignedBranches: [], permissions: [], sessionIssuedAt: "", sessionExpiresAt: "", connectedHubName: "Branch hub", deviceLabel: "Browser" };

interface CompanionData {
  readonly home: HomeProjection;
  readonly branches: CursorPage<BranchSummary>;
  readonly reports: readonly ReportDefinition[];
  readonly reportRows: CursorPage<ReportRowProjection>;
  readonly alerts: CursorPage<AlertProjection>;
  readonly sync: SyncHealthProjection;
  readonly drilldown: DrilldownProjection;
  readonly profile: ProfileProjection;
}

const EMPTY_DATA: CompanionData = {
  home: EMPTY_HOME,
  branches: EMPTY_PAGE,
  reports: [],
  reportRows: EMPTY_PAGE,
  alerts: EMPTY_PAGE,
  sync: EMPTY_SYNC,
  drilldown: EMPTY_DRILLDOWN,
  profile: EMPTY_PROFILE,
};

function sessionFromProfile(profile: ProfileProjection): ReadonlyWebSession {
  return {
    sessionId: profile.sessionId,
    userId: profile.userId,
    displayName: profile.displayName,
    role: profile.role,
    readonly: true,
    assignedBranchIds: profile.assignedBranches.map((branch) => branch.id),
    permissions: profile.permissions,
    issuedAt: profile.sessionIssuedAt,
    expiresAt: profile.sessionExpiresAt,
  };
}

function selectedBranch(scope: BranchScope): string {
  if (scope.kind !== "branch") throw new WebApiError(400, "This view requires one assigned branch.");
  return scope.branchId;
}

export interface WebCompanionAppProps {
  readonly api?: ReadonlyWebApi;
  readonly initialRoute?: WebRouteMatch;
}

export function WebCompanionApp({ api = createReadonlyWebApi(), initialRoute }: WebCompanionAppProps) {
  const [route, setRoute] = useState<WebRouteMatch | null>(() => initialRoute ?? currentWebRoute());
  const [session, setSession] = useState<ReadonlyWebSession | null>(null);
  const [scope, setScope] = useState<BranchScope | null>(null);
  const [runtime, setRuntime] = useState<WebRuntimeState>({ kind: "loading" });
  const [data, setData] = useState<CompanionData>(EMPTY_DATA);
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [cursorHistory, setCursorHistory] = useState<readonly (string | undefined)[]>([]);
  const requestVersion = useRef(0);
  const lastUpdated = useRef(readLastUpdated());

  useEffect(() => {
    const updateRoute = () => {
      setRoute(currentWebRoute());
      setSearch("");
      setCursor(undefined);
      setCursorHistory([]);
    };
    window.addEventListener("popstate", updateRoute);
    return () => window.removeEventListener("popstate", updateRoute);
  }, []);

  const loadBootstrap = useCallback(async () => {
    const version = ++requestVersion.current;
    setRuntime({ kind: "loading" });
    try {
      const profile = await api.getProfile();
      const nextSession = sessionFromProfile(profile);
      const branches = await api.getBranches({ limit: 100 });
      if (version !== requestVersion.current) return;
      const nextScope = normalizeScopeForRoute(nextSession, route ?? { id: "home" }, scope);
      setSession(nextSession);
      setScope(nextScope);
      setData((current) => ({ ...current, profile, branches }));
      const updatedAt = new Date().toISOString();
      lastUpdated.current = updatedAt;
      writeLastUpdated(updatedAt);
      setRuntime({ kind: "connected", hubName: profile.connectedHubName, lastUpdatedAt: updatedAt });
    } catch (error) {
      if (version !== requestVersion.current) return;
      const nextRuntime = runtimeForFailure(error, data.profile.connectedHubName || "Branch hub", lastUpdated.current);
      if (nextRuntime.kind === "session-expired") {
        setSession(null);
        setData(EMPTY_DATA);
      }
      setRuntime(nextRuntime);
    }
  }, [api, data.profile.connectedHubName, route, scope]);

  useEffect(() => { void loadBootstrap(); }, []); // bootstrap exactly once; retries are explicit

  const effectiveScope = useMemo(() => {
    if (!session || !route) return null;
    return normalizeScopeForRoute(session, route, scope);
  }, [route, scope, session]);

  const loadRoute = useCallback(async () => {
    if (!route || !session || !effectiveScope || runtime.kind !== "connected") return;
    const version = ++requestVersion.current;
    try {
      let patch: Partial<CompanionData> = {};
      const query = { limit: 25, ...(search.trim() ? { search: search.trim() } : {}), ...(cursor ? { cursor } : {}) };
      if (route.id === "home") patch = { home: await api.getHome(effectiveScope) };
      else if (route.id === "branches") patch = { branches: await api.getBranches(query) };
      else if (route.id === "reports") patch = { reports: await api.getReports(effectiveScope) };
      else if (route.id === "report") patch = { reportRows: await api.getReportRows(route.reportId, effectiveScope, query) };
      else if (route.id === "alerts") {
        const branchId = selectedBranch(effectiveScope);
        const [alerts, sync] = await Promise.all([api.getAlerts(branchId, query), api.getSyncHealth(branchId)]);
        patch = { alerts, sync };
      } else if (route.id === "drilldown") patch = { drilldown: await api.getDrilldown(route.reportId, route.recordId, effectiveScope, query) };
      else if (route.id === "profile") patch = { profile: await api.getProfile() };
      if (version !== requestVersion.current) return;
      setData((current) => ({ ...current, ...patch }));
      const updatedAt = new Date().toISOString();
      lastUpdated.current = updatedAt;
      writeLastUpdated(updatedAt);
      setRuntime({ kind: "connected", hubName: data.profile.connectedHubName || "Branch hub", lastUpdatedAt: updatedAt });
    } catch (error) {
      if (version !== requestVersion.current) return;
      const nextRuntime = runtimeForFailure(error, data.profile.connectedHubName || "Branch hub", lastUpdated.current);
      if (nextRuntime.kind === "session-expired") {
        setSession(null);
        setData(EMPTY_DATA);
      }
      setRuntime(nextRuntime);
    }
  }, [api, cursor, data.profile.connectedHubName, effectiveScope, route, runtime.kind, search, session]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRoute(); }, search ? 180 : 0);
    return () => window.clearTimeout(timer);
  }, [loadRoute, search]);

  useEffect(() => {
    const online = () => { void loadBootstrap(); };
    const offline = () => setRuntime({ kind: "offline", lastUpdatedAt: lastUpdated.current });
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [loadBootstrap]);

  if (!route) {
    return <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground"><section className="max-w-md border-y border-border py-10 text-center"><h1 className="text-xl font-semibold">Page not available</h1><p className="mt-2 text-sm text-muted-foreground">This browser companion exposes reporting routes only.</p><a className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 underline-offset-4 hover:underline dark:text-blue-400" href="/web">Open reporting home</a></section></main>;
  }

  if (!session || !effectiveScope) {
    if (runtime.kind === "session-expired") {
      return (
        <div className="min-h-dvh bg-background text-foreground">
          <main className="px-4 py-12">
            <section className="mx-auto max-w-lg border-y border-border py-12 text-center" aria-labelledby="expired-session-title">
              <h1 id="expired-session-title" className="text-xl font-semibold">Business data hidden</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This read-only session has expired. Cached business data and account details were removed from view.
              </p>
              <p className="mt-3 text-sm font-medium">
                Ask a desktop administrator to issue a new read-only browser session.
              </p>
            </section>
          </main>
        </div>
      );
    }
    return <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground" aria-busy="true"><p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Connecting to branch hub…</p></main>;
  }

  const page = route.id === "branches" ? data.branches : route.id === "report" ? data.reportRows : route.id === "alerts" ? data.alerts : route.id === "drilldown" ? data.drilldown.related : EMPTY_PAGE;
  return (
    <WebCompanionView
      session={session}
      runtime={runtime}
      route={route}
      scope={effectiveScope}
      branchOptions={data.branches.items.map(({ id, code, name }) => ({ id, code, name }))}
      home={data.home}
      branches={data.branches}
      reports={data.reports}
      reportRows={data.reportRows}
      alerts={data.alerts}
      sync={data.sync}
      drilldown={data.drilldown}
      profile={data.profile}
      search={search}
      hasPreviousPage={cursorHistory.length > 0}
      onNavigate={(path) => { navigateWeb(path); }}
      onScopeChange={(nextScope) => { setScope(normalizeScopeForRoute(session, route, nextScope)); setCursor(undefined); setCursorHistory([]); }}
      onSearchChange={(value) => { setSearch(value.slice(0, 80)); setCursor(undefined); setCursorHistory([]); }}
      onPreviousPage={() => {
        const previous = cursorHistory[cursorHistory.length - 1];
        setCursor(previous);
        setCursorHistory((history) => history.slice(0, -1));
      }}
      onNextPage={() => {
        if (!page.nextCursor) return;
        setCursorHistory((history) => [...history, cursor]);
        setCursor(page.nextCursor);
      }}
      onRetry={() => { void loadBootstrap(); }}
    />
  );
}
