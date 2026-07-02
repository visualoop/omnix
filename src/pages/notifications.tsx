import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Trash, ClockCounterClockwise, Check } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  listNotifications,
  markRead,
  markAllRead,
  snooze,
  dismiss,
  type Notification,
} from "@/services/notifications";
import { intlLocale } from "@/lib/intl";
import { toast } from "sonner";

import { BackButton } from "@/components/ui/back-button";
export function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listNotifications({ onlyUnread: filter === "unread", limit: 200 }));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleOpen = async (n: Notification) => {
    if (!n.read_at) await markRead(n.id).catch(() => {});
    if (n.link) navigate(n.link);
    else load();
  };

  const handleSnooze = async (n: Notification, hours: number) => {
    const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 19);
    await snooze(n.id, until);
    toast.success(`Snoozed for ${hours}h`);
    load();
  };

  const handleDismiss = async (n: Notification) => {
    await dismiss(n.id);
    load();
  };

  return (
    <div className="max-w-3xl space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <BackButton fallback="/" />
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" /> Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Everything that needs your attention — expiring stock, unpaid invoices, cold-chain alerts, refill reminders.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={async () => { await markAllRead(); load(); }}>
          <Check className="h-3.5 w-3.5 mr-1.5" /> Mark all read
        </Button>
      </header>

      <div className="flex gap-1.5 border-b border-border">
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-[13px] border-b-2 -mb-px ${
              filter === f
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? "All" : "Unread"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center">
          <Bell className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <div className="text-sm text-muted-foreground">
            {filter === "unread" ? "No unread notifications." : "No notifications yet."}
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((n) => (
            <div
              key={n.id}
              className={`rounded-md border border-border p-3 ${n.read_at ? "opacity-70" : "bg-primary/[0.03]"}`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 ${n.read_at ? "bg-muted" : "bg-primary"}`} />
                <div className="flex-1 min-w-0">
                  <button
                    className="text-left w-full"
                    onClick={() => handleOpen(n)}
                  >
                    <div className="text-[13.5px] font-medium">{n.title}</div>
                    {n.body && <div className="text-[12.5px] text-muted-foreground mt-1">{n.body}</div>}
                    <div className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-2">
                      <span className="uppercase tracking-wider">{n.kind.replace(/_/g, " ")}</span>
                      <span>·</span>
                      <span>{new Date(n.created_at + "Z").toLocaleString(intlLocale(), { dateStyle: "medium", timeStyle: "short" })}</span>
                    </div>
                  </button>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleSnooze(n, 24)}
                    title="Snooze 24h"
                    className="p-1.5 hover:bg-accent rounded"
                  >
                    <ClockCounterClockwise className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleDismiss(n)}
                    title="Dismiss"
                    className="p-1.5 hover:bg-accent rounded"
                  >
                    <Trash className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
