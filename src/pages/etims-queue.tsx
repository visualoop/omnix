import { useState, useEffect } from "react";
import {
  ArrowsClockwise as RefreshCw,
  CheckCircle as CheckCircle2,
  Clock,
  FileText as FileCheck,
  Warning as AlertTriangle,
  XCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { getRecentInvoices, retryQueuedInvoices, type EtimsInvoice } from "@/services/etims";
import { Badge } from "@/components/ui/badge";
import { AiButton } from "@/components/ai/AiButton";
import { AiSuggestionDialog } from "@/components/ai/AiSuggestionDialog";
import { ai, type EtimsExplanation } from "@/services/ai";
import { toast } from "sonner";
import { intlLocale } from "@/lib/intl";

export function EtimsQueuePage() {
  const [invoices, setInvoices] = useState<EtimsInvoice[]>([]);
  const [filter, setFilter] = useState<"all" | "signed" | "queued" | "failed" | "pending">("all");
  const [explanation, setExplanation] = useState<{ invoice: string; result: EtimsExplanation } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await getRecentInvoices(200);
    setInvoices(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleRetry = async () => {
    setRetrying(true);
    const result = await retryQueuedInvoices();
    setRetrying(false);
    if (result.retried === 0) {
      toast.info("No queued invoices to retry");
    } else {
      toast.success(`Retried ${result.retried}, ${result.succeeded} signed successfully`);
    }
    load();
  };

  const filtered = filter === "all" ? invoices : invoices.filter(i => i.status === filter);

  const stats = {
    total: invoices.length,
    signed: invoices.filter(i => i.status === "signed").length,
    queued: invoices.filter(i => i.status === "queued").length,
    failed: invoices.filter(i => i.status === "failed").length,
    pending: invoices.filter(i => i.status === "pending").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">eTIMS Submissions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All tax invoices submitted to KRA
          </p>
        </div>
        <Button onClick={handleRetry} disabled={retrying || stats.queued === 0}>
          <RefreshCw className={`h-4 w-4 mr-2 ${retrying ? "animate-spin" : ""}`} />
          Retry Queued ({stats.queued})
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard label="Total" value={stats.total} icon={FileCheck} />
        <StatCard label="Signed" value={stats.signed} icon={CheckCircle2} color="green" />
        <StatCard label="Queued" value={stats.queued} icon={Clock} color="amber" />
        <StatCard label="Failed" value={stats.failed} icon={XCircle} color="red" />
        <StatCard label="Pending" value={stats.pending} icon={AlertTriangle} color="blue" />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { id: "all", label: `All (${stats.total})` },
          { id: "signed", label: `Signed (${stats.signed})` },
          { id: "queued", label: `Queued (${stats.queued})` },
          { id: "failed", label: `Failed (${stats.failed})` },
          { id: "pending", label: `Pending (${stats.pending})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id as typeof filter)}
            className={`px-3 py-2 text-sm transition-colors ${
              filter === t.id
                ? "border-b-2 border-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <p className="text-center text-sm text-muted-foreground py-12">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No invoices in this category</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">Invoice #</th>
                <th className="text-left px-3 py-2 font-medium">KRA Receipt</th>
                <th className="text-left px-3 py-2 font-medium">Buyer</th>
                <th className="text-right px-3 py-2 font-medium">Tax</th>
                <th className="text-right px-3 py-2 font-medium">Total</th>
                <th className="text-center px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2.5 font-mono text-xs">{inv.invoice_number}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    {inv.kra_invoice_no || <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {inv.buyer_name || <span className="text-muted-foreground">Walk-in</span>}
                    {inv.buyer_pin && (
                      <span className="text-xs text-muted-foreground ml-1.5 font-mono">{inv.buyer_pin}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">{inv.tax_amount.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-medium">{inv.total.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <StatusBadge status={inv.status} retryCount={inv.retry_count} />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(inv.created_at).toLocaleString(intlLocale(), {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Error details */}
      {filtered.some(i => i.error_message) && (
        <details className="border border-border rounded-lg p-3">
          <summary className="text-sm font-medium cursor-pointer">Recent errors</summary>
          <div className="mt-2 space-y-1">
            {filtered.filter(i => i.error_message).slice(0, 5).map((inv) => (
              <div key={inv.id} className="text-xs flex items-start gap-2">
                <span className="font-mono text-muted-foreground">{inv.invoice_number}:</span>
                <span className="text-red-600 flex-1">{inv.error_message}</span>
                <AiButton
                  hint="Explain this error in plain English"
                  size="sm"
                  variant="ghost"
                  onRun={async () => {
                    const result = await ai.explainEtims("ETIMS_FAIL", inv.error_message ?? "");
                    setExplanation({ invoice: inv.invoice_number, result });
                  }}
                />
              </div>
            ))}
          </div>
        </details>
      )}

      {explanation && (
        <AiSuggestionDialog<EtimsExplanation>
          open={!!explanation}
          onOpenChange={(v) => !v && setExplanation(null)}
          title={`Explain: ${explanation.invoice}`}
          suggestion={explanation.result}
          meta={null}
          onApply={() => setExplanation(null)}
          applyLabel="Got it"
          renderPreview={(s) => (
            <div className="space-y-3">
              <div className="text-sm font-medium">{s.summary}</div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">severity: {s.severity}</Badge>
                <Badge variant="outline" className="text-[10px]">owner: {s.owner}</Badge>
              </div>
              <ol className="text-sm list-decimal list-inside space-y-1">
                {s.steps.map((step, i) => (<li key={i}>{step}</li>))}
              </ol>
            </div>
          )}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color = "default",
}: {
  label: string;
  value: number;
  icon: typeof FileCheck;
  color?: "default" | "green" | "amber" | "red" | "blue";
}) {
  const colorClass = {
    default: "text-muted-foreground bg-muted/30",
    green: "text-green-600 bg-green-500/10",
    amber: "text-amber-600 bg-amber-500/10",
    red: "text-red-600 bg-red-500/10",
    blue: "text-blue-600 bg-blue-500/10",
  }[color];

  return (
    <div className="border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className={`h-6 w-6 rounded-md flex items-center justify-center ${colorClass}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="text-2xl font-semibold font-mono">{value}</p>
    </div>
  );
}

function StatusBadge({ status, retryCount }: { status: string; retryCount: number }) {
  if (status === "signed") return <Badge variant="default" className="bg-green-600 hover:bg-green-600">Signed</Badge>;
  if (status === "queued") return (
    <Badge variant="outline" className="border-amber-500/50 text-amber-700">
      Queued{retryCount > 0 ? ` (${retryCount})` : ""}
    </Badge>
  );
  if (status === "failed") return <Badge variant="destructive">Failed</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
}
