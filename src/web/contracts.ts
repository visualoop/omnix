export type WebSessionRole = "viewer" | "manager";
export type WebPermission =
  | "reports.view"
  | "reports.zreport"
  | "reports.pnl"
  | "etims.view"
  | "audit.view"
  | "hr.payroll.view";

export interface ReadonlyWebSession {
  readonly sessionId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly role: WebSessionRole;
  readonly readonly: true;
  readonly assignedBranchIds: readonly string[];
  readonly permissions: readonly WebPermission[];
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export type BranchScope =
  | { readonly kind: "branch"; readonly branchId: string }
  | { readonly kind: "all" };

export type WebRouteId =
  | "home"
  | "branches"
  | "reports"
  | "report"
  | "alerts"
  | "drilldown"
  | "profile";

export interface RouteCapability {
  readonly desktop: boolean;
  readonly android: "full" | "read" | "hidden";
  readonly web: "read" | "hidden";
  readonly requiresHub: boolean;
  readonly permissions: readonly WebPermission[];
  readonly modules?: readonly string[];
}

export interface WebRouteDefinition {
  readonly id: WebRouteId;
  readonly path: string;
  readonly label: string;
  readonly capability: RouteCapability;
  readonly allBranches: "analytics" | "never";
}

export const WEB_ROUTE_DEFINITIONS = [
  {
    id: "home",
    path: "/web",
    label: "Home",
    capability: { desktop: true, android: "read", web: "read", requiresHub: true, permissions: ["reports.view"] },
    allBranches: "analytics",
  },
  {
    id: "branches",
    path: "/web/branches",
    label: "Branches",
    capability: { desktop: true, android: "read", web: "read", requiresHub: true, permissions: ["reports.view"] },
    allBranches: "never",
  },
  {
    id: "reports",
    path: "/web/reports",
    label: "Reports",
    capability: { desktop: true, android: "read", web: "read", requiresHub: true, permissions: ["reports.view"] },
    allBranches: "analytics",
  },
  {
    id: "report",
    path: "/web/reports/:reportId",
    label: "Report",
    capability: { desktop: true, android: "read", web: "read", requiresHub: true, permissions: ["reports.view"] },
    allBranches: "analytics",
  },
  {
    id: "alerts",
    path: "/web/alerts",
    label: "Alerts & sync",
    capability: { desktop: true, android: "read", web: "read", requiresHub: true, permissions: ["reports.view"] },
    allBranches: "never",
  },
  {
    id: "drilldown",
    path: "/web/reports/:reportId/rows/:recordId",
    label: "Detail",
    capability: { desktop: true, android: "read", web: "read", requiresHub: true, permissions: ["reports.view"] },
    allBranches: "analytics",
  },
  {
    id: "profile",
    path: "/web/profile",
    label: "Profile",
    capability: { desktop: true, android: "read", web: "read", requiresHub: true, permissions: [] },
    allBranches: "never",
  },
] as const satisfies readonly WebRouteDefinition[];

export type ReportId =
  | "sales-summary"
  | "inventory-position"
  | "profit-and-loss"
  | "z-report"
  | "tax-summary"
  | "payroll-summary"
  | "audit-summary";

export interface ReportDefinition {
  readonly id: ReportId;
  readonly title: string;
  readonly description: string;
  readonly permission: WebPermission;
  readonly sensitive: boolean;
}

export const WEB_REPORT_DEFINITIONS = [
  { id: "sales-summary", title: "Sales summary", description: "Revenue, transaction count, and payment mix.", permission: "reports.view", sensitive: false },
  { id: "inventory-position", title: "Inventory position", description: "Stock value, low-stock items, and ageing.", permission: "reports.view", sensitive: false },
  { id: "profit-and-loss", title: "Profit & loss", description: "Income, cost of sales, and operating result.", permission: "reports.pnl", sensitive: true },
  { id: "z-report", title: "Z-report", description: "Till totals and reconciliation variance.", permission: "reports.zreport", sensitive: true },
  { id: "tax-summary", title: "Tax summary", description: "VAT and eTIMS submission totals.", permission: "etims.view", sensitive: true },
  { id: "payroll-summary", title: "Payroll summary", description: "Payroll totals without employee bank details.", permission: "hr.payroll.view", sensitive: true },
  { id: "audit-summary", title: "Audit summary", description: "Security and business event overview.", permission: "audit.view", sensitive: true },
] as const satisfies readonly ReportDefinition[];

export interface BoundedListQuery {
  readonly limit: number;
  readonly search?: string;
  readonly cursor?: string;
}

export interface CursorPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface BranchSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly town: string | null;
  readonly lastSeenAt: string | null;
  readonly syncState: "healthy" | "delayed" | "offline";
  readonly salesToday: string;
  readonly transactionCount: number;
}

export interface HomeProjection {
  readonly generatedAt: string;
  readonly scopeLabel: string;
  readonly salesToday: string;
  readonly transactionCount: number;
  readonly lowStockCount: number;
  readonly openAlertCount: number;
  readonly recentActivity: readonly ActivityProjection[];
}

export interface ActivityProjection {
  readonly id: string;
  readonly occurredAt: string;
  readonly branchName: string;
  readonly description: string;
  readonly amount: string | null;
}

export interface ReportRowProjection {
  readonly id: string;
  readonly label: string;
  readonly secondary: string;
  readonly value: string;
  readonly occurredAt: string | null;
}

export interface AlertProjection {
  readonly id: string;
  readonly severity: "info" | "warning" | "critical";
  readonly title: string;
  readonly detail: string;
  readonly branchName: string;
  readonly raisedAt: string;
}

export interface SyncHealthProjection {
  readonly branchId: string;
  readonly branchName: string;
  readonly state: "healthy" | "delayed" | "offline";
  readonly lastSuccessfulSyncAt: string | null;
  readonly pendingRecords: number;
  readonly hubReachable: boolean;
}

export interface DrilldownProjection {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly branchName: string;
  readonly fields: readonly { readonly label: string; readonly value: string }[];
  readonly related: CursorPage<ReportRowProjection>;
}

export interface ProfileProjection {
  readonly sessionId: string;
  readonly userId: string;
  readonly role: WebSessionRole;
  readonly readonly: true;
  readonly displayName: string;
  readonly roleLabel: string;
  readonly assignedBranches: readonly { readonly id: string; readonly name: string }[];
  readonly permissions: readonly WebPermission[];
  readonly sessionIssuedAt: string;
  readonly sessionExpiresAt: string;
  readonly connectedHubName: string;
  readonly deviceLabel: string;
}

export type WebRuntimeState =
  | { readonly kind: "loading" }
  | { readonly kind: "connected"; readonly hubName: string; readonly lastUpdatedAt: string }
  | { readonly kind: "offline"; readonly lastUpdatedAt: string | null }
  | { readonly kind: "lan-unreachable"; readonly hubName: string; readonly lastUpdatedAt: string | null }
  | { readonly kind: "forbidden" }
  | { readonly kind: "session-expired"; readonly expiredAt: string };

export type ReadProjectionId =
  | "home.dashboard"
  | "branches.list"
  | "reports.catalog"
  | "reports.rows"
  | "alerts.list"
  | "sync.health"
  | "drilldown.report-row"
  | "profile.session";

export interface AuthorizedProjectionRequest {
  readonly method: "GET";
  readonly projection: ReadProjectionId;
  readonly path: string;
  readonly scope: BranchScope | null;
  readonly authorizedBranchIds: readonly string[];
  readonly query: BoundedListQuery;
  readonly reportId?: ReportId;
  readonly recordId?: string;
  readonly audit: {
    readonly sessionId: string;
    readonly userId: string;
    readonly projection: ReadProjectionId;
    readonly branchScope: string;
  };
}
