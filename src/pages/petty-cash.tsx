import { useEffect, useState, useCallback } from "react";
import {
  ArrowCircleDown as ArrowDownCircle,
  ArrowCircleUp as ArrowUpCircle,
  CircleNotch as Loader2,
  Plus,
  Wallet,
  X,
  MagnifyingGlass as Search,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import {
  recordPettyCash, getPettyCashSummary,
  type PettyCashEntry, type PettyCashSummary,
} from "@/services/petty-cash";
import { pagePettyCash } from "@/services/paged";
import { useListData } from "@/hooks/use-list-data";
import { PaginationBar } from "@/components/pagination-bar";
import { useAuthStore } from "@/stores/auth";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { toast } from "sonner";
import { intlLocale } from "@/lib/intl";
import { money } from "@/lib/money";

export function PettyCashPage() {
  const [summary, setSummary] = useState<PettyCashSummary | null>(null);
  const [dialogType, setDialogType] = useState<"topup" | "expense" | null>(null);
  const userId = useAuthStore((s) => s.user?.id);

  const list = useListData(pagePettyCash, { pageSize: 50 });
  const entries = list.rows as unknown as PettyCashEntry[];
  const loading = list.loading;

  const load = useCallback(async () => {
    list.refresh();
    setSummary(await getPettyCashSummary());
  }, [list]);

  useEffect(() => {
    getPettyCashSummary().then(setSummary);
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ fallback: "/banking" }}
        eyebrow="Finance"
        title="Petty cash"
        description="Small float separate from the main till — tea, fuel, paper, etc."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDialogType("expense")}>
              <ArrowDownCircle className="h-4 w-4 mr-2" /> Record expense
            </Button>
            <Button onClick={() => setDialogType("topup")}>
              <Plus className="h-4 w-4 mr-2" /> Top up float
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={list.search}
            onChange={(e) => list.setSearch(e.target.value)}
            placeholder="Search description, category, staff..."
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Current Balance"
          value={money((summary?.current_balance || 0))}
          highlight={(summary?.current_balance || 0) < 0}
          icon={Wallet}
        />
        <StatCard
          label="Total Top-ups"
          value={money((summary?.topup_total || 0))}
          icon={ArrowUpCircle}
          tone="success"
        />
        <StatCard
          label="Total Expenses"
          value={money((summary?.expense_total || 0))}
          icon={ArrowDownCircle}
          tone="warning"
        />
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr className="text-xs text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium">Date</th>
              <th className="text-left px-3 py-2 font-medium">Type</th>
              <th className="text-left px-3 py-2 font-medium">Description</th>
              <th className="text-left px-3 py-2 font-medium">Reference</th>
              <th className="text-left px-3 py-2 font-medium">By</th>
              <th className="text-right px-3 py-2 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableRowSkeleton cells={6} rows={4} />
            ) : entries.length === 0 ? (
              <tr><td colSpan={6} className="p-0">
                <EmptyState
                  icon={Wallet}
                  title="No petty cash entries"
                  description="Top up the float to start tracking small expenses outside the main till."
                  cta={{ label: "Top Up Float", onClick: () => setDialogType("topup"), icon: Plus }}
                />
              </td></tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString(intlLocale(), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      e.type === "topup" ? "bg-emerald-500/10 text-emerald-700" :
                      e.type === "expense" ? "bg-amber-500/10 text-amber-700" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {e.type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">{e.description}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{e.receipt_ref || "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{e.user_name || "—"}</td>
                  <td className={`px-3 py-2.5 text-right font-mono ${e.amount < 0 ? "text-amber-700" : "text-emerald-700"}`}>
                    {e.amount < 0 ? "" : "+"}{e.amount.toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {dialogType && (
        <PettyCashDialog
          type={dialogType}
          onClose={() => setDialogType(null)}
          onSaved={() => { setDialogType(null); load(); }}
          userId={userId!}
        />
      )}

      <PaginationBar list={list} />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone, highlight }: {
  label: string; value: string; icon: any; tone?: "success" | "warning"; highlight?: boolean;
}) {
  const tones = {
    success: "text-emerald-700",
    warning: "text-amber-700",
  };
  return (
    <div className={`border rounded-lg p-3 ${highlight ? "border-red-500/50 bg-red-500/5" : "border-border"}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <p className={`text-xl font-semibold font-mono ${tone ? tones[tone] : ""} ${highlight ? "text-red-700" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function PettyCashDialog({ type, onClose, onSaved, userId }: {
  type: "topup" | "expense"; onClose: () => void; onSaved: () => void; userId: string;
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const a = parseFloat(amount);
    if (!a || a <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }
    setSubmitting(true);
    try {
      await recordPettyCash({
        amount: a,
        type,
        description: description.trim(),
        receipt_ref: reference.trim() || undefined,
        user_id: userId,
      });
      toast.success(`Recorded KES ${a.toFixed(2)}`);
      onSaved();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-semibold">
            {type === "topup" ? "Top Up Petty Cash Float" : "Record Petty Cash Expense"}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="p-5 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Amount</label>
            <div className="relative">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-xl font-mono h-12 pl-12"
                placeholder="0.00"
                autoFocus
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">KES</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {type === "topup" ? "Source / Note" : "What was it for?"}
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === "topup" ? "e.g., From owner cash" : "e.g., Tea & sugar for shop"}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Receipt / Reference (optional)</label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Receipt number or note"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>Cancel</Button>
            <Button onClick={submit} className="flex-1" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {type === "topup" ? "Top Up" : "Record Expense"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
