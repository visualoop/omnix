import type { ReactNode } from "react";
import {
  Bell,
  Buildings,
  ChartBar,
  House,
  IdentificationCard,
  type Icon,
} from "@phosphor-icons/react";
import { OmnixLogo } from "@/components/omnix-logo";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { WebStatusBanner } from "@/components/web/WebStatusBanner";
import { cn } from "@/lib/utils";
import {
  WEB_ROUTE_DEFINITIONS,
  type BranchScope,
  type ReadonlyWebSession,
  type WebRouteDefinition,
  type WebRouteId,
  type WebRuntimeState,
} from "@/web/contracts";

interface WebCompanionShellProps {
  readonly session: ReadonlyWebSession;
  readonly route: WebRouteDefinition;
  readonly scope: BranchScope;
  readonly branches: readonly { readonly id: string; readonly code: string; readonly name: string }[];
  readonly runtime: WebRuntimeState;
  readonly onNavigate: (path: string) => void;
  readonly onScopeChange: (scope: BranchScope) => void;
  readonly onRetry?: () => void;
  readonly children: ReactNode;
}

const NAV_ICONS: Readonly<Record<Exclude<WebRouteId, "drilldown" | "report">, Icon>> = {
  home: House,
  branches: Buildings,
  reports: ChartBar,
  alerts: Bell,
  profile: IdentificationCard,
};

const PRIMARY_ROUTES = WEB_ROUTE_DEFINITIONS.filter(
  (definition): definition is (typeof WEB_ROUTE_DEFINITIONS)[number] & { id: Exclude<WebRouteId, "drilldown" | "report"> } =>
    definition.id !== "drilldown" && definition.id !== "report",
);

export function WebCompanionShell({
  session,
  route,
  scope,
  branches,
  runtime,
  onNavigate,
  onScopeChange,
  onRetry,
  children,
}: WebCompanionShellProps) {
  if (runtime.kind === "session-expired" || runtime.kind === "forbidden") {
    const expired = runtime.kind === "session-expired";
    return (
      <div className="min-h-dvh bg-background text-foreground">
        <WebStatusBanner state={runtime} />
        <main id="web-main" className="px-4 py-12 sm:px-6" tabIndex={-1}>
          <section className="mx-auto max-w-lg border-y border-border py-12 text-center" aria-labelledby="hidden-content-title">
            <h1 id="hidden-content-title" className="text-xl font-semibold">Business data hidden</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {expired
                ? "The previous snapshot and account details were removed from view when this session expired."
                : "This session is not authorized for the requested branch or report. No previous projection is shown."}
            </p>
            {expired ? <p className="mt-3 text-sm font-medium">Ask a desktop administrator to issue a new read-only browser session.</p> : null}
          </section>
        </main>
      </div>
    );
  }

  const canUseAllBranches = session.role === "manager" && route.allBranches === "analytics";
  const assignedBranches = branches.filter((branch) => session.assignedBranchIds.includes(branch.id));
  const branchOptions = [
    ...(canUseAllBranches ? [{ value: "__all__", label: "All branches", hint: "Analytics only" }] : []),
    ...assignedBranches.map((branch) => ({ value: branch.id, label: branch.name, hint: branch.code })),
  ];
  const scopeValue = scope.kind === "all" ? "__all__" : scope.branchId;
  const scopeLabel = scope.kind === "all"
    ? "ALL BRANCHES / ANALYTICS"
    : assignedBranches.find((branch) => branch.id === scope.branchId)?.name.toUpperCase() ?? "ASSIGNED BRANCH";

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#web-main"
        className="sr-only z-[100] rounded-md bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <WebStatusBanner state={runtime} onRetry={onRetry} />
      <div className="border-b border-border bg-muted/20 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        <span className="text-blue-700 dark:text-blue-400">GET</span>
        <span className="mx-2 text-border">/</span>
        <span>{scopeLabel}</span>
        <span className="mx-2 text-border">/</span>
        <span>{route.label}</span>
        <span className="float-right hidden sm:inline">READ PROJECTION</span>
      </div>

      <div className="mx-auto flex min-h-[calc(100dvh-5.5rem)] max-w-[1440px]">
        <aside className="hidden w-60 shrink-0 border-r border-border px-3 py-4 md:flex md:flex-col" aria-label="Companion navigation">
          <div className="flex items-center gap-3 px-2 pb-5">
            <OmnixLogo size={32} />
            <div>
              <p className="text-sm font-semibold leading-none">Omnix</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Browser companion</p>
            </div>
            <Badge variant="outline" className="ml-auto">Read only</Badge>
          </div>
          <nav className="space-y-1">
            {PRIMARY_ROUTES.map((item) => {
              const NavIcon = NAV_ICONS[item.id];
              const active = route.id === item.id || ((route.id === "report" || route.id === "drilldown") && item.id === "reports");
              return (
                <a
                  key={item.id}
                  href={item.path}
                  onClick={(event) => { event.preventDefault(); onNavigate(item.path); }}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <NavIcon className="size-[18px]" aria-hidden="true" />
                  {item.label}
                </a>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-border px-2 pt-4">
            <p className="truncate text-xs font-medium">{session.displayName}</p>
            <p className="mt-1 text-[11px] capitalize text-muted-foreground">{session.role} · browser session</p>
          </div>
        </aside>

        <div className="min-w-0 flex-1 pb-24 md:pb-0">
          <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <div className="flex items-center gap-3 md:hidden">
              <OmnixLogo size={30} />
              <div>
                <p className="text-sm font-semibold leading-none">Omnix companion</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Read-only branch view</p>
              </div>
            </div>
            <fieldset className="w-full min-w-0 border-0 p-0 sm:ml-auto sm:max-w-xs">
              <legend className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Viewing
              </legend>
              <Combobox
                value={scopeValue}
                onChange={(value) => onScopeChange(value === "__all__" ? { kind: "all" } : { kind: "branch", branchId: value })}
                options={branchOptions}
                placeholder="Choose an assigned branch"
                searchPlaceholder="Search assigned branches…"
                emptyText="No assigned branches match"
                className="[&>button]:h-11"
              />
            </fieldset>
          </header>
          <main id="web-main" className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-background/95 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur md:hidden" aria-label="Companion navigation">
        {PRIMARY_ROUTES.map((item) => {
          const NavIcon = NAV_ICONS[item.id];
          const active = route.id === item.id || ((route.id === "report" || route.id === "drilldown") && item.id === "reports");
          return (
            <a
              key={item.id}
              href={item.path}
              onClick={(event) => { event.preventDefault(); onNavigate(item.path); }}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-[10px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "text-blue-700 dark:text-blue-400" : "text-muted-foreground",
              )}
            >
              <NavIcon className="size-5" weight={active ? "fill" : "regular"} aria-hidden="true" />
              <span className="max-w-full truncate">{item.id === "alerts" ? "Alerts" : item.label}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}
