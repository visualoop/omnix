import { describe, expect, it, vi } from "vitest";
import { createReadonlyWebApi } from "@/web/api";
import {
  WEB_REPORT_DEFINITIONS,
  WEB_ROUTE_DEFINITIONS,
  type ReadonlyWebSession,
} from "@/web/contracts";
import {
  READ_PROJECTION_RULES,
  WebPolicyError,
  assertActiveReadonlySession,
  authorizeProjection,
  normalizeBoundedQuery,
  visibleReports,
} from "@/web/policy";
import { resolveWebRoute } from "@/web/routes";

const now = new Date("2026-07-31T11:34:06.290Z");
const sessionIssuedAt = "2026-07-31T10:00:00.000Z";
const sessionExpiresAt = "2026-07-31T18:00:00.000Z";

const manager: ReadonlyWebSession = {
  sessionId: "session-01",
  userId: "user-01",
  displayName: "Amina Manager",
  role: "manager",
  readonly: true,
  assignedBranchIds: ["branch-nairobi", "branch-thika"],
  permissions: ["reports.view", "reports.pnl", "reports.zreport"],
  issuedAt: sessionIssuedAt,
  expiresAt: sessionExpiresAt,
};

const viewer: ReadonlyWebSession = {
  ...manager,
  sessionId: "session-02",
  userId: "user-02",
  role: "viewer",
  assignedBranchIds: ["branch-thika"],
  permissions: ["reports.view"],
};

function expectPolicyCode(action: () => unknown, code: WebPolicyError["code"]): void {
  try {
    action();
    throw new Error("Expected WebPolicyError");
  } catch (error) {
    expect(error).toBeInstanceOf(WebPolicyError);
    expect((error as WebPolicyError).code).toBe(code);
  }
}

describe("read-only web projection boundary", () => {
  it("exposes only fixed GET projection rules and no mutation route", () => {
    expect(Object.values(READ_PROJECTION_RULES).every((rule) => rule.path.startsWith("/api/web/v1/"))).toBe(true);
    expect(WEB_ROUTE_DEFINITIONS.every((route) => route.capability.web === "read")).toBe(true);
    expect(WEB_ROUTE_DEFINITIONS.some((route) => /pos|create|edit|delete/i.test(`${route.id} ${route.path}`))).toBe(false);

    for (const projection of Object.keys(READ_PROJECTION_RULES) as Array<keyof typeof READ_PROJECTION_RULES>) {
      const rule = READ_PROJECTION_RULES[projection];
      const scope = rule.scope === "session" || rule.scope === "assigned-list" ? null : { kind: "branch" as const, branchId: "branch-nairobi" };
      const reportId = projection === "reports.rows" || projection === "drilldown.report-row" ? "sales-summary" as const : undefined;
      const recordId = projection === "drilldown.report-row" ? "sale-01" : undefined;
      const request = authorizeProjection({ session: manager, projection, scope, reportId, recordId, now });
      expect(request.method).toBe("GET");
    }
  });

  it("keeps the public browser client fixed and sends GET for every operation", async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ items: [], nextCursor: null, hasMore: false }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const api = createReadonlyWebApi(fetchSpy);
    expect(Object.keys(api).sort()).toEqual([
      "getAlerts",
      "getBranches",
      "getDrilldown",
      "getHome",
      "getProfile",
      "getReportRows",
      "getReports",
      "getSyncHealth",
    ]);
    expect("query" in api).toBe(false);
    expect("execute" in api).toBe(false);
    expect("post" in api).toBe(false);

    await api.getBranches({ limit: 10, search: "Nairobi" });
    await api.getDrilldown(
      "sales-summary",
      "sale:01",
      { kind: "branch", branchId: "branch-nairobi" },
      { limit: 10 },
    );
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ method: "GET", credentials: "same-origin", cache: "no-store" });
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain("recordId=sale%3A01");
    expect(String(fetchSpy.mock.calls[1]?.[0])).not.toContain("%253A");
  });

  it("allows all branches only for manager analytics", () => {
    const analytics = authorizeProjection({ session: manager, projection: "home.dashboard", scope: { kind: "all" }, now });
    expect(analytics.scope).toEqual({ kind: "all" });
    expect(analytics.authorizedBranchIds).toEqual(["branch-nairobi", "branch-thika"]);

    expectPolicyCode(
      () => authorizeProjection({ session: manager, projection: "alerts.list", scope: { kind: "all" }, now }),
      "FORBIDDEN",
    );
    expectPolicyCode(
      () => authorizeProjection({ session: viewer, projection: "home.dashboard", scope: { kind: "all" }, now }),
      "FORBIDDEN",
    );
  });

  it("enforces branch assignments on every branch-scoped request", () => {
    const request = authorizeProjection({ session: viewer, projection: "alerts.list", scope: { kind: "branch", branchId: "branch-thika" }, now });
    expect(request.audit.branchScope).toBe("branch-thika");
    expectPolicyCode(
      () => authorizeProjection({ session: viewer, projection: "alerts.list", scope: { kind: "branch", branchId: "branch-nairobi" }, now }),
      "FORBIDDEN",
    );
  });

  it("bounds limits, search text, cursor shape, and rejects unknown input fields", () => {
    expect(normalizeBoundedQuery(undefined)).toEqual({ limit: 25 });
    expect(normalizeBoundedQuery({ limit: 100, search: "  stock  ", cursor: "next_page-2" })).toEqual({ limit: 100, search: "stock", cursor: "next_page-2" });
    for (const badQuery of [
      { limit: 0 },
      { limit: 101 },
      { limit: 1.5 },
      { search: "x".repeat(81) },
      { search: "bad\nquery" },
      { cursor: "next page" },
      { cursor: "x".repeat(161) },
      { sql: "SELECT * FROM users" },
    ]) {
      expectPolicyCode(() => normalizeBoundedQuery(badQuery), "BAD_QUERY");
    }
  });

  it("permission-filters sensitive reports and blocks direct URL bypasses", () => {
    expect(visibleReports(viewer, now).map((report) => report.id)).toEqual(["sales-summary", "inventory-position"]);
    expect(visibleReports(manager, now).map((report) => report.id)).toContain("profit-and-loss");
    expect(WEB_REPORT_DEFINITIONS.filter((report) => report.sensitive).every((report) => report.permission !== "reports.view")).toBe(true);

    expectPolicyCode(
      () => authorizeProjection({
        session: viewer,
        projection: "reports.rows",
        scope: { kind: "branch", branchId: "branch-thika" },
        reportId: "profit-and-loss",
        now,
      }),
      "FORBIDDEN",
    );
  });

  it("makes arbitrary SQL and arbitrary route names unrepresentable at runtime", () => {
    expect(WEB_ROUTE_DEFINITIONS.find((route) => route.id === "drilldown")?.path).toBe(
      "/web/reports/:reportId/rows/:recordId",
    );
    expect(resolveWebRoute("/web/pos")).toBeNull();
    expect(resolveWebRoute("/web/reports/drop-table")).toBeNull();
    expect(resolveWebRoute("/api/query?sql=SELECT%20*%20FROM%20users")).toBeNull();
    expectPolicyCode(
      () => authorizeProjection({
        session: manager,
        projection: "home.dashboard",
        scope: { kind: "branch", branchId: "branch-nairobi" },
        reportId: "sales-summary",
        now,
      }),
      "BAD_QUERY",
    );
    expectPolicyCode(
      () => authorizeProjection({
        session: manager,
        projection: "reports.rows",
        scope: { kind: "branch", branchId: "branch-nairobi" },
        query: { sql: "SELECT password_hash FROM users" },
        reportId: "sales-summary",
        now,
      }),
      "BAD_QUERY",
    );
  });

  it("expires sessions deterministically and rejects malformed session windows", () => {
    expect(() => assertActiveReadonlySession(manager, now)).not.toThrow();
    expectPolicyCode(() => assertActiveReadonlySession(manager, new Date(manager.expiresAt)), "SESSION_EXPIRED");
    expectPolicyCode(() => assertActiveReadonlySession({ ...manager, expiresAt: manager.issuedAt }, now), "FORBIDDEN");
    expectPolicyCode(
      () => assertActiveReadonlySession({ ...manager, issuedAt: "2026-07-31T09:59:59.999Z" }, now),
      "FORBIDDEN",
    );
  });
});


describe("browser authorization login", () => {
  it("resolves /web/login and redeems a desktop-issued code with same-origin credentials", async () => {
    expect(resolveWebRoute("/web/login")).toEqual({ id: "login" });
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ authorized: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const { redeemBrowserAuthorization } = await import("@/web/api");
    await redeemBrowserAuthorization("AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-0000-1111", fetchSpy);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("/api/web/v1/session?code=");
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
    });
  });
});
