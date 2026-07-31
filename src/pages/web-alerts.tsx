import { CaretLeft, CaretRight, CheckCircle, ClockCountdown, MagnifyingGlass, WarningCircle, WifiSlash } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AlertProjection, CursorPage, SyncHealthProjection } from "@/web/contracts";

interface WebAlertsPageProps {
  readonly alerts: CursorPage<AlertProjection>;
  readonly sync: SyncHealthProjection;
  readonly search: string;
  readonly hasPreviousPage: boolean;
  readonly onSearchChange: (value: string) => void;
  readonly onPreviousPage: () => void;
  readonly onNextPage: () => void;
}

export function WebAlertsPage({
  alerts,
  sync,
  search,
  hasPreviousPage,
  onSearchChange,
  onPreviousPage,
  onNextPage,
}: WebAlertsPageProps) {
  const SyncIcon = sync.state === "healthy" ? CheckCircle : sync.state === "delayed" ? ClockCountdown : WifiSlash;
  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-blue-700 dark:text-blue-400">Branch signals</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Alerts & sync health</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Review operational warnings and whether this branch has reached its hub. Resolve issues in the desktop app.</p>
      </header>

      <section aria-labelledby="sync-health-title" className="rounded-md border border-border p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <SyncIcon className="mt-0.5 size-5 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="sync-health-title" className="text-sm font-semibold">{sync.branchName}</h2>
              <Badge variant={sync.state === "offline" ? "destructive" : "outline"}>{sync.state}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {sync.hubReachable ? "Branch hub reachable" : "Branch hub not reachable"} · Last successful sync {sync.lastSuccessfulSyncAt ?? "not recorded"}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg font-semibold">{sync.pendingRecords}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pending records</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="alerts-title" className="space-y-4">
        <div>
          <h2 id="alerts-title" className="text-base font-semibold">Open alerts</h2>
          <p className="mt-1 text-xs text-muted-foreground">Read-only alerts for the selected branch</p>
        </div>
        <div className="relative max-w-md">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input type="search" value={search} maxLength={80} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search alerts" aria-label="Search alerts" className="min-h-11 pl-9" />
        </div>
        <div className="divide-y divide-border border-y border-border">
          {alerts.items.length === 0 ? (
            <div className="py-12 text-center">
              <CheckCircle className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium">No alerts match this view</p>
            </div>
          ) : alerts.items.map((alert) => (
            <article key={alert.id} className="grid gap-2 py-4 sm:grid-cols-[1.25rem_1fr_auto] sm:gap-3">
              <WarningCircle className={alert.severity === "critical" ? "size-5 text-red-600" : alert.severity === "warning" ? "size-5 text-amber-600" : "size-5 text-blue-600"} aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold">{alert.title}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{alert.detail}</p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{alert.branchName}</p>
              </div>
              <time className="font-mono text-[11px] text-muted-foreground" dateTime={alert.raisedAt}>{alert.raisedAt}</time>
            </article>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{alerts.items.length} alerts on this page</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={!hasPreviousPage} onClick={onPreviousPage}><CaretLeft aria-hidden="true" /> Previous</Button>
            <Button variant="outline" size="sm" disabled={!alerts.hasMore || !alerts.nextCursor} onClick={onNextPage}>Next <CaretRight aria-hidden="true" /></Button>
          </div>
        </div>
      </section>
    </div>
  );
}
