/**
 * Renders the ai_calls audit table — every AI call with its redacted
 * prompt, model, latency, status, and cost. The point is transparency:
 * any business owner can see exactly what's been sent.
 */
import { useEffect, useState } from "react";
import { listCalls, callStats, type AiCallRow, type CallStats } from "@/services/ai/audit";
import { Badge } from "@/components/ui/badge";
import { Sparkles, AlertCircle, CheckCircle2, Lock, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, { className: string; icon: typeof CheckCircle2 }> = {
  ok: { className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
  error: { className: "bg-rose-500/10 text-rose-600 dark:text-rose-400", icon: AlertCircle },
  rate_limited: { className: "bg-amber-500/10 text-amber-600 dark:text-amber-400", icon: Clock },
  blocked_privacy: { className: "bg-purple-500/10 text-purple-600 dark:text-purple-400", icon: Lock },
  no_provider: { className: "bg-muted text-muted-foreground", icon: AlertCircle },
};

export function AiActivityLog() {
  const [rows, setRows] = useState<AiCallRow[]>([]);
  const [stats, setStats] = useState<CallStats | null>(null);

  useEffect(() => {
    Promise.all([listCalls(50), callStats(30)])
      .then(([r, s]) => { setRows(r); setStats(s); })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Calls (30d)" value={stats.total.toString()} />
          <Stat label="Cache hit %" value={`${stats.cache_hit_pct.toFixed(0)}%`} />
          <Stat label="Tokens used" value={(stats.total_tokens_in + stats.total_tokens_out).toLocaleString()} />
          <Stat label="Cost (30d)" value={`$${stats.total_cost_usd.toFixed(2)}`} />
        </div>
      )}

      {rows.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          <Sparkles className="h-6 w-6 mx-auto mb-2 opacity-40" />
          No AI calls yet. Try clicking a ✨ button anywhere in the app.
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Time</th>
                <th className="text-left px-3 py-2">Feature</th>
                <th className="text-left px-3 py-2">Model</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Tokens</th>
                <th className="text-right px-3 py-2">Cost</th>
                <th className="text-right px-3 py-2">Latency</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const ss = STATUS_STYLE[row.status] ?? STATUS_STYLE.error;
                const Icon = ss.icon;
                return (
                  <tr key={row.id} className="border-t border-border hover:bg-accent/30 transition-colors" title={row.prompt_redacted}>
                    <td className="px-3 py-2 text-muted-foreground font-mono text-[10px]">
                      {new Date(row.created_at).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-2">{row.feature_id}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                      {row.provider_id}/{row.model.split("/").pop()}
                      {row.cache_hit === 1 && <span className="ml-1 text-emerald-600">(cached)</span>}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={cn("text-[10px] gap-1", ss.className)}>
                        <Icon className="h-3 w-3" />
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[11px]">
                      {row.tokens_in ?? 0}<span className="text-muted-foreground"> / </span>{row.tokens_out ?? 0}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[11px]">
                      {row.cost_usd ? `$${row.cost_usd.toFixed(4)}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground font-mono text-[11px]">
                      {row.latency_ms ? `${row.latency_ms}ms` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}
