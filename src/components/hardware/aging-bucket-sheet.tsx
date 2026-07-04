/**
 * AgingBucketSheet — surfaces WHICH contractors owe in a given aging
 * bucket when a KPI tile is clicked. Row click navigates to that
 * contractor's detail page.
 */
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { customersInAgingBucket, type AgingCustomerRow } from "@/services/hardware";
import { useNavigate } from "react-router-dom";
import { money as KES } from "@/lib/money";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  bucket: "current" | "d1_30" | "d31_60" | "d61_90" | "d90_plus" | null;
}

const LABEL: Record<string, string> = {
  current: "Current",
  d1_30: "1–30 days",
  d31_60: "31–60 days",
  d61_90: "61–90 days",
  d90_plus: "90+ days",
};

export function AgingBucketSheet({ open, onClose, bucket }: Props) {
  const [rows, setRows] = useState<AgingCustomerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open || !bucket) return;
    setLoading(true);
    customersInAgingBucket(bucket)
      .then(setRows)
      .catch((e) => toast.error(String(e)))
      .finally(() => setLoading(false));
  }, [open, bucket]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-5 pt-5">
          <SheetTitle>Outstanding · {bucket ? LABEL[bucket] : "—"}</SheetTitle>
          <SheetDescription>
            Contractors with unpaid charges in this age bucket.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground italic">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground italic">
              No contractors owe in this bucket.
            </div>
          ) : (
            <ul>
              {rows.map((r) => (
                <li
                  key={r.customer_id}
                  onClick={() => { navigate(`/hardware/accounts/${r.customer_id}`); onClose(); }}
                  className="px-5 py-3 border-b border-border cursor-pointer hover:bg-accent/40 flex items-center justify-between"
                >
                  <span className="text-sm font-medium">{r.name}</span>
                  <span className="font-mono tabular-nums text-sm">{KES(r.outstanding)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
