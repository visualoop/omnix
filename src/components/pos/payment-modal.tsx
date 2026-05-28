import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCartStore } from "@/stores/cart";
import { useAuthStore } from "@/stores/auth";
import { completeSale, getPaymentMethods, type PaymentMethod, type PaymentEntry } from "@/services/sales";
import { getPaystackConfig } from "@/services/paystack";
import { createClaim, type InsuranceProvider, type InsuranceMember } from "@/services/insurance";
import { buildReceiptData, printReceipt } from "@/services/receipt";
import { PaystackMpesaCharge } from "@/components/pos/paystack-mpesa";
import { InsuranceVerifyPanel } from "@/components/pos/insurance-verify";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface InsuranceState {
  provider: InsuranceProvider;
  member: InsuranceMember;
  copay: number;
  claim: number;
}

export function PaymentModal({ open, onClose }: Props) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>("cash");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [paystackActive, setPaystackActive] = useState(false);
  const [showStkPush, setShowStkPush] = useState(false);
  const [showInsuranceVerify, setShowInsuranceVerify] = useState(false);
  const [insurance, setInsurance] = useState<InsuranceState | null>(null);

  const { items, customerId, cartDiscountAmount, grandTotal, clear, tip, tipEmployeeId } = useCartStore();
  const user = useAuthStore((s) => s.user);
  const total = grandTotal();
  const paidSoFar = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = total - paidSoFar;

  useEffect(() => {
    if (open) {
      getPaymentMethods().then(setMethods);
      getPaystackConfig().then((c) => setPaystackActive(!!c?.active));
      setPayments([]);
      setAmount(String(total.toFixed(2)));
      setReference("");
      setShowStkPush(false);
      setShowInsuranceVerify(false);
      setInsurance(null);
    }
  }, [open, total]);

  // When user clicks Insurance method, open verification panel
  const handleSelectMethod = (id: string) => {
    setSelectedMethod(id);
    if (id === "insurance" && !insurance) {
      setShowInsuranceVerify(true);
    }
  };

  const handleInsuranceConfirmed = (data: InsuranceState) => {
    setInsurance(data);
    setShowInsuranceVerify(false);
    // Add claim portion as insurance payment
    setPayments([{
      method_id: "insurance",
      method_name: `${data.provider.code} - ${data.member.full_name}`,
      amount: data.claim,
      reference: data.member.member_number,
    }]);
    // Member still needs to pay copay
    setAmount(String(data.copay.toFixed(2)));
    setSelectedMethod("cash");
  };

  const addPayment = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error("Enter amount"); return; }
    const method = methods.find((m) => m.id === selectedMethod);
    if (!method) return;
    setPayments([...payments, { method_id: method.id, method_name: method.name, amount: amt, reference: reference || undefined }]);
    setAmount(String(Math.max(0, remaining - amt).toFixed(2)));
    setReference("");
  };

  const handleComplete = async () => {
    const finalPayments = payments.length > 0 ? payments : [{
      method_id: selectedMethod,
      method_name: methods.find((m) => m.id === selectedMethod)?.name || "Cash",
      amount: parseFloat(amount) || total,
    }];

    setProcessing(true);
    try {
      const { saleId, saleItemIds } = await completeSale(items, finalPayments, customerId, user!.id, cartDiscountAmount(), tip, tipEmployeeId);

      // Create insurance claim if applicable
      if (insurance) {
        await createClaim({
          sale_id: saleId,
          provider_id: insurance.provider.id,
          member: insurance.member,
          gross_amount: total,
          copay_amount: insurance.copay,
          claim_amount: insurance.claim,
          items: items.map((it, i) => ({
            sale_item_id: saleItemIds[i],
            product_id: it.product_id,
            product_name: it.name,
            quantity: it.quantity,
            unit_price: it.unit_price,
            line_total: it.total,
          })),
        });
        toast.success(`Sale + claim created (KES ${insurance.claim.toFixed(0)} to ${insurance.provider.code})`);
      } else {
        toast.success("Sale completed");
      }

      // Print receipt (give eTIMS a moment to sign first)
      setTimeout(async () => {
        try {
          const data = await buildReceiptData(saleId);
          if (data) printReceipt(data);
        } catch (e) {
          console.error("Receipt print failed:", e);
        }
      }, 500);

      clear();
      onClose();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Payment</DialogTitle>
        </DialogHeader>

        {showStkPush ? (
          <PaystackMpesaCharge
            amount={remaining}
            email="customer@omnix.local"
            onSuccess={(ref) => {
              setPayments([...payments, {
                method_id: "mpesa-paystack",
                method_name: "M-Pesa (Paystack)",
                amount: remaining,
                reference: ref,
              }]);
              setShowStkPush(false);
              setAmount("0");
            }}
            onCancel={() => setShowStkPush(false)}
          />
        ) : showInsuranceVerify ? (
          <InsuranceVerifyPanel
            grossAmount={total}
            onMemberSelected={handleInsuranceConfirmed}
            onCancel={() => { setShowInsuranceVerify(false); setSelectedMethod("cash"); }}
          />
        ) : (
        <div className="space-y-4">
          {/* Total */}
          <div className="text-center py-2">
            <p className="text-xs text-muted-foreground">Total Due</p>
            <p className="text-3xl font-bold font-mono">{total.toFixed(2)}</p>
            {paidSoFar > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Remaining: <span className="font-mono">{remaining.toFixed(2)}</span>
              </p>
            )}
            {insurance && (
              <p className="text-xs text-amber-700 mt-1">
                Member pays copay: KES {insurance.copay.toFixed(0)}
              </p>
            )}
          </div>

          {/* Method selector */}
          <div className="grid grid-cols-2 gap-2">
            {methods.map((m) => (
              <button
                key={m.id}
                onClick={() => handleSelectMethod(m.id)}
                className={`px-3 py-2 rounded-md border text-sm transition-colors ${
                  selectedMethod === m.id
                    ? "border-primary bg-primary/5 font-medium"
                    : "border-border hover:bg-accent/50"
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Amount</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-lg font-mono h-11"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleComplete()}
            />
            {selectedMethod === "cash" && (
              <>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[50, 100, 200, 500, 1000, 2000].map((denom) => (
                    <button
                      key={denom}
                      type="button"
                      onClick={() => {
                        const current = parseFloat(amount) || 0;
                        setAmount(String(current + denom));
                      }}
                      className="h-8 px-2.5 text-xs font-mono rounded-md border border-border bg-background hover:bg-accent transition"
                    >
                      +{denom}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAmount(String(total.toFixed(2)))}
                    className="h-8 px-2.5 text-xs rounded-md border border-primary text-primary bg-background hover:bg-primary/5 transition"
                  >
                    Exact
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmount("")}
                    className="h-8 px-2.5 text-xs rounded-md border border-border bg-background hover:bg-accent transition text-muted-foreground"
                  >
                    Clear
                  </button>
                </div>
                {parseFloat(amount) > total && (
                  <div className="text-sm pt-1">
                    <span className="text-muted-foreground">Change: </span>
                    <span className="font-mono font-semibold text-emerald-600">
                      KES {(parseFloat(amount) - total).toFixed(2)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Reference (for M-Pesa, bank) */}
          {selectedMethod !== "cash" && selectedMethod !== "insurance" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Reference / Transaction Code</label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. SLK7A9B2C1" />
            </div>
          )}

          {/* Paystack STK Push button */}
          {paystackActive && selectedMethod === "mpesa-manual" && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowStkPush(true)}
            >
              📱 Send STK Push via Paystack
            </Button>
          )}

          {/* Split payment history */}
          {payments.length > 0 && (
            <div className="border border-border rounded-md p-2 space-y-1">
              {payments.map((p, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="truncate">{p.method_name}</span>
                  <span className="font-mono">{p.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {payments.length === 0 && remaining > 0 ? (
              <>
                <Button variant="secondary" className="flex-1" onClick={addPayment}>
                  Split
                </Button>
                <Button className="flex-1" onClick={handleComplete} disabled={processing}>
                  {processing ? "..." : "Complete"}
                </Button>
              </>
            ) : remaining > 0 ? (
              <Button className="w-full" onClick={addPayment}>
                Add Payment
              </Button>
            ) : (
              <Button className="w-full" onClick={handleComplete} disabled={processing}>
                {processing ? "Processing..." : "Complete Sale"}
              </Button>
            )}
          </div>

          {/* Change */}
          {parseFloat(amount) > remaining && remaining <= 0 && (
            <div className="text-center text-sm">
              <span className="text-muted-foreground">Change: </span>
              <span className="font-mono font-medium text-green-600">
                {(parseFloat(amount) - total + paidSoFar).toFixed(2)}
              </span>
            </div>
          )}
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
