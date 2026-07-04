/**
 * RecordPaymentDialog — post a payment against a contractor's account.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { postPayment } from "@/services/hardware";
import { useAuthStore } from "@/stores/auth";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  customerId: string;
  customerName: string;
  outstandingBalance: number;
}

export function RecordPaymentDialog({ open, onClose, onSaved, customerId, customerName, outstandingBalance }: Props) {
  const userId = useAuthStore((s) => s.user?.id);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(outstandingBalance > 0 ? String(outstandingBalance) : "");
      setMethod("cash");
      setReference("");
    }
  }, [open, outstandingBalance]);

  const save = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }
    setSaving(true);
    try {
      await postPayment(customerId, n, { reference: `${method}${reference ? ` · ${reference}` : ""}`, userId });
      toast.success(`Payment of ${n.toLocaleString()} recorded`);
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
          <DialogTitle>Record payment · {customerName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Amount (KES)</span>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono text-lg"
              autoFocus
            />
            {outstandingBalance > 0 ? (
              <span className="text-[10px] text-muted-foreground">Outstanding: KES {outstandingBalance.toLocaleString()}</span>
            ) : null}
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Method</span>
            <Select value={method} onValueChange={(v) => setMethod(String(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="mpesa">M-Pesa</SelectItem>
                <SelectItem value="bank">Bank transfer</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Reference (optional)</span>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="M-Pesa code, cheque #, txn id" />
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Recording…" : "Record payment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
