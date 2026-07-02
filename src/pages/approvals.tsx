import { useEffect, useState, useCallback } from "react";
import { CheckCircle, Check, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  listPending,
  approve,
  reject,
  type ApprovalRequest,
} from "@/services/approvals";
import { useAuthStore } from "@/stores/auth";
import { intlLocale } from "@/lib/intl";

import { BackButton } from "@/components/ui/back-button";
const KIND_LABEL: Record<string, string> = {
  purchase_order: "Purchase order",
  expense: "Expense",
  stock_transfer: "Stock transfer",
  debit_note: "Debit note",
};

export function ApprovalsPage() {
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await listPending()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmt = (n: number) => n.toLocaleString(intlLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleApprove = async (r: ApprovalRequest) => {
    if (!user) return;
    await approve(r.id, user.id);
    toast.success("Approved");
    load();
  };
  const handleReject = async (r: ApprovalRequest) => {
    if (!user) return;
    await reject(r.id, user.id, "Rejected via approvals page");
    toast.success("Rejected");
    load();
  };

  return (
    <div className="max-w-3xl space-y-5">
      <header>
        <BackButton fallback="/" />
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-primary" /> Approvals
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Purchase orders + expenses waiting for sign-off. Thresholds set in <span className="font-mono">approval_rules</span>.
        </p>
      </header>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center">
          <CheckCircle className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <div className="text-sm text-muted-foreground">Nothing waiting for approval.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <div key={r.id} className="rounded-md border border-border p-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="text-[13.5px] font-medium">
                  {KIND_LABEL[r.kind] ?? r.kind} · <span className="font-mono">{fmt(r.amount)}</span>
                </div>
                <div className="text-[11.5px] text-muted-foreground">
                  Requested {new Date(r.requested_at + "Z").toLocaleString(intlLocale())} · Resource {r.resource_id.slice(0, 8)}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleApprove(r)}>
                <Check className="h-3.5 w-3.5 mr-1" /> Approve
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleReject(r)}>
                <X className="h-3.5 w-3.5 mr-1" /> Reject
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
