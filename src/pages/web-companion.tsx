import type { ReactNode } from "react";
import { WebCompanionShell } from "@/components/web/WebCompanionShell";
import { WebAlertsPage } from "@/pages/web-alerts";
import { WebBranchesPage } from "@/pages/web-branches";
import { WebDrillDownPage } from "@/pages/web-drill-down";
import { WebHomePage } from "@/pages/web-home";
import { WebProfilePage } from "@/pages/web-profile";
import { WebReportPage } from "@/pages/web-report";
import { WebReportsPage } from "@/pages/web-reports";
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
import { routeDefinitionFor, type WebRouteMatch } from "@/web/routes";

interface WebCompanionViewProps {
  readonly session: ReadonlyWebSession;
  readonly runtime: WebRuntimeState;
  readonly route: WebRouteMatch;
  readonly scope: BranchScope;
  readonly branchOptions: readonly { readonly id: string; readonly code: string; readonly name: string }[];
  readonly home: HomeProjection;
  readonly branches: CursorPage<BranchSummary>;
  readonly reports: readonly ReportDefinition[];
  readonly reportRows: CursorPage<ReportRowProjection>;
  readonly alerts: CursorPage<AlertProjection>;
  readonly sync: SyncHealthProjection;
  readonly drilldown: DrilldownProjection;
  readonly profile: ProfileProjection;
  readonly search: string;
  readonly hasPreviousPage: boolean;
  readonly onNavigate: (path: string) => void;
  readonly onScopeChange: (scope: BranchScope) => void;
  readonly onSearchChange: (value: string) => void;
  readonly onPreviousPage: () => void;
  readonly onNextPage: () => void;
  readonly onRetry?: () => void;
}

export function WebCompanionView({
  session,
  runtime,
  route,
  scope,
  branchOptions,
  home,
  branches,
  reports,
  reportRows,
  alerts,
  sync,
  drilldown,
  profile,
  search,
  hasPreviousPage,
  onNavigate,
  onScopeChange,
  onSearchChange,
  onPreviousPage,
  onNextPage,
  onRetry,
}: WebCompanionViewProps) {
  const routeDefinition = routeDefinitionFor(route);
  const permittedReports = reports.filter((report) => session.permissions.includes(report.permission));
  const selectedReport = route.id === "report" || route.id === "drilldown"
    ? permittedReports.find((report) => report.id === route.reportId)
    : undefined;

  let content: ReactNode;
  if (route.id === "home") {
    content = <WebHomePage projection={home} onNavigate={onNavigate} />;
  } else if (route.id === "branches") {
    content = (
      <WebBranchesPage
        branches={branches}
        search={search}
        hasPreviousPage={hasPreviousPage}
        onSearchChange={onSearchChange}
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
        onViewBranch={(branchId) => {
          onScopeChange({ kind: "branch", branchId });
          onNavigate("/web/reports");
        }}
      />
    );
  } else if (route.id === "reports") {
    content = <WebReportsPage reports={permittedReports} search={search} onSearchChange={onSearchChange} onOpenReport={(reportId) => onNavigate(`/web/reports/${reportId}`)} />;
  } else if (route.id === "report" && selectedReport) {
    content = (
      <WebReportPage
        report={selectedReport}
        scopeLabel={scope.kind === "all" ? "All branches / analytics" : branchOptions.find((branch) => branch.id === scope.branchId)?.name ?? "Assigned branch"}
        rows={reportRows}
        search={search}
        hasPreviousPage={hasPreviousPage}
        onBack={() => onNavigate("/web/reports")}
        onSearchChange={onSearchChange}
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
        onOpenRow={(recordId) => onNavigate(`/web/reports/${selectedReport.id}/rows/${encodeURIComponent(recordId)}`)}
      />
    );
  } else if (route.id === "alerts") {
    content = <WebAlertsPage alerts={alerts} sync={sync} search={search} hasPreviousPage={hasPreviousPage} onSearchChange={onSearchChange} onPreviousPage={onPreviousPage} onNextPage={onNextPage} />;
  } else if (route.id === "drilldown" && selectedReport) {
    content = (
      <WebDrillDownPage
        projection={drilldown}
        search={search}
        hasPreviousPage={hasPreviousPage}
        onBack={() => onNavigate(`/web/reports/${selectedReport.id}`)}
        onSearchChange={onSearchChange}
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
        onOpenRelated={(recordId) => onNavigate(`/web/reports/${selectedReport.id}/rows/${recordId}`)}
      />
    );
  } else if (route.id === "profile") {
    content = <WebProfilePage profile={profile} session={session} />;
  } else {
    content = (
      <section className="border-y border-border py-12 text-center" role="alert">
        <h1 className="text-lg font-semibold">Report not available</h1>
        <p className="mt-2 text-sm text-muted-foreground">This session does not have permission to view the requested report.</p>
      </section>
    );
  }

  return (
    <WebCompanionShell
      session={session}
      route={routeDefinition}
      scope={scope}
      branches={branchOptions}
      runtime={runtime}
      onNavigate={onNavigate}
      onScopeChange={onScopeChange}
      onRetry={onRetry}
    >
      {content}
    </WebCompanionShell>
  );
}
