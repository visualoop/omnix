import { useState, useEffect } from "react";
import {
  Shield,
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Download,
  Banknote,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  listClaims,
  getClaim,
  getClaimItems,
  updateClaimStatus,
  getInsuranceStats,
  getProviders,
  createBatch,
  listBatches,
  settleBatch,
  type InsuranceClaim,
  type InsuranceClaimItem,
  type InsuranceProvider,
  type InsuranceBatch,
} from "@/services/insurance";
import { exportToCSV } from "@/lib/export";
import { toast } from "sonner";
import { prompt } from "@/components/ui/confirm-dialog";

export function ClaimsPage() {
  const [tab, setTab] = useState<"claims" | "batches">("claims");
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [batches, setBatches] = useState<InsuranceBatch[]>([]);
  const [stats, setStats] = useState<{
    total_outstanding: number;
    draft_count: number;
    submitted_count: number;
    paid_this_month: number;
    rejected_count: number;
  } | null>(null);
  const [providers, setProviders] = useState<InsuranceProvider[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [activeClaim, setActiveClaim] = useState<InsuranceClaim | null>(null);
  const [showBatchDialog, setShowBatchDialog] = useState(false);

  const load = async () => {
    setStats(await getInsuranceStats());
    setProviders(await getProviders(false));
    const filter: { status?: string; provider_id?: string } = {};
    if (statusFilter !== "all") filter.status = statusFilter;
    if (providerFilter !== "all") filter.provider_id = providerFilter;
    setClaims(await listClaims(filter));
    setBatches(await listBatches());
  };

  useEffect(() => { load(); }, [statusFilter, providerFilter]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Insurance Claims</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage claims and submission batches
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportToCSV(`claims-${new Date().toISOString().slice(0,10)}`, claims)}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          <Button onClick={() => setShowBatchDialog(true)} disabled={(stats?.draft_count ?? 0) === 0}>
            <Send className="h-4 w-4 mr-2" /> Submit Batch
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-3">
          <StatCard
            label="Outstanding"
            value={`KES ${stats.total_outstanding.toFixed(0)}`}
            icon={Banknote}
            color="amber"
          />
          <StatCard label="Draft" value={String(stats.draft_count)} icon={FileText} />
          <StatCard label="Submitted" value={String(stats.submitted_count)} icon={Send} color="blue" />
          <StatCard
            label="Paid This Month"
            value={`KES ${stats.paid_this_month.toFixed(0)}`}
            icon={CheckCircle2}
            color="green"
          />
          <StatCard label="Rejected" value={String(stats.rejected_count)} icon={XCircle} color="red" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { id: "claims", label: `Claims (${claims.length})` },
          { id: "batches", label: `Batches (${batches.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`px-3 py-2 text-sm transition-colors ${
              tab === t.id
                ? "border-b-2 border-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "claims" && (
        <>
          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="all">All Providers</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Claims table */}
          {claims.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No claims found</p>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b border-border">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left px-3 py-2 font-medium">Member</th>
                    <th className="text-left px-3 py-2 font-medium">Provider</th>
                    <th className="text-right px-3 py-2 font-medium">Total</th>
                    <th className="text-right px-3 py-2 font-medium">Claim</th>
                    <th className="text-right px-3 py-2 font-medium">Paid</th>
                    <th className="text-center px-3 py-2 font-medium">Status</th>
                    <th className="text-left px-3 py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                      onClick={() => setActiveClaim(c)}
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{c.member_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{c.member_number}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline">{c.provider_code}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">{c.gross_amount.toFixed(0)}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-medium">{c.claim_amount.toFixed(0)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-green-700">{c.paid_amount.toFixed(0)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <ClaimStatusBadge status={c.status} />
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(c.created_at).toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "batches" && (
        <BatchesTab batches={batches} onSettled={load} />
      )}

      {/* Claim detail panel */}
      <Sheet open={!!activeClaim} onOpenChange={(o) => !o && setActiveClaim(null)}>
        <SheetContent side="right" className="w-[520px] sm:max-w-[520px]">
          <SheetHeader>
            <SheetTitle>Claim Detail</SheetTitle>
          </SheetHeader>
          {activeClaim && <ClaimDetail claim={activeClaim} onUpdated={() => { load(); setActiveClaim(null); }} />}
        </SheetContent>
      </Sheet>

      {/* Batch dialog */}
      {showBatchDialog && (
        <BatchDialog
          providers={providers}
          onClose={() => setShowBatchDialog(false)}
          onCreated={() => { load(); setShowBatchDialog(false); }}
        />
      )}
    </div>
  );
}

function ClaimStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "" },
    submitted: { label: "Submitted", className: "border-blue-500/50 text-blue-700" },
    approved: { label: "Approved", className: "border-green-500/50 text-green-700" },
    partially_paid: { label: "Partial", className: "border-amber-500/50 text-amber-700" },
    paid: { label: "Paid", className: "bg-green-600 hover:bg-green-600 text-white" },
    rejected: { label: "Rejected", className: "" },
    cancelled: { label: "Cancelled", className: "" },
  };
  const c = config[status] || { label: status, className: "" };
  if (status === "paid") return <Badge className={c.className}>{c.label}</Badge>;
  if (status === "rejected" || status === "cancelled") return <Badge variant="destructive">{c.label}</Badge>;
  if (status === "draft") return <Badge variant="secondary">{c.label}</Badge>;
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
}

function StatCard({
  label, value, icon: Icon, color = "default",
}: {
  label: string; value: string; icon: typeof Shield; color?: "default" | "green" | "amber" | "red" | "blue";
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
      <p className="text-xl font-semibold font-mono truncate">{value}</p>
    </div>
  );
}

function ClaimDetail({ claim, onUpdated }: { claim: InsuranceClaim; onUpdated: () => void }) {
  const [items, setItems] = useState<InsuranceClaimItem[]>([]);
  const [paidAmount, setPaidAmount] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    getClaimItems(claim.id).then(setItems);
    setPaidAmount(claim.claim_amount.toString());
  }, [claim.id]);

  const refresh = async () => {
    const updated = await getClaim(claim.id);
    if (updated) onUpdated();
  };

  const markPaid = async () => {
    const amt = parseFloat(paidAmount);
    if (!amt || amt <= 0) { toast.error("Enter amount paid"); return; }
    const status = amt >= claim.claim_amount ? "paid" : "partially_paid";
    await updateClaimStatus(claim.id, status, { paid_amount: amt, approved_amount: amt });
    toast.success("Marked " + status);
    refresh();
  };

  const markRejected = async () => {
    if (!rejectionReason) { toast.error("Enter rejection reason"); return; }
    await updateClaimStatus(claim.id, "rejected", { rejection_reason: rejectionReason });
    toast.success("Marked rejected");
    refresh();
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="border border-border rounded-lg p-4 space-y-1">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium">{claim.member_name}</p>
            <p className="text-xs text-muted-foreground font-mono">{claim.member_number}</p>
          </div>
          <ClaimStatusBadge status={claim.status} />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline">{claim.provider_code}</Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(claim.created_at).toLocaleString("en-KE")}
          </span>
        </div>
        {claim.claim_number && (
          <p className="text-xs mt-2">
            Claim #: <span className="font-mono">{claim.claim_number}</span>
          </p>
        )}
      </div>

      {/* Amounts */}
      <div className="border border-border rounded-lg p-4 space-y-1.5">
        <Row label="Gross Amount" value={claim.gross_amount} />
        <Row label="Member Copay" value={claim.copay_amount} />
        <Row label="Insurance Claim" value={claim.claim_amount} bold />
        {claim.approved_amount !== null && (
          <Row label="Approved" value={claim.approved_amount} highlight="green" />
        )}
        {claim.paid_amount > 0 && (
          <Row label="Paid" value={claim.paid_amount} highlight="green" bold />
        )}
      </div>

      {/* Items */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="bg-muted/30 px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Line Items ({items.length})
        </div>
        <div className="divide-y divide-border">
          {items.map((it) => (
            <div key={it.id} className="px-3 py-2 flex justify-between text-sm">
              <div>
                <p className="font-medium">{it.product_name}</p>
                <p className="text-xs text-muted-foreground">
                  {it.quantity} × {it.unit_price.toFixed(2)}
                </p>
              </div>
              <p className="font-mono">{it.line_total.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>

      {claim.rejection_reason && (
        <div className="border border-red-500/50 bg-red-500/5 rounded-md p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium">Rejected</p>
            <p className="text-xs text-muted-foreground mt-0.5">{claim.rejection_reason}</p>
          </div>
        </div>
      )}

      {/* Actions for non-final states */}
      {(claim.status === "submitted" || claim.status === "approved" || claim.status === "partially_paid") && (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Mark Paid Amount</label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="font-mono"
              />
              <Button onClick={markPaid}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Mark Paid
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Reject Reason</label>
            <div className="flex gap-2">
              <Input
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Member not eligible"
              />
              <Button variant="destructive" onClick={markRejected}>Reject</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label, value, bold, highlight,
}: {
  label: string; value: number; bold?: boolean; highlight?: "green" | "amber";
}) {
  const colorClass = highlight === "green" ? "text-green-700" : highlight === "amber" ? "text-amber-700" : "";
  return (
    <div className="flex justify-between items-center text-sm">
      <span className={`${bold ? "font-medium" : "text-muted-foreground"} ${colorClass}`}>{label}</span>
      <span className={`font-mono ${bold ? "font-semibold" : ""} ${colorClass}`}>
        KES {value.toFixed(2)}
      </span>
    </div>
  );
}

function BatchesTab({ batches, onSettled }: { batches: InsuranceBatch[]; onSettled: () => void }) {
  if (batches.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Send className="h-10 w-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No batches yet</p>
        <p className="text-xs mt-1">Create one from draft claims</p>
      </div>
    );
  }

  const handleSettle = async (batchId: string, totalAmount: number) => {
    const input = await prompt({ title: "Settle batch", description: `Enter the settled amount`, defaultValue: totalAmount.toFixed(2), placeholder: "Amount (KES)", required: true });
    if (!input) return;
    const amt = parseFloat(input);
    if (isNaN(amt)) return;
    await settleBatch(batchId, amt);
    toast.success("Batch settled");
    onSettled();
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 border-b border-border">
          <tr className="text-xs text-muted-foreground">
            <th className="text-left px-3 py-2 font-medium">Batch #</th>
            <th className="text-left px-3 py-2 font-medium">Provider</th>
            <th className="text-left px-3 py-2 font-medium">Period</th>
            <th className="text-right px-3 py-2 font-medium">Claims</th>
            <th className="text-right px-3 py-2 font-medium">Total</th>
            <th className="text-right px-3 py-2 font-medium">Settled</th>
            <th className="text-center px-3 py-2 font-medium">Status</th>
            <th className="text-right px-3 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {batches.map((b) => (
            <tr key={b.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2.5 font-mono text-xs">{b.batch_number}</td>
              <td className="px-3 py-2.5">{b.provider_name}</td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">
                {b.period_start} → {b.period_end}
              </td>
              <td className="px-3 py-2.5 text-right font-mono">{b.claim_count}</td>
              <td className="px-3 py-2.5 text-right font-mono">{b.total_amount.toFixed(0)}</td>
              <td className="px-3 py-2.5 text-right font-mono text-green-700">
                {b.settled_amount?.toFixed(0) || "—"}
              </td>
              <td className="px-3 py-2.5 text-center">
                {b.status === "settled" ? (
                  <Badge className="bg-green-600 hover:bg-green-600">Settled</Badge>
                ) : b.status === "submitted" ? (
                  <Badge variant="outline" className="border-blue-500/50 text-blue-700">
                    <Clock className="h-3 w-3 mr-1" /> Pending
                  </Badge>
                ) : (
                  <Badge variant="secondary">{b.status}</Badge>
                )}
              </td>
              <td className="px-3 py-2.5 text-right">
                {b.status !== "settled" && (
                  <Button size="sm" variant="ghost" onClick={() => handleSettle(b.id, b.total_amount)}>
                    Settle
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BatchDialog({
  providers, onClose, onCreated,
}: {
  providers: InsuranceProvider[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [providerId, setProviderId] = useState(providers.find((p) => p.active === 1)?.id || "");
  const [start, setStart] = useState(monthStart);
  const [end, setEnd] = useState(monthEnd);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!providerId) return;
    setCreating(true);
    try {
      await createBatch(providerId, start, end);
      toast.success("Batch created");
      onCreated();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg p-5 w-[420px] space-y-4">
        <h3 className="font-semibold">Create Submission Batch</h3>
        <p className="text-xs text-muted-foreground">
          Bundle all draft claims for a provider in this period into a single submission batch.
        </p>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Provider</label>
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {providers.filter((p) => p.active === 1).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleCreate} disabled={creating || !providerId} className="flex-1">
            {creating ? "Creating..." : "Create Batch"}
          </Button>
        </div>
      </div>
    </div>
  );
}
