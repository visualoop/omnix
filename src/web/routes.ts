import { WEB_REPORT_DEFINITIONS, WEB_ROUTE_DEFINITIONS, type ReportId, type WebRouteDefinition } from "@/web/contracts";

export type WebRouteMatch =
  | { readonly id: "home" }
  | { readonly id: "branches" }
  | { readonly id: "reports" }
  | { readonly id: "report"; readonly reportId: ReportId }
  | { readonly id: "alerts" }
  | { readonly id: "drilldown"; readonly reportId: ReportId; readonly recordId: string }
  | { readonly id: "profile" };

const SAFE_RECORD_ID = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;

function knownReport(value: string): value is ReportId {
  return WEB_REPORT_DEFINITIONS.some((report) => report.id === value);
}

function decodedSegment(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    return encodeURIComponent(decoded).toLowerCase() === value.toLowerCase() || decoded === value ? decoded : null;
  } catch {
    return null;
  }
}

export function resolveWebRoute(pathname: string): WebRouteMatch | null {
  if (pathname.includes("?") || pathname.includes("#") || pathname.includes("\\")) return null;
  if (pathname === "/web" || pathname === "/web/") return { id: "home" };
  if (pathname === "/web/branches") return { id: "branches" };
  if (pathname === "/web/reports") return { id: "reports" };
  if (pathname === "/web/alerts") return { id: "alerts" };
  if (pathname === "/web/profile") return { id: "profile" };

  const reportMatch = pathname.match(/^\/web\/reports\/([^/]+)$/);
  if (reportMatch && knownReport(reportMatch[1])) {
    return { id: "report", reportId: reportMatch[1] };
  }

  const drilldownMatch = pathname.match(/^\/web\/reports\/([^/]+)\/rows\/([^/]+)$/);
  const recordId = drilldownMatch ? decodedSegment(drilldownMatch[2]) : null;
  if (drilldownMatch && knownReport(drilldownMatch[1]) && recordId && SAFE_RECORD_ID.test(recordId)) {
    return { id: "drilldown", reportId: drilldownMatch[1], recordId };
  }

  return null;
}

export function routeDefinitionFor(match: WebRouteMatch): WebRouteDefinition {
  const definitionId = match.id === "report" ? "report" : match.id;
  const definition = WEB_ROUTE_DEFINITIONS.find((candidate) => candidate.id === definitionId);
  if (!definition) throw new Error(`Missing web route capability for ${definitionId}`);
  return definition;
}
