import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebCompanionApp } from "@/pages/WebCompanionApp";
import { WebApiError, type ReadonlyWebApi } from "@/web/api";
import type { ProfileProjection } from "@/web/contracts";
import { normalizeScopeForRoute, runtimeForFailure } from "@/web/runtime";
import { resolveWebRoute } from "@/web/routes";

const profile: ProfileProjection = {
  sessionId: "session-runtime",
  userId: "user-runtime",
  role: "manager",
  readonly: true,
  displayName: "Amina Manager",
  roleLabel: "Manager",
  assignedBranches: [{ id: "branch-main", name: "Main Branch" }],
  permissions: ["reports.view"],
  sessionIssuedAt: "2026-07-31T10:00:00.000Z",
  sessionExpiresAt: "2026-07-31T18:00:00.000Z",
  connectedHubName: "Main Hub",
  deviceLabel: "Safari on tablet",
};

function api(overrides: Partial<ReadonlyWebApi> = {}): ReadonlyWebApi {
  const emptyPage = { items: [], nextCursor: null, hasMore: false } as const;
  return {
    getProfile: vi.fn(async () => profile),
    getBranches: vi.fn(async () => ({ ...emptyPage, items: [{ id: "branch-main", code: "MAIN", name: "Main Branch", town: "Nairobi", lastSeenAt: null, syncState: "healthy" as const, salesToday: "KES 0", transactionCount: 0 }] })),
    getHome: vi.fn(async () => ({ generatedAt: "09:48", scopeLabel: "Main Branch", salesToday: "KES 48,200", transactionCount: 18, lowStockCount: 4, openAlertCount: 2, recentActivity: [] })),
    getReports: vi.fn(async () => []),
    getReportRows: vi.fn(async () => emptyPage),
    getAlerts: vi.fn(async () => emptyPage),
    getSyncHealth: vi.fn(async () => ({ branchId: "branch-main", branchName: "Main Branch", state: "healthy" as const, lastSuccessfulSyncAt: "09:47", pendingRecords: 0, hubReachable: true })),
    getDrilldown: vi.fn(async () => ({ id: "sale-1", title: "Sale 1", subtitle: "Sales summary", branchName: "Main Branch", fields: [], related: emptyPage })),
    ...overrides,
  };
}

afterEach(() => cleanup());

describe("read-only browser runtime", () => {
  it("bootstraps the HttpOnly-backed profile, assigned branches, and current route projection", async () => {
    const client = api();
    render(<WebCompanionApp api={client} initialRoute={{ id: "home" }} />);
    expect(screen.getByText("Connecting to branch hub…")).toBeDefined();
    await waitFor(() => expect(screen.getByRole("heading", { name: "What needs your attention" })).toBeDefined());
    expect(client.getProfile).toHaveBeenCalledTimes(1);
    expect(client.getBranches).toHaveBeenCalled();
    await waitFor(() => expect(client.getHome).toHaveBeenCalledWith({ kind: "branch", branchId: "branch-main" }));
    window.dispatchEvent(new Event("offline"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("This device is offline"));
    expect(client.getHome).toHaveBeenCalledTimes(1);
    expect(screen.getByText("What needs your attention")).toBeDefined();
  });

  it("clears projected data and exposes reauthentication when bootstrap is unauthorized", async () => {
    const client = api({ getProfile: vi.fn(async () => { throw new WebApiError(401, "Session expired."); }) });
    render(<WebCompanionApp api={client} initialRoute={{ id: "home" }} />);
    await waitFor(() => expect(screen.getByText("Business data hidden")).toBeDefined());
    expect(screen.queryByText("What needs your attention")).toBeNull();
    expect(screen.getByText("Ask a desktop administrator to issue a new read-only browser session.")).toBeDefined();
    expect(screen.queryByRole("link", { name: "Sign in again" })).toBeNull();
  });

  it("normalizes all-branch scope only for manager analytics routes", () => {
    const session = {
      sessionId: profile.sessionId,
      userId: profile.userId,
      displayName: profile.displayName,
      role: profile.role,
      readonly: true,
      assignedBranchIds: ["branch-main"],
      permissions: profile.permissions,
      issuedAt: profile.sessionIssuedAt,
      expiresAt: profile.sessionExpiresAt,
    } as const;
    expect(normalizeScopeForRoute(session, { id: "reports" }, { kind: "all" })).toEqual({ kind: "all" });
    expect(normalizeScopeForRoute(session, { id: "alerts" }, { kind: "all" })).toEqual({ kind: "branch", branchId: "branch-main" });
  });

  it("classifies browser failures and safely resolves one encoded record segment", () => {
    expect(runtimeForFailure(new Error("network"), "Hub", null, false).kind).toBe("offline");
    expect(runtimeForFailure(new Error("network"), "Hub", null, true).kind).toBe("lan-unreachable");
    expect(runtimeForFailure(new WebApiError(401, "expired"), "Hub", null, true).kind).toBe("session-expired");
    expect(resolveWebRoute("/web/reports/sales-summary/rows/sale%3A01")).toEqual({ id: "drilldown", reportId: "sales-summary", recordId: "sale:01" });
    expect(resolveWebRoute("/web/reports/sales-summary/rows/%252e%252e%252fusers")).toBeNull();
  });

  it("ships PWA metadata and never caches API responses", async () => {
    const manifest = await import("../public/manifest.webmanifest?raw").then((module) => JSON.parse(module.default) as { scope: string; start_url: string; icons: Array<{ src: string; sizes: string }> });
    const worker = await import("../public/web-service-worker.js?raw").then((module) => module.default);
    expect(manifest.scope).toBe("/web/");
    expect(manifest.start_url).toBe("/web/");
    expect(manifest.icons.map(({ sizes }) => sizes)).toEqual(["192x192", "512x512"]);
    expect(worker).toContain('url.pathname.startsWith("/api/")');
    expect(worker).toContain('"/web-icon-512.png"');
    expect(worker).not.toMatch(/caches\.put\([^\n]*api/i);
  });
});
