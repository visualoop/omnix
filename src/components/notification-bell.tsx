/**
 * NotificationBell — top-bar bell icon with unread count + dropdown of latest 10.
 * Poll-based (10s interval) — no push infrastructure needed.
 */
import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  BellRinging,
  Warning,
  Info,
} from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import {
  countUnread,
  listNotifications,
  markRead,
  markAllRead,
  type Notification,
} from "@/services/notifications";
import { intlLocale } from "@/lib/intl";

const POLL_INTERVAL_MS = 10_000;

export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    try {
      const [n, list] = await Promise.all([countUnread(), listNotifications({ limit: 10 })]);
      setUnread(n);
      setItems(list);
    } catch {
      // DB may not be initialized yet (setup wizard); silent fail.
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const handleClick = async (n: Notification) => {
    await markRead(n.id).catch(() => {});
    if (n.link) navigate(n.link);
    setOpen(false);
    refresh();
  };

  const handleMarkAll = async () => {
    await markAllRead();
    refresh();
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className="relative inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent"
        aria-label={`Notifications (${unread} unread)`}
      >
        {unread > 0 ? (
          <BellRinging className="h-4 w-4 text-primary" weight="fill" />
        ) : (
          <Bell className="h-4 w-4 text-muted-foreground" />
        )}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-medium min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[380px] p-0 max-h-[520px] flex flex-col">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <div className="text-[13px] font-semibold">Notifications</div>
          <div className="flex items-center gap-1.5">
            {unread > 0 && (
              <button
                onClick={handleMarkAll}
                className="text-[11.5px] text-muted-foreground hover:text-foreground"
              >
                Mark all read
              </button>
            )}
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-[11.5px] text-primary hover:underline"
            >
              See all
            </Link>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-muted-foreground">
              <Bell className="h-6 w-6 mx-auto mb-2 opacity-40" />
              No notifications yet.
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-3 py-2.5 border-b border-border/50 last:border-0 hover:bg-accent ${
                  n.read_at ? "opacity-70" : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  <SeverityIcon severity={n.severity} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{n.title}</div>
                    {n.body && (
                      <div className="text-[12px] text-muted-foreground line-clamp-2 mt-0.5">
                        {n.body}
                      </div>
                    )}
                    <div className="text-[10.5px] text-muted-foreground mt-0.5">
                      {new Date(n.created_at + "Z").toLocaleString(intlLocale(), {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                  </div>
                  {!n.read_at && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SeverityIcon({ severity }: { severity: Notification["severity"] }) {
  if (severity === "critical") return <Warning className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />;
  if (severity === "warning") return <Warning className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />;
  return <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />;
}
