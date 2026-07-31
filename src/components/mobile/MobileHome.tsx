import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type {
  MobileHomeKpiTone,
  MobileHomeModel,
  MobileHomeWorkItem,
} from "@/mobile/models/home";

export interface MobileHomeProps {
  readonly model: MobileHomeModel;
  readonly onNavigate: (path: string) => void;
}

function syncStateLabel(state: MobileHomeModel["sync"]["state"]): string {
  if (state === "synced") return "Up to date";
  if (state === "syncing") return "Syncing";
  if (state === "pending") return "Waiting";
  if (state === "offline") return "Offline";
  return "Needs attention";
}

function kpiToneLabel(tone: MobileHomeKpiTone): string | null {
  if (tone === "positive") return "On track";
  if (tone === "attention") return "Review";
  if (tone === "critical") return "Urgent";
  return null;
}

function workKindLabel(kind: MobileHomeWorkItem["kind"]): string {
  if (kind === "alert") return "Alert";
  if (kind === "approval") return "Approval";
  return "Task";
}

function workBadgeVariant(
  priority: MobileHomeWorkItem["priority"],
): "destructive" | "secondary" | "outline" {
  if (priority === "critical") return "destructive";
  if (priority === "attention") return "secondary";
  return "outline";
}

export function MobileHome({ model, onNavigate }: MobileHomeProps) {
  return (
    <div className="space-y-6">
      <section aria-labelledby="mobile-home-title">
        <p className="text-xs font-medium text-muted-foreground">
          {model.branchCode ? `${model.branchCode} · ` : ""}{model.branchLabel}
        </p>
        <h1 id="mobile-home-title" className="mt-1 text-2xl font-semibold tracking-tight">
          Good day, {model.greetingName}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{model.country}</Badge>
          <Badge variant="outline">{model.currency}</Badge>
          {model.isAllBranches ? <Badge variant="secondary">Read-only analytics</Badge> : null}
        </div>
      </section>

      <Card
        role="status"
        aria-live="polite"
        className={model.sync.state === "offline" || model.sync.state === "error"
          ? "border-destructive/40"
          : undefined}
      >
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">
              {model.sync.state === "offline" ? "Working offline" : "Branch sync"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {model.sync.pendingCommands > 0
                ? `${model.sync.pendingCommands} local change${model.sync.pendingCommands === 1 ? "" : "s"} waiting`
                : "No changes waiting to sync"}
            </p>
          </div>
          <Badge variant={model.sync.state === "error" ? "destructive" : "outline"}>
            {syncStateLabel(model.sync.state)}
          </Badge>
        </CardContent>
      </Card>

      <section aria-labelledby="mobile-home-kpis">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Branch pulse
            </p>
            <h2 id="mobile-home-kpis" className="mt-1 text-base font-semibold">
              Today at {model.branchLabel}
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">{model.kpis.length} measures</span>
        </div>
        {model.kpis.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-2" aria-label="Branch key performance indicators">
            {model.kpis.map((kpi) => {
              const toneLabel = kpiToneLabel(kpi.tone);
              return (
                <Card key={kpi.id}>
                  <CardContent>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-muted-foreground">{kpi.label}</p>
                      {toneLabel ? (
                        <Badge variant={kpi.tone === "critical" ? "destructive" : "outline"}>
                          {toneLabel}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 font-mono text-xl font-semibold tracking-tight">{kpi.value}</p>
                    <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{kpi.detail}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Branch measures will appear after the first local refresh.
          </p>
        )}
      </section>

      <section aria-labelledby="mobile-home-work">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Work queue
            </p>
            <h2 id="mobile-home-work" className="mt-1 text-base font-semibold">
              Needs your attention
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">{model.workItems.length} open</span>
        </div>
        {model.workItems.length > 0 ? (
          <div className="mt-3 divide-y divide-border rounded-md border border-border" role="list">
            {model.workItems.map((item) => (
              <div key={item.id} role="listitem">
                <button
                  type="button"
                  onClick={() => onNavigate(item.path)}
                  className="flex min-h-16 w-full items-start justify-between gap-3 px-3 py-3 text-left outline-none transition-colors first:rounded-t-md last:rounded-b-md hover:bg-muted/40 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40 active:bg-muted/60"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{item.title}</span>
                    <span className="mt-1 block text-xs leading-4 text-muted-foreground">
                      {item.detail}
                    </span>
                  </span>
                  <Badge variant={workBadgeVariant(item.priority)}>{workKindLabel(item.kind)}</Badge>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No branch tasks, alerts, or approvals need action.
          </p>
        )}
      </section>

      <section aria-labelledby="mobile-home-actions">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Shortcuts
            </p>
            <h2 id="mobile-home-actions" className="mt-1 text-base font-semibold">
              Your workspaces
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">{model.actions.length} available</span>
        </div>
        {model.actions.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {model.actions.map((action) => (
              <Button
                key={action.id}
                type="button"
                variant="outline"
                className="h-auto min-h-16 items-start justify-between px-3 py-3 text-left"
                onClick={() => onNavigate(action.path)}
              >
                <span>{action.label}</span>
                {action.access === "read" ? (
                  <span className="text-[10px] font-normal text-muted-foreground">View</span>
                ) : null}
              </Button>
            ))}
          </div>
        ) : (
          <Card className="mt-3">
            <CardContent>
              <p className="text-sm font-medium">No workspaces assigned</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Ask the business owner to assign operational permissions, then sign in again.
              </p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
