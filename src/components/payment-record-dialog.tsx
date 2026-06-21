import { useState } from "react";
import {
  Building as Building2,
  CircleNotch as Loader2,
  CreditCard as CreditCard,
  DeviceMobile as Smartphone,
  Money as Banknote,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PaymentMethod } from "@/services/settlement";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxAmount?: number;
  onSubmit: (data: {
    amount: number;
    method: PaymentMethod;
    reference?: string;
    note?: string;
  }) => Promise<void>;
}

const METHODS: Array<{ value: PaymentMethod; label: string; icon: typeof CreditCard }> = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "mpesa", label: "M-Pesa", icon: Smartphone },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "bank", label: "Bank", icon: Building2 },
];

export function PaymentRecordDialog({ open, onClose, title, subtitle, maxAmount, onSubmit }: Props) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const numAmount = parseFloat(amount) || 0;
  const valid = numAmount > 0 && (!maxAmount || numAmount <= maxAmount);

  const reset = () => {
    setAmount("");
    setMethod("cash");
    setReference("");
    setNote("");
  };

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    try {
      await onSubmit({
        amount: numAmount,
        method,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
      });
      reset();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div>
            <h2 className="font-semibold">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="p-5 space-y-4">
          {/* Amount */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex justify-between">
              Amount <span>{maxAmount ? `Max: KES ${maxAmount.toFixed(0)}` : ""}</span>
            </label>
            <div className="relative">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-xl font-mono h-12 pl-12"
                placeholder="0.00"
                autoFocus
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                KES
              </span>
            </div>
            {maxAmount && numAmount > maxAmount && (
              <p className="text-xs text-red-600">Amount exceeds outstanding balance</p>
            )}
            {maxAmount && (
              <div className="flex gap-1.5">
                {[0.25, 0.5, 1].map((mult) => (
                  <button
                    key={mult}
                    onClick={() => setAmount((maxAmount * mult).toFixed(0))}
                    className="flex-1 px-2 py-1.5 rounded-md border border-border text-xs hover:bg-accent/50"
                  >
                    {mult === 1 ? "Full" : `${mult * 100}%`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Method */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Method</label>
            <div className="grid grid-cols-4 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMethod(m.value)}
                  className={`px-2 py-2 rounded-md border text-xs flex flex-col items-center gap-1 ${
                    method === m.value ? "border-primary bg-primary/5 font-medium" : "border-border"
                  }`}
                >
                  <m.icon className="h-4 w-4" />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reference */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Reference {method === "mpesa" && "(M-Pesa code)"}
              {method === "bank" && "(transaction ref)"}
              {method === "card" && "(receipt #)"}
            </label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={method === "mpesa" ? "e.g. ABC1234567" : "Optional"}
            />
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Note</label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!valid || submitting} className="flex-1">
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Record Payment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
