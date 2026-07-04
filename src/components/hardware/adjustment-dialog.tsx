/**
 * AdjustmentDialog — post a manual adjustment to a contractor's
 * ledger. Positive = charge, negative = credit / write-off.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { postAdjustment } from "@/services/hardware";
import { useAuthStore } from "@/stores/auth";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  customerId: string;
  customerName: string;
}

export function AdjustmentDialog({ open, onClose, onSaved, customerId, customerName }: Props) {
  const userId = useAuthStore((s) => s.user?.id);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setAmount(""); setReason(""); }
  }, [open]);

  const save = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n === 0) {
      toast.error("Amount required (positive to charge, negative to credit)");
      return;
    }
    if (!reason.trim()) {
      toast.error("Reason required for audit trail");
      return;
    }
    setSaving(true);
    try {
      await postAdjustment(customerId, n, reason.trim(), userId);
      toast.success("Adjustment posted");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjustment · {customerName}</DialogTitle>
          <DialogDescription>
            Positive amount adds to the balance (charge). Negative subtracts (credit / write-off). Reason is stored in the ledger.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Amount (KES)</span>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="font-mono text-lg" placeholder="500 or -500" autoFocus />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Reason</span>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Write-off bad debt / opening balance / correction" />
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Posting…" : "Post adjustment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
