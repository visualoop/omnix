import { useState, useEffect } from "react";
import {
  Pulse as Activity,
  Cpu,
  Funnel as Filter,
  Key as Key,
  Receipt,
  ShieldWarning as ShieldAlert,
  ShieldCheck,
  Warning as AlertTriangle,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { query } from "@/lib/db";
import { intlLocale } from "@/lib/intl";

interface AuditEntry {
  id: string;
  type: "license" | "sale" | "void" | "permission";
  event: string;
  description: string;
  user: string | null;
  metadata: string | null;
  created_at: string;
}

export function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [filter, setFilter] = useState<"all" | "license" | "sale" | "void" | "permission">("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);

    const licenseEvents = await query<{
      id: string;
      license_kid: string;
      machine_fingerprint: string;
      event: string;
      error_message: string | null;
      created_at: string;
    }>(
      "SELECT * FROM license_activations ORDER BY created_at DESC LIMIT 100"
    );

    const saleEvents = await query<{
      id: string;
      sale_number: number;
      total: number;
      status: string;
      created_at: string;
      cashier: string | null;
    }>(
      `SELECT s.id, s.sale_number, s.total, s.status, s.created_at, u.full_name as cashier
       FROM sales s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.status != 'held'
       ORDER BY s.created_at DESC LIMIT 100`
    );

    const permissionEvents = await query<{
      id: string;
      user_name: string | null;
      permission_key: string;
      outcome: string;
      risk_level: string;
      entity_type: string | null;
      entity_id: string | null;
      created_at: string;
    }>(
      "SELECT id, user_name, permission_key, outcome, risk_level, entity_type, entity_id, created_at FROM audit_log ORDER BY created_at DESC LIMIT 100"
    );

    const all: AuditEntry[] = [
      ...permissionEvents.map((e) => ({
        id: `perm-${e.id}`,
        type: "permission" as const,
        event: e.outcome,
        description:
          `${e.outcome === "denied" ? "Blocked" : "Allowed"}: ${e.permission_key}` +
          (e.entity_type ? ` on ${e.entity_type}${e.entity_id ? ` ${e.entity_id}` : ""}` : "") +
          ` (${e.risk_level})`,
        user: e.user_name,
        metadata: null,
        created_at: e.created_at,
      })),
      ...licenseEvents.map((e) => ({
        id: `lic-${e.id}`,
        type: "license" as const,
        event: e.event,
        description:
          e.event === "activated" ? `License activated: ${e.license_kid}` :
          e.event === "verified" ? `License verified: ${e.license_kid}` :
          e.event === "deactivated" ? `License deactivated: ${e.license_kid}` :
          e.event === "failed" ? `License verification failed: ${e.error_message || "unknown"}` :
          `License event: ${e.event}`,
        user: null,
        metadata: e.machine_fingerprint,
        created_at: e.created_at,
      })),
      ...saleEvents.map((e) => ({
        id: `sale-${e.id}`,
        type: e.status === "voided" ? "void" as const : "sale" as const,
        event: e.status === "voided" ? "voided" : "completed",
        description: e.status === "voided"
          ? `Sale #${e.sale_number} voided (${e.total.toFixed(2)})`
          : `Sale #${e.sale_number} (${e.total.toFixed(2)})`,
        user: e.cashier,
        metadata: null,
        created_at: e.created_at,
      })),
    ];

    all.sort((a, b) => b.created_at.localeCompare(a.created_at));
    setEntries(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === "all" ? entries : entries.filter((e) => e.type === filter);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Activity history for compliance and security review
        </p>
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
          {filtered.length} entries
        </span>
      </div>

      {/* Timeline */}
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Activity className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No activity yet</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const time = new Date(entry.created_at).toLocaleString(intlLocale(), {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const { Icon, iconColor, badge } = (() => {
    if (entry.type === "license") {
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
    if (entry.type === "void") {
      return { Icon: AlertTriangle, iconColor: "text-amber-600", badge: <Badge variant="destructive">Voided</Badge> };
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
          {entry.metadata && entry.type === "license" && (
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
