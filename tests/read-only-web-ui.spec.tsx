import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { WebCompanionShell } from "@/components/web/WebCompanionShell";
import { WebCompanionView } from "@/pages/web-companion";
import { WebAlertsPage } from "@/pages/web-alerts";
import { WebBranchesPage } from "@/pages/web-branches";
import { WebDrillDownPage } from "@/pages/web-drill-down";
import { WebHomePage } from "@/pages/web-home";
import { WebProfilePage } from "@/pages/web-profile";
import { WebReportPage } from "@/pages/web-report";
import { WebReportsPage } from "@/pages/web-reports";
import { WEB_REPORT_DEFINITIONS, WEB_ROUTE_DEFINITIONS, type ReadonlyWebSession } from "@/web/contracts";

afterEach(() => cleanup());

const session: ReadonlyWebSession = {
  sessionId: "session-ui",
  userId: "user-ui",
  displayName: "Amina Manager",
  role: "manager",
  readonly: true,
  assignedBranchIds: ["branch-main"],
  permissions: ["reports.view"],
  issuedAt: "2026-07-31T10:00:00.000Z",
  expiresAt: "2026-07-31T18:00:00.000Z",
};
const homeRoute = WEB_ROUTE_DEFINITIONS.find((route) => route.id === "home")!;
const noop = vi.fn();

function renderShell(runtime: Parameters<typeof WebCompanionShell>[0]["runtime"], role: ReadonlyWebSession["role"] = "manager") {
  return render(
    <WebCompanionShell
      session={{ ...session, role }}
      route={homeRoute}
      scope={{ kind: "branch", branchId: "branch-main" }}
      branches={[
        { id: "branch-main", code: "MAIN", name: "Main Branch" },
        { id: "branch-other", code: "OTHER", name: "Unassigned Branch" },
      ]}
      runtime={runtime}
      onNavigate={noop}
      onScopeChange={noop}
    >
      <p>Sensitive cached snapshot</p>
    </WebCompanionShell>,
  );
}

describe("read-only web companion UI", () => {
  it("renders the required navigation without POS or mutation controls", () => {
    renderShell({ kind: "connected", hubName: "Main Branch Hub", lastUpdatedAt: "09:48" });
    expect(screen.getAllByText("Home").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Branches").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reports").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Alerts/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Profile").length).toBeGreaterThan(0);
    expect(screen.getByText("Read only")).toBeDefined();
    expect(screen.getByRole("group", { name: "Viewing" })).toBeDefined();
    expect(screen.getByRole("button", { name: /Main Branch/i }).parentElement?.className).toContain("[&>button]:h-11");
    expect(screen.queryByText("POS")).toBeNull();
    expect(screen.queryByRole("button", { name: /create|save|edit|delete|sell|checkout/i })).toBeNull();
    expect(screen.getByText("Sensitive cached snapshot")).toBeDefined();
  });

  it("shows explicit LAN/offline state and hides cached content after expiry", () => {
    const { rerender } = renderShell({ kind: "lan-unreachable", hubName: "Main Branch Hub", lastUpdatedAt: "09:40" });
    expect(screen.getByRole("alert").textContent).toContain("Branch hub is out of reach");
    expect(screen.getByText("Sensitive cached snapshot")).toBeDefined();

    rerender(
      <WebCompanionShell
        session={session}
        route={homeRoute}
        scope={{ kind: "branch", branchId: "branch-main" }}
        branches={[
        { id: "branch-main", code: "MAIN", name: "Main Branch" },
        { id: "branch-other", code: "OTHER", name: "Unassigned Branch" },
      ]}
        runtime={{ kind: "session-expired", expiredAt: "2026-07-31T18:00:00.000Z" }}
        onNavigate={noop}
        onScopeChange={noop}
      >
        <p>Sensitive cached snapshot</p>
      </WebCompanionShell>,
    );
    expect(screen.getByText("Business data hidden")).toBeDefined();
    expect(screen.queryByText("Sensitive cached snapshot")).toBeNull();
    expect(screen.queryByText("Main Branch")).toBeNull();
    expect(screen.queryByText("Amina Manager")).toBeNull();
    expect(screen.getByText("Ask a desktop administrator to issue a new read-only browser session.")).toBeDefined();
    expect(screen.queryByRole("link", { name: "Sign in again" })).toBeNull();
  });

  it("exposes all branches only to a manager on analytics routes", () => {
    renderShell({ kind: "connected", hubName: "Hub", lastUpdatedAt: "now" }, "viewer");
    fireEvent.click(screen.getByRole("button", { name: /Main Branch/i }));
    expect(screen.queryByText("All branches")).toBeNull();
    expect(screen.queryByText("Unassigned Branch")).toBeNull();
    cleanup();

    renderShell({ kind: "connected", hubName: "Hub", lastUpdatedAt: "now" }, "manager");
    fireEvent.click(screen.getByRole("button", { name: /Main Branch/i }));
    expect(screen.getByText("All branches")).toBeDefined();
    expect(screen.getByText("Analytics only")).toBeDefined();
    expect(screen.queryByText("Unassigned Branch")).toBeNull();
  });

  it("renders Home, Branches, Reports, alerts/sync, drill-down, and Profile content", () => {
    const { unmount } = render(<WebHomePage projection={{ generatedAt: "09:48", scopeLabel: "Main Branch", salesToday: "KES 48,200", transactionCount: 18, lowStockCount: 4, openAlertCount: 2, recentActivity: [] }} onNavigate={noop} />);
    expect(screen.getByText("What needs your attention")).toBeDefined();
    unmount();

    render(<WebBranchesPage branches={{ items: [], nextCursor: null, hasMore: false }} search="" hasPreviousPage={false} onSearchChange={noop} onPreviousPage={noop} onNextPage={noop} onViewBranch={noop} />);
    expect(screen.getByRole("heading", { name: "Branches" })).toBeDefined();
    expect(screen.getByRole("searchbox", { name: "Search assigned branches" })).toHaveProperty("maxLength", 80);
    cleanup();

    render(<WebReportsPage reports={WEB_REPORT_DEFINITIONS.slice(0, 2)} search="" onSearchChange={noop} onOpenReport={noop} />);
    expect(screen.getByRole("heading", { name: "Reports" })).toBeDefined();
    expect(screen.getByText("Sales summary")).toBeDefined();
    cleanup();

    render(<WebAlertsPage alerts={{ items: [], nextCursor: null, hasMore: false }} sync={{ branchId: "branch-main", branchName: "Main Branch", state: "healthy", lastSuccessfulSyncAt: "09:47", pendingRecords: 0, hubReachable: true }} search="" hasPreviousPage={false} onSearchChange={noop} onPreviousPage={noop} onNextPage={noop} />);
    expect(screen.getByText("Alerts & sync health")).toBeDefined();
    cleanup();

    render(<WebDrillDownPage projection={{ id: "sale-01", title: "Sale 001", subtitle: "Completed sale", branchName: "Main Branch", fields: [{ label: "Total", value: "KES 1,200" }], related: { items: [], nextCursor: null, hasMore: false } }} search="" hasPreviousPage={false} onBack={noop} onSearchChange={noop} onPreviousPage={noop} onNextPage={noop} onOpenRelated={noop} />);
    expect(screen.getByText("Read-only record / sale-01")).toBeDefined();
    cleanup();

    render(<WebProfilePage session={session} profile={{ displayName: "Amina Manager", roleLabel: "Manager", assignedBranches: [{ id: "branch-main", name: "Main Branch" }], permissions: ["reports.view"], sessionIssuedAt: session.issuedAt, sessionExpiresAt: session.expiresAt, connectedHubName: "Main Hub", deviceLabel: "Safari on tablet" }} />);
    expect(screen.getByText("Authenticated session")).toBeDefined();
    expect(screen.getByText("Safari on tablet")).toBeDefined();
  });

  it("filters an over-broad report catalog using session permissions", () => {
    const emptyPage = { items: [], nextCursor: null, hasMore: false } as const;
    render(
      <WebCompanionView
        session={session}
        runtime={{ kind: "connected", hubName: "Main Hub", lastUpdatedAt: "09:48" }}
        route={{ id: "reports" }}
        scope={{ kind: "branch", branchId: "branch-main" }}
        branchOptions={[{ id: "branch-main", code: "MAIN", name: "Main Branch" }]}
        home={{ generatedAt: "09:48", scopeLabel: "Main Branch", salesToday: "KES 0", transactionCount: 0, lowStockCount: 0, openAlertCount: 0, recentActivity: [] }}
        branches={emptyPage}
        reports={WEB_REPORT_DEFINITIONS}
        reportRows={emptyPage}
        alerts={emptyPage}
        sync={{ branchId: "branch-main", branchName: "Main Branch", state: "healthy", lastSuccessfulSyncAt: "09:47", pendingRecords: 0, hubReachable: true }}
        drilldown={{ id: "unused", title: "Unused", subtitle: "Unused", branchName: "Main Branch", fields: [], related: emptyPage }}
        profile={{ displayName: session.displayName, roleLabel: "Manager", assignedBranches: [{ id: "branch-main", name: "Main Branch" }], permissions: session.permissions, sessionIssuedAt: session.issuedAt, sessionExpiresAt: session.expiresAt, connectedHubName: "Main Hub", deviceLabel: "Tablet" }}
        search=""
        hasPreviousPage={false}
        onNavigate={noop}
        onScopeChange={noop}
        onSearchChange={noop}
        onPreviousPage={noop}
        onNextPage={noop}
      />,
    );
    expect(screen.getByText("Sales summary")).toBeDefined();
    expect(screen.queryByText("Profit & loss")).toBeNull();
    expect(screen.queryByText("Payroll summary")).toBeNull();
  });

  it("keeps report rows searchable, bounded-looking, paginated, and drillable", () => {
    const onOpen = vi.fn();
    render(
      <WebReportPage
        report={WEB_REPORT_DEFINITIONS[0]}
        scopeLabel="Main Branch"
        rows={{ items: [{ id: "sale-01", label: "Sale 001", secondary: "Cash", value: "KES 1,200", occurredAt: "09:20" }], nextCursor: "next_1", hasMore: true }}
        search=""
        hasPreviousPage={false}
        onBack={noop}
        onSearchChange={noop}
        onPreviousPage={noop}
        onNextPage={noop}
        onOpenRow={onOpen}
      />,
    );
    expect(screen.getByRole("searchbox", { name: "Search report rows" })).toHaveProperty("maxLength", 80);
    expect(screen.getByRole("button", { name: "Previous" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Next" })).toHaveProperty("disabled", false);
    fireEvent.click(screen.getByRole("button", { name: "Open Sale 001 details" }));
    expect(onOpen).toHaveBeenCalledWith("sale-01");
  });

  it("has no automated accessibility violations in the responsive shell", async () => {
    const { container } = renderShell({ kind: "connected", hubName: "Main Branch Hub", lastUpdatedAt: "09:48" });
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});


describe("browser viewer login UI", () => {
  it("asks only for a one-time code and explains the read-only boundary", async () => {
    const { WebLoginPage } = await import("@/pages/WebLoginPage");
    const { container } = render(<WebLoginPage onAuthorized={noop} />);
    expect(screen.getByRole("heading", { name: "Open the reporting window." })).toBeDefined();
    expect(screen.getByLabelText("One-time authorization code")).toHaveProperty("autocomplete", "one-time-code");
    expect(screen.getByText(/cannot create or widen access/i)).toBeDefined();
    expect(screen.queryByRole("link", { name: /sign up|register/i })).toBeNull();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
