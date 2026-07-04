/**
 * ServicePeriodBadge — compact widget that shows the currently-open
 * service period session with an Open/Close button. Drops into the
 * KDS header + Orders page header.
 *
 * Polls every 30 s (cheap query) so the badge picks up shift changes
 * even when the operator switches on another terminal.
 */
import { useEffect, useState } from "react";
import { Play, Stop } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  listServicePeriods,
  currentOpenSession,
  openSession,
  closeSession,
  type ServicePeriod,
  type ServicePeriodSession,
} from "@/services/service-periods";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";

export function ServicePeriodBadge({ className }: { className?: string }) {
  const userId = useAuthStore((s) => s.user?.id);
  const [session, setSession] = useState<ServicePeriodSession | null>(null);
  const [periods, setPeriods] = useState<ServicePeriod[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setSession(await currentOpenSession());
    setPeriods(await listServicePeriods());
  };

  useEffect(() => {
    load();
    const t = window.setInterval(load, 30_000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs transition-colors hover:bg-accent/40",
        )}
        title={session ? "Service period open" : "No period open — click to start one"}
      >
        {session ? (
          <>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium">{session.period_name ?? "Shift"}</span>
            <Badge variant="outline" className="text-[9px]">open</Badge>
          </>
        ) : (
          <>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            <span className="text-muted-foreground">No shift open</span>
          </>
        )}
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-64 p-3 rounded-md border border-border bg-popover text-popover-foreground shadow-md">
        {session ? (
          <>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Active shift</div>
            <div className="text-sm font-medium mb-2">{session.period_name}</div>
            <div className="text-[11px] text-muted-foreground mb-3">
              Opened at {new Date(session.opened_at).toLocaleTimeString()}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={async () => {
                try {
                  await closeSession(session.id, userId);
                  toast.success("Shift closed");
                  await load();
                  setOpen(false);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              <Stop className="h-3.5 w-3.5 mr-1.5" /> Close shift
            </Button>
          </>
        ) : (
          <>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2">Start a shift</div>
            {periods.length === 0 ? (
              <div className="text-xs text-muted-foreground italic py-2">
                No service periods defined. Add one in Settings &gt; Hospitality.
              </div>
            ) : (
              <div className="space-y-1">
                {periods.map((p) => (
                  <button
                    key={p.id}
                    onClick={async () => {
                      try {
                        await openSession(p.id, userId);
                        toast.success(`${p.name} shift open`);
                        await load();
                        setOpen(false);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : String(e));
                      }
                    }}
                    className="w-full text-left rounded-md border border-border p-2 hover:bg-accent/40 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{p.starts_at} – {p.ends_at}</div>
                    </div>
                    <Play className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
                </div>
        </>
      ) : null}
    </div>
  );
}
