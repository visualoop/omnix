import type {
  AlertProjection,
  BoundedListQuery,
  BranchScope,
  BranchSummary,
  CursorPage,
  DrilldownProjection,
  HomeProjection,
  ProfileProjection,
  ReportDefinition,
  ReportId,
  ReportRowProjection,
  SyncHealthProjection,
} from "@/web/contracts";
import { normalizeBoundedQuery } from "@/web/policy";

export interface ReadonlyWebApi {
  readonly getHome: (scope: BranchScope) => Promise<HomeProjection>;
  readonly getBranches: (query?: Partial<BoundedListQuery>) => Promise<CursorPage<BranchSummary>>;
  readonly getReports: (scope: BranchScope) => Promise<readonly ReportDefinition[]>;
  readonly getReportRows: (reportId: ReportId, scope: BranchScope, query?: Partial<BoundedListQuery>) => Promise<CursorPage<ReportRowProjection>>;
  readonly getAlerts: (branchId: string, query?: Partial<BoundedListQuery>) => Promise<CursorPage<AlertProjection>>;
  readonly getSyncHealth: (branchId: string) => Promise<SyncHealthProjection>;
  readonly getDrilldown: (reportId: ReportId, recordId: string, scope: BranchScope, query?: Partial<BoundedListQuery>) => Promise<DrilldownProjection>;
  readonly getProfile: () => Promise<ProfileProjection>;
}

export class WebApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "WebApiError";
    this.status = status;
  }
}

const MAX_RESPONSE_BYTES = 256 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function scopeParams(scope: BranchScope): URLSearchParams {
  return scope.kind === "all"
    ? new URLSearchParams({ scope: "all" })
    : new URLSearchParams({ scope: "branch", branchId: scope.branchId });
}

function addBoundedQuery(params: URLSearchParams, input?: Partial<BoundedListQuery>): void {
  const query = normalizeBoundedQuery(input);
  params.set("limit", String(query.limit));
  if (query.search) params.set("search", query.search);
  if (query.cursor) params.set("cursor", query.cursor);
}

function safeSegment(value: string, label: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(value)) {
    throw new WebApiError(400, `${label} is invalid.`);
  }
  // URLSearchParams owns encoding. Returning an already encoded segment would
  // turn IDs such as `sale:01` into `sale%253A01` on the wire.
  return value;
}

export async function redeemBrowserAuthorization(
  code: string,
  fetchImplementation: FetchImplementation = fetch,
): Promise<void> {
  const normalized = code.trim();
  if (!/^[A-Fa-f0-9 -]{32,48}$/.test(normalized)) {
    throw new WebApiError(400, "Enter the complete authorization code from the desktop administrator.");
  }
  const response = await fetchImplementation(`/api/web/v1/session?${new URLSearchParams({ code: normalized })}`, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
    redirect: "error",
  });
  if (!response.ok) {
    throw new WebApiError(response.status, response.status === 401
      ? "This code has expired or was already used. Ask the administrator for a new one."
      : "Browser access could not be authorized.");
  }
}

export function createReadonlyWebApi(fetchImplementation: FetchImplementation = fetch): ReadonlyWebApi {
  async function getJson<T>(path: string, params?: URLSearchParams): Promise<T> {
    const url = params && params.size > 0 ? `${path}?${params.toString()}` : path;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetchImplementation(url, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) throw new WebApiError(408, "The branch hub did not respond in time.");
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
    if (!response.ok) {
      throw new WebApiError(response.status, response.status === 401 ? "Session expired." : "Read request failed.");
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new WebApiError(502, "The branch hub returned an unexpected response.");
    }
    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_RESPONSE_BYTES) throw new WebApiError(502, "The branch hub response exceeded the safe limit.");
    const body = await response.text();
    if (new TextEncoder().encode(body).byteLength > MAX_RESPONSE_BYTES) {
      throw new WebApiError(502, "The branch hub response exceeded the safe limit.");
    }
    try {
      return JSON.parse(body) as T;
    } catch {
      throw new WebApiError(502, "The branch hub returned invalid JSON.");
    }
  }

  return Object.freeze({
    getHome: (scope: BranchScope) => getJson<HomeProjection>("/api/web/v1/home", scopeParams(scope)),
    getBranches: (query?: Partial<BoundedListQuery>) => {
      const params = new URLSearchParams();
      addBoundedQuery(params, query);
      return getJson<CursorPage<BranchSummary>>("/api/web/v1/branches", params);
    },
    getReports: (scope: BranchScope) => getJson<readonly ReportDefinition[]>("/api/web/v1/reports", scopeParams(scope)),
    getReportRows: (reportId: ReportId, scope: BranchScope, query?: Partial<BoundedListQuery>) => {
      const params = scopeParams(scope);
      params.set("reportId", safeSegment(reportId, "Report ID"));
      addBoundedQuery(params, query);
      return getJson<CursorPage<ReportRowProjection>>("/api/web/v1/reports/rows", params);
    },
    getAlerts: (branchId: string, query?: Partial<BoundedListQuery>) => {
      const params = new URLSearchParams({ branchId: safeSegment(branchId, "Branch ID") });
      addBoundedQuery(params, query);
      return getJson<CursorPage<AlertProjection>>("/api/web/v1/alerts", params);
    },
    getSyncHealth: (branchId: string) => getJson<SyncHealthProjection>("/api/web/v1/sync-health", new URLSearchParams({ branchId: safeSegment(branchId, "Branch ID") })),
    getDrilldown: (reportId: ReportId, recordId: string, scope: BranchScope, query?: Partial<BoundedListQuery>) => {
      const params = scopeParams(scope);
      params.set("reportId", safeSegment(reportId, "Report ID"));
      params.set("recordId", safeSegment(recordId, "Record ID"));
      addBoundedQuery(params, query);
      return getJson<DrilldownProjection>("/api/web/v1/drill-down", params);
    },
    getProfile: () => getJson<ProfileProjection>("/api/web/v1/profile"),
  });
}
