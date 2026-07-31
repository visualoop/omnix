import {
  WEB_REPORT_DEFINITIONS,
  type AuthorizedProjectionRequest,
  type BoundedListQuery,
  type BranchScope,
  type ReadonlyWebSession,
  type ReadProjectionId,
  type ReportId,
  type WebPermission,
} from "@/web/contracts";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;
const MAX_SEARCH_LENGTH = 80;
const MAX_CURSOR_LENGTH = 160;
const MAX_SESSION_SECONDS = 8 * 60 * 60;
const MAX_ASSIGNED_BRANCHES = 100;
const SAFE_CURSOR = /^[A-Za-z0-9_-]+$/;
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;
const ALLOWED_PERMISSIONS = new Set<WebPermission>([
  "reports.view",
  "reports.zreport",
  "reports.pnl",
  "etims.view",
  "audit.view",
  "hr.payroll.view",
]);

interface ProjectionRule {
  readonly path: string;
  readonly scope: "branch" | "assigned-list" | "session" | "analytics";
  readonly permission?: WebPermission;
}

export const READ_PROJECTION_RULES = Object.freeze({
  "home.dashboard": { path: "/api/web/v1/home", scope: "analytics", permission: "reports.view" },
  "branches.list": { path: "/api/web/v1/branches", scope: "assigned-list", permission: "reports.view" },
  "reports.catalog": { path: "/api/web/v1/reports", scope: "analytics", permission: "reports.view" },
  "reports.rows": { path: "/api/web/v1/reports/rows", scope: "analytics", permission: "reports.view" },
  "alerts.list": { path: "/api/web/v1/alerts", scope: "branch", permission: "reports.view" },
  "sync.health": { path: "/api/web/v1/sync-health", scope: "branch", permission: "reports.view" },
  "drilldown.report-row": { path: "/api/web/v1/drill-down", scope: "analytics", permission: "reports.view" },
  "profile.session": { path: "/api/web/v1/profile", scope: "session" },
} satisfies Readonly<Record<ReadProjectionId, ProjectionRule>>);

export class WebPolicyError extends Error {
  readonly code: "BAD_QUERY" | "FORBIDDEN" | "SESSION_EXPIRED" | "NOT_FOUND";

  constructor(code: WebPolicyError["code"], message: string) {
    super(message);
    this.name = "WebPolicyError";
    this.code = code;
  }
}

function asRecord(input: unknown): Readonly<Record<string, unknown>> {
  if (input === undefined || input === null) return {};
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new WebPolicyError("BAD_QUERY", "Query must be an object.");
  }
  return input as Readonly<Record<string, unknown>>;
}

export function normalizeBoundedQuery(input: unknown): BoundedListQuery {
  const value = asRecord(input);
  const allowedKeys = new Set(["limit", "search", "cursor"]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new WebPolicyError("BAD_QUERY", `Unsupported query field: ${key}`);
    }
  }

  const rawLimit = value.limit ?? DEFAULT_LIMIT;
  if (typeof rawLimit !== "number" || !Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > MAX_LIMIT) {
    throw new WebPolicyError("BAD_QUERY", `Limit must be an integer between 1 and ${MAX_LIMIT}.`);
  }

  let search: string | undefined;
  if (value.search !== undefined) {
    if (typeof value.search !== "string") {
      throw new WebPolicyError("BAD_QUERY", "Search must be text.");
    }
    search = value.search.trim();
    if (search.length > MAX_SEARCH_LENGTH || /[\u0000-\u001f\u007f]/.test(search)) {
      throw new WebPolicyError("BAD_QUERY", `Search must be at most ${MAX_SEARCH_LENGTH} safe characters.`);
    }
    if (search.length === 0) search = undefined;
  }

  let cursor: string | undefined;
  if (value.cursor !== undefined) {
    if (
      typeof value.cursor !== "string" ||
      value.cursor.length < 1 ||
      value.cursor.length > MAX_CURSOR_LENGTH ||
      !SAFE_CURSOR.test(value.cursor)
    ) {
      throw new WebPolicyError("BAD_QUERY", "Cursor is not a valid opaque cursor.");
    }
    cursor = value.cursor;
  }

  return Object.freeze({ limit: rawLimit, ...(search ? { search } : {}), ...(cursor ? { cursor } : {}) });
}

export function assertActiveReadonlySession(session: ReadonlyWebSession, now = new Date()): void {
  if (session.readonly !== true) {
    throw new WebPolicyError("FORBIDDEN", "Browser sessions must carry a read-only claim.");
  }
  const expiresAt = Date.parse(session.expiresAt);
  const issuedAt = Date.parse(session.issuedAt);
  const nowMs = now.getTime();
  if (
    !Number.isFinite(expiresAt) ||
    !Number.isFinite(issuedAt) ||
    issuedAt > nowMs ||
    expiresAt <= issuedAt ||
    expiresAt - issuedAt > MAX_SESSION_SECONDS * 1_000
  ) {
    throw new WebPolicyError("FORBIDDEN", "Session timestamps are invalid.");
  }
  if (expiresAt <= nowMs) {
    throw new WebPolicyError("SESSION_EXPIRED", "The browser session has expired.");
  }
  if (!SAFE_IDENTIFIER.test(session.sessionId) || !SAFE_IDENTIFIER.test(session.userId)) {
    throw new WebPolicyError("FORBIDDEN", "Session identity claims are invalid.");
  }
  const branchIds = new Set(session.assignedBranchIds);
  if (
    branchIds.size === 0 ||
    branchIds.size !== session.assignedBranchIds.length ||
    branchIds.size > MAX_ASSIGNED_BRANCHES ||
    session.assignedBranchIds.some((branchId) => !SAFE_IDENTIFIER.test(branchId))
  ) {
    throw new WebPolicyError("FORBIDDEN", "The user has no valid assigned branches.");
  }
  const permissions = new Set(session.permissions);
  if (
    permissions.size === 0 ||
    permissions.size !== session.permissions.length ||
    permissions.size > ALLOWED_PERMISSIONS.size ||
    session.permissions.some((permission) => !ALLOWED_PERMISSIONS.has(permission))
  ) {
    throw new WebPolicyError("FORBIDDEN", "Session report permissions are invalid.");
  }
}

function assertPermission(session: ReadonlyWebSession, permission: WebPermission | undefined): void {
  if (permission && !session.permissions.includes(permission)) {
    throw new WebPolicyError("FORBIDDEN", `Missing permission: ${permission}`);
  }
}

function assertSafeIdentifier(value: string, label: string): void {
  if (!SAFE_IDENTIFIER.test(value)) {
    throw new WebPolicyError("BAD_QUERY", `${label} is invalid.`);
  }
}

function authorizeScope(
  session: ReadonlyWebSession,
  projection: ReadProjectionId,
  requestedScope: BranchScope | null,
): BranchScope | null {
  const rule = READ_PROJECTION_RULES[projection];
  if (rule.scope === "session" || rule.scope === "assigned-list") {
    if (requestedScope !== null) {
      throw new WebPolicyError("BAD_QUERY", "This projection does not accept a branch scope.");
    }
    return null;
  }
  if (!requestedScope) {
    throw new WebPolicyError("BAD_QUERY", "A branch scope is required.");
  }
  if (requestedScope.kind === "all") {
    if (rule.scope !== "analytics") {
      throw new WebPolicyError("FORBIDDEN", "All branches is restricted to analytics projections.");
    }
    if (session.role !== "manager") {
      throw new WebPolicyError("FORBIDDEN", "Only managers can view all-branch analytics.");
    }
    return requestedScope;
  }
  assertSafeIdentifier(requestedScope.branchId, "Branch ID");
  if (!session.assignedBranchIds.includes(requestedScope.branchId)) {
    throw new WebPolicyError("FORBIDDEN", "The requested branch is not assigned to this user.");
  }
  return requestedScope;
}

function reportDefinition(reportId: ReportId) {
  const definition = WEB_REPORT_DEFINITIONS.find((report) => report.id === reportId);
  if (!definition) throw new WebPolicyError("NOT_FOUND", "Report projection is not allowlisted.");
  return definition;
}

export function visibleReports(session: ReadonlyWebSession, now = new Date()) {
  assertActiveReadonlySession(session, now);
  return WEB_REPORT_DEFINITIONS.filter((report) => session.permissions.includes(report.permission));
}

interface AuthorizeProjectionInput {
  readonly session: ReadonlyWebSession;
  readonly projection: ReadProjectionId;
  readonly scope: BranchScope | null;
  readonly query?: unknown;
  readonly reportId?: ReportId;
  readonly recordId?: string;
  readonly now?: Date;
}

export function authorizeProjection(input: AuthorizeProjectionInput): AuthorizedProjectionRequest {
  assertActiveReadonlySession(input.session, input.now);
  const rule = READ_PROJECTION_RULES[input.projection];
  assertPermission(input.session, "permission" in rule ? rule.permission : undefined);
  const scope = authorizeScope(input.session, input.projection, input.scope);
  const query = normalizeBoundedQuery(input.query);

  const acceptsReportId = input.projection === "reports.rows" || input.projection === "drilldown.report-row";
  if (acceptsReportId && !input.reportId) {
    throw new WebPolicyError("BAD_QUERY", "A report ID is required.");
  }
  if (!acceptsReportId && input.reportId) {
    throw new WebPolicyError("BAD_QUERY", "This projection does not accept a report ID.");
  }
  if (input.reportId) {
    const report = reportDefinition(input.reportId);
    assertPermission(input.session, report.permission);
  }
  if (input.projection === "drilldown.report-row") {
    if (!input.recordId) throw new WebPolicyError("BAD_QUERY", "A record ID is required.");
    assertSafeIdentifier(input.recordId, "Record ID");
  } else if (input.recordId) {
    throw new WebPolicyError("BAD_QUERY", "This projection does not accept a record ID.");
  }

  return Object.freeze({
    method: "GET",
    projection: input.projection,
    path: rule.path,
    scope,
    authorizedBranchIds: Object.freeze(
      scope?.kind === "branch" ? [scope.branchId] : [...input.session.assignedBranchIds],
    ),
    query,
    ...(input.reportId ? { reportId: input.reportId } : {}),
    ...(input.recordId ? { recordId: input.recordId } : {}),
    audit: {
      sessionId: input.session.sessionId,
      userId: input.session.userId,
      projection: input.projection,
      branchScope: scope?.kind === "branch" ? scope.branchId : scope?.kind ?? "session",
    },
  });
}
