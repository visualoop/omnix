import { useEffect, useState } from "react";
import {
  ArrowsLeftRight as ArrowRightLeft,
  Check,
  Plus,
  Truck,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { listTransfers, type StockTransferWithDetails } from "@/services/stock-transfers";
import { useActiveBranch } from "@/stores/active-branch";
import { useNavigate } from "react-router-dom";
import { intlLocale } from "@/lib/intl";

export function StockTransfersPage() {
  const [transfers, setTransfers] = useState<StockTransferWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const branchId = useActiveBranch((s) => s.active?.id);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      setTransfers(await listTransfers(branchId));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [branchId]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations"
        title="Stock transfers"
        description="Move stock between branches. Source decrements when dispatched; destination increments when received."
        actions={
          <Button onClick={() => navigate("/stock-transfers/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> New transfer
          </Button>
        }
      />

      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Number</th>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">From → To</th>
              <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Items</th>
              <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Qty</th>
              <th className="text-center px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableRowSkeleton cells={6} rows={3} />
            ) : transfers.length === 0 ? (
              <tr><td colSpan={6} className="p-0">
                <EmptyState
                  icon={ArrowRightLeft}
                  title="No transfers yet"
                  description="Move stock between branches to balance inventory across locations."
                  cta={{ label: "Create transfer", onClick: () => navigate("/stock-transfers/new"), icon: Plus }}
                />
              </td></tr>
            ) : (
              transfers.map((t) => {
                const isOutgoing = t.from_branch_id === branchId;
                return (
                  <tr
                    key={t.id}
                    className="border-b border-border/60 hover:bg-accent/30 cursor-pointer"
                    onClick={() => navigate(`/stock-transfers/${t.id}`)}
                  >
                    <td className="px-3 py-2 font-mono text-xs">{t.transfer_number}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(t.transfer_date).toLocaleDateString(intlLocale(), { day: "2-digit", month: "short" })}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className={isOutgoing ? "text-amber-700" : "text-emerald-700"}>{t.from_branch_name}</span>
                        <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                        <span className={!isOutgoing ? "text-amber-700" : "text-emerald-700"}>{t.to_branch_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">{t.item_count}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">{t.total_quantity}</td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: StockTransferWithDetails["status"] }) {
  switch (status) {
    case "draft":
      return <Badge variant="outline">Draft</Badge>;
    case "in_transit":
      return <Badge className="bg-amber-500 hover:bg-amber-500"><Truck className="h-2.5 w-2.5 mr-0.5" /> In Transit</Badge>;
    case "received":
      return <Badge className="bg-emerald-600 hover:bg-emerald-600"><Check className="h-2.5 w-2.5 mr-0.5" /> Received</Badge>;
    case "cancelled":
      return <Badge variant="destructive">Cancelled</Badge>;
  }
}
