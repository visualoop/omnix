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
import { useActiveCountry } from "@/stores/country";
import { currencySymbol, money } from "@/lib/money";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  customerId: string;
  customerName: string;
  outstandingBalance: number;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash", card: "Card", bank: "Bank transfer", mpesa: "M-Pesa", airtel_money: "Airtel Money",
  mtn_momo: "MTN MoMo", tigo_pesa: "Tigo Pesa", wave: "Wave", interac: "Interac",
  venmo: "Venmo", cash_app: "Cash App", upi: "UPI", paytm: "Paytm", stk_push: "Mobile money",
};

export function RecordPaymentDialog({ open, onClose, onSaved, customerId, customerName, outstandingBalance }: Props) {
  const userId = useAuthStore((s) => s.user?.id);
  const { profile } = useActiveCountry();
  const paymentMethods = profile?.paymentMethods ?? ["cash", "card", "bank"] as const;
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(outstandingBalance > 0 ? String(outstandingBalance) : "");
      setMethod(paymentMethods[0] ?? "cash");
      setReference("");
    }
  }, [open, outstandingBalance, profile]);

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
      <DialogContent className="w-[calc(100vw-1rem)] max-w-sm">
        <DialogHeader>
          <DialogTitle>Record payment · {customerName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Amount ({currencySymbol()})</span>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono text-lg"
              autoFocus
            />
            {outstandingBalance > 0 ? (
              <span className="text-[10px] text-muted-foreground">Outstanding: {money(outstandingBalance)}</span>
            ) : null}
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Method</span>
            <Select value={method} onValueChange={(v) => setMethod(String(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {paymentMethods.map((paymentMethod) => <SelectItem key={paymentMethod} value={paymentMethod}>{PAYMENT_LABELS[paymentMethod] ?? paymentMethod.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Reference (optional)</span>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Receipt, transfer, or transaction ID" />
          </label>
        </div>
        <DialogFooter className="[&_button]:h-11 lg:[&_button]:h-9">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Recording…" : "Record payment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
