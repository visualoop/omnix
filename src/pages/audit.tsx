import { useCallback, useState } from "react";
import {
  Pulse as Activity,
  Cpu,
  Funnel as Filter,
  Key as Key,
  Receipt,
  ShieldWarning as ShieldAlert,
  ShieldCheck,
  Warning as AlertTriangle,
  MagnifyingGlass as Search,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { intlLocale } from "@/lib/intl";
import { pageAuditLog, type AuditRow as AuditRowType } from "@/services/paged";
import { useListData } from "@/hooks/use-list-data";
import { PaginationBar } from "@/components/pagination-bar";

import { BackButton } from "@/components/ui/back-button";

export function AuditLogPage() {
  const [filter, setFilter] = useState<"all" | "license" | "sale" | "void" | "permission">("all");

  const fetcher = useCallback(
    (q: { search?: string; page?: number; pageSize?: number }) =>
      pageAuditLog({ ...q, kind: filter === "all" ? undefined : filter }),
    [filter],
  );
  const list = useListData(fetcher, { pageSize: 50 });
  const entries = list.rows;

  return (
    <div className="space-y-5">
      <div>
        <BackButton fallback="/settings" />
        <h1 className="text-xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Activity history for compliance and security review
        </p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={list.search}
            onChange={(e) => list.setSearch(e.target.value)}
            placeholder="Search description, user, event..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <div className="flex gap-1 border border-border rounded-md p-0.5">
          {(["all", "permission", "sale", "void", "license"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors capitalize ${
                filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {f === "all" ? "All Events" : f === "void" ? "Voids" : `${f}s`}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          {list.total.toLocaleString()} entries
        </span>
      </div>

      {/* Timeline */}
      {list.loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Activity className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No activity yet</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="divide-y divide-border">
            {entries.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}

      <PaginationBar list={list} />
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditRowType }) {
  const time = new Date(entry.created_at).toLocaleString(intlLocale(), {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const { Icon, iconColor, badge } = (() => {
    if (entry.kind === "license") {
      if (entry.event === "failed") {
        return { Icon: ShieldAlert, iconColor: "text-red-600", badge: <Badge variant="destructive">Failed</Badge> };
      }
      if (entry.event === "deactivated") {
        return { Icon: Key, iconColor: "text-amber-600", badge: <Badge variant="outline" className="border-amber-500/50 text-amber-700">Deactivated</Badge> };
      }
      if (entry.event === "activated") {
        return { Icon: ShieldCheck, iconColor: "text-green-600", badge: <Badge className="bg-green-600 hover:bg-green-600">Activated</Badge> };
      }
      return { Icon: ShieldCheck, iconColor: "text-blue-600", badge: <Badge variant="outline">Verified</Badge> };
    }
    if (entry.kind === "void") {
      return { Icon: AlertTriangle, iconColor: "text-amber-600", badge: <Badge variant="destructive">Voided</Badge> };
    }
    if (entry.kind === "permission") {
      const allowed = entry.event !== "denied";
      return {
        Icon: allowed ? ShieldCheck : ShieldAlert,
        iconColor: allowed ? "text-green-600" : "text-red-600",
        badge: <Badge variant={allowed ? "outline" : "destructive"}>{allowed ? "Allowed" : "Denied"}</Badge>,
      };
    }
    return { Icon: Receipt, iconColor: "text-primary", badge: <Badge className="bg-green-600 hover:bg-green-600">Sale</Badge> };
  })();

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30">
      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {badge}
          <span className="text-sm">{entry.description}</span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span>{time}</span>
          {entry.user && <span>· {entry.user}</span>}
          {entry.metadata && entry.kind === "license" && (
            <span className="font-mono inline-flex items-center gap-1">
              <Cpu className="h-3 w-3" />
              {entry.metadata.slice(0, 8)}...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
