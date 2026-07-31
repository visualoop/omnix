import { ArrowRight, Bell, ChartLineUp, Package, Receipt } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import type { HomeProjection } from "@/web/contracts";

interface WebHomePageProps {
  readonly projection: HomeProjection;
  readonly onNavigate: (path: string) => void;
}

export function WebHomePage({ projection, onNavigate }: WebHomePageProps) {
  const metrics = [
    { label: "Sales today", value: projection.salesToday, icon: ChartLineUp },
    { label: "Transactions", value: String(projection.transactionCount), icon: Receipt },
    { label: "Low stock", value: String(projection.lowStockCount), icon: Package },
    { label: "Open alerts", value: String(projection.openAlertCount), icon: Bell },
  ] as const;

  return (
    <div className="space-y-7">
      <header className="max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-blue-700 dark:text-blue-400">{projection.scopeLabel}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">What needs your attention</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          A current read-only view from your branch hub. Use the desktop app to make changes.
        </p>
      </header>

      <section aria-label="Today at a glance" className="grid grid-cols-2 border-l border-t border-border lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="min-h-28 border-b border-r border-border p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{metric.label}</p>
              <metric.icon className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="mt-5 break-words font-mono text-xl font-semibold tabular-nums sm:text-2xl">{metric.value}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="recent-activity-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="recent-activity-title" className="text-base font-semibold">Recent activity</h2>
            <p className="mt-1 text-xs text-muted-foreground">Latest records visible in this branch context</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onNavigate("/web/reports")}>
            Open reports <ArrowRight aria-hidden="true" />
          </Button>
        </div>
        <div className="divide-y divide-border border-y border-border">
          {projection.recentActivity.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No recent activity is available for this scope.</p>
          ) : projection.recentActivity.map((activity) => (
            <div key={activity.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[8rem_1fr_auto] sm:items-center sm:gap-4">
              <time className="font-mono text-[11px] text-muted-foreground" dateTime={activity.occurredAt}>{activity.occurredAt}</time>
              <div className="min-w-0">
                <p className="truncate font-medium">{activity.description}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{activity.branchName}</p>
              </div>
              {activity.amount ? <p className="font-mono font-medium tabular-nums">{activity.amount}</p> : null}
            </div>
          ))}
        </div>
      </section>
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Snapshot generated {projection.generatedAt}</p>
    </div>
  );
}
