import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TouchKeypad } from "@/components/ui/touch-keypad";
import { useIsTouch } from "@/stores/density";
import { useCartStore } from "@/stores/cart";
import { useAuthStore } from "@/stores/auth";
import { completeSale, getPaymentMethods, type CartItem, type PaymentMethod, type PaymentEntry } from "@/services/sales";
import { getPaystackConfig } from "@/services/paystack";
import { getDarajaConfig } from "@/services/daraja";
import { createClaim, type InsuranceProvider, type InsuranceMember } from "@/services/insurance";
import { buildReceiptData, printReceipt } from "@/services/receipt";
import { markOrderPaidFromPos } from "@/services/hospitality";
import { PaystackMpesaCharge } from "@/components/pos/paystack-mpesa";
import { DarajaMpesaCharge } from "@/components/pos/daraja-mpesa";
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

interface PaymentSnapshot {
  items: CartItem[];
  customerId: string | null;
  discountAmount: number;
  total: number;
  tip: number;
  tipEmployeeId: string | null;
  serviceChargeAmount: number;
  sourceType: "hospitality_order" | "prescription" | "layby" | "special_order" | "folio" | "hardware_quote" | null;
  sourceId: string | null;
}

export function PaymentModal({ open, onClose }: Props) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>("cash");
  const [amount, setAmount] = useState("");
  const touch = useIsTouch();
  const amountRef = useRef<HTMLInputElement>(null);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [paystackActive, setPaystackActive] = useState(false);
  const [darajaActive, setDarajaActive] = useState(false);
  const [showStkPush, setShowStkPush] = useState(false);
  const [showDarajaStk, setShowDarajaStk] = useState(false);
  const [showInsuranceVerify, setShowInsuranceVerify] = useState(false);
  const [insurance, setInsurance] = useState<InsuranceState | null>(null);
  const [snapshot, setSnapshot] = useState<PaymentSnapshot | null>(null);

  const clear = useCartStore((s) => s.clear);
  const liveGrandTotal = useCartStore((s) => s.grandTotal);
  const user = useAuthStore((s) => s.user);
  const total = snapshot?.total ?? liveGrandTotal();
  const paidSoFar = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = total - paidSoFar;

  useEffect(() => {
    if (open) {
      const cart = useCartStore.getState();
      const nextSnapshot: PaymentSnapshot = {
        items: cart.items.map((item) => ({ ...item })),
        customerId: cart.customerId,
        discountAmount: cart.cartDiscountAmount(),
        total: cart.grandTotal(),
        tip: cart.tip,
        tipEmployeeId: cart.tipEmployeeId,
        serviceChargeAmount: cart.serviceChargeAmount,
        sourceType: cart.sourceType,
        sourceId: cart.sourceId,
      };
      setSnapshot(nextSnapshot);
      getPaymentMethods().then(setMethods);
      getPaystackConfig().then((c) => setPaystackActive(!!c?.active));
      getDarajaConfig().then((c) => setDarajaActive(!!c?.active));
      setPayments([]);
      setAmount(String(nextSnapshot.total.toFixed(2)));
      setReference("");
      setShowStkPush(false);
      setShowDarajaStk(false);
      setShowInsuranceVerify(false);
      setInsurance(null);
    } else {
      setSnapshot(null);
    }
  }, [open]);

  const handleSelectMethod = (id: string) => {
    setSelectedMethod(id);
    // Each split-payment chunk needs its own amount. Without this reset,
    // typing 200 in Cash and switching to M-Pesa pre-fills M-Pesa with
    // 200 too — the cashier ends up posting 200 by the wrong method.
    // Reset to the still-unpaid remainder so a single-method payment
    // is one keystroke ('Pay') while a split flow is fresh per tab.
    setAmount(String(Math.max(0, remaining).toFixed(2)));
    if (id === "insurance" && !insurance) {
      setShowInsuranceVerify(true);
    }
  };

  const handleInsuranceConfirmed = (data: InsuranceState) => {
    setInsurance(data);
    setShowInsuranceVerify(false);
    setPayments([{
      method_id: "insurance",
      method_name: `${data.provider.code} - ${data.member.full_name}`,
      amount: data.claim,
      reference: data.member.member_number,
    }]);
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
    const saleSnapshot = snapshot ?? (() => {
      const cart = useCartStore.getState();
      return {
        items: cart.items.map((item) => ({ ...item })),
        customerId: cart.customerId,
        discountAmount: cart.cartDiscountAmount(),
        total: cart.grandTotal(),
        tip: cart.tip,
        tipEmployeeId: cart.tipEmployeeId,
        serviceChargeAmount: cart.serviceChargeAmount,
        sourceType: cart.sourceType,
        sourceId: cart.sourceId,
      };
    })();

    if (saleSnapshot.items.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    const finalPayments = payments.length > 0 ? payments : [{
      method_id: selectedMethod,
      method_name: methods.find((m) => m.id === selectedMethod)?.name || "Cash",
      amount: parseFloat(amount) || saleSnapshot.total,
    }];

    const creditPayments = finalPayments.filter((p) => p.method_id === "credit");
    if (creditPayments.length > 0) {
      if (!saleSnapshot.customerId) {
        toast.error("A customer account is required for credit payments");
        return;
      }
      try {
        const { creditCheck } = await import("@/services/hardware");
        for (const cp of creditPayments) {
          const result = await creditCheck(saleSnapshot.customerId, cp.amount);
          if (!result.ok) {
            toast.error(result.reason || "Credit check failed");
            return;
          }
        }
      } catch (e) {
        toast.error("Credit check failed: " + e);
        return;
      }
    }

    setProcessing(true);
    try {
      const { saleId, saleItemIds } = await completeSale(
        saleSnapshot.items,
        finalPayments,
        saleSnapshot.customerId,
        user!.id,
        saleSnapshot.discountAmount,
        saleSnapshot.tip,
        saleSnapshot.tipEmployeeId,
        saleSnapshot.serviceChargeAmount,
        saleSnapshot.sourceType,
        saleSnapshot.sourceId,
      );

      if (saleSnapshot.sourceType === "hospitality_order" && saleSnapshot.sourceId) {
        await markOrderPaidFromPos(saleSnapshot.sourceId, saleId);
      }

      if (saleSnapshot.sourceType === "prescription" && saleSnapshot.sourceId) {
        const { dispensePrescription } = await import("@/services/pharmacy");
        await dispensePrescription(saleSnapshot.sourceId, saleId);
      }

      if (saleSnapshot.sourceType === "layby" && saleSnapshot.sourceId) {
        const { completeLaybyFromPos } = await import("@/services/retail");
        await completeLaybyFromPos(saleSnapshot.sourceId, saleId);
      }

      if (saleSnapshot.sourceType === "special_order" && saleSnapshot.sourceId) {
        const { completeSpecialOrderFromPos } = await import("@/services/retail");
        await completeSpecialOrderFromPos(saleSnapshot.sourceId, saleId);
      }

      if (saleSnapshot.sourceType === "hardware_quote" && saleSnapshot.sourceId) {
        const { markQuotePaidFromPos } = await import("@/services/hardware");
        await markQuotePaidFromPos(saleSnapshot.sourceId, saleId);
      }

      // Hardware contractor credit: post charge to account ledger
      const creditPayments = finalPayments.filter((p) => p.method_id === "credit");
      if (creditPayments.length > 0 && saleSnapshot.customerId) {
        const { postCharge } = await import("@/services/hardware");
        for (const cp of creditPayments) {
          await postCharge(saleSnapshot.customerId, cp.amount, { saleId, userId: user!.id });
        }
      }

      if (insurance) {
        await createClaim({
          sale_id: saleId,
          provider_id: insurance.provider.id,
          member: insurance.member,
          gross_amount: saleSnapshot.total,
          copay_amount: insurance.copay,
          claim_amount: insurance.claim,
          items: saleSnapshot.items.map((it, i) => ({
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

      setTimeout(async () => {
        try {
          const data = await buildReceiptData(saleId);
          if (data) printReceipt(data);
        } catch (e) {
          console.error("Receipt print failed:", e);
        }
      }, 500);

      clear();
      setPayments([]);
      setAmount("0");
      setReference("");
      setSnapshot(null);
      onClose();
    } catch (e) {
      const err = e as { code?: string; shortages?: Array<{ name: string; requested: number; available: number }>; message?: string };
      if (err?.code === "OUT_OF_STOCK" && Array.isArray(err.shortages)) {
        toast.error(
          `Cart exceeds stock: ${err.shortages.map((s) => `${s.name} (need ${s.requested}, have ${s.available})`).join("; ")}`,
        );
      } else {
        toast.error(String(e));
      }
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

        {showDarajaStk ? (
          <DarajaMpesaCharge
            amount={remaining}
            onSuccess={(ref) => {
              setPayments([...payments, {
                method_id: "mpesa-daraja",
                method_name: "M-Pesa (Direct)",
                amount: remaining,
                reference: ref,
              }]);
              setShowDarajaStk(false);
              setAmount("0");
            }}
            onCancel={() => setShowDarajaStk(false)}
          />
        ) : showStkPush ? (
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

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Amount</label>
            <Input
              ref={amountRef}
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onFocus={() => touch && setKeypadOpen(true)}
              className="text-lg font-mono h-11"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleComplete()}
            />
            {selectedMethod === "cash" && (
              <>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[50, 100, 200, 500, 1000, 2000].map((denom) => (
                    <button key={denom} type="button" onClick={() => { const current = parseFloat(amount) || 0; setAmount(String(current + denom)); }} className="h-8 px-2.5 text-xs font-mono rounded-md border border-border bg-background hover:bg-accent transition">
                      +{denom}
                    </button>
                  ))}
                  <button type="button" onClick={() => setAmount(String(total.toFixed(2)))} className="h-8 px-2.5 text-xs rounded-md border border-primary text-primary bg-background hover:bg-primary/5 transition">Exact</button>
                  <button type="button" onClick={() => setAmount("")} className="h-8 px-2.5 text-xs rounded-md border border-border bg-background hover:bg-accent transition text-muted-foreground">Clear</button>
                </div>
                {parseFloat(amount) > total && (
                  <div className="text-sm pt-1">
                    <span className="text-muted-foreground">Change: </span>
                    <span className="font-mono font-semibold text-emerald-600">KES {(parseFloat(amount) - total).toFixed(2)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {selectedMethod !== "cash" && selectedMethod !== "insurance" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Reference / Transaction Code</label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. SLK7A9B2C1" />
            </div>
          )}

          {darajaActive && selectedMethod === "mpesa-manual" && (
            <Button variant="outline" className="w-full border-green-500 text-green-600 hover:bg-green-50" onClick={() => setShowDarajaStk(true)}>
              📱 Send STK Push via M-Pesa (Direct)
            </Button>
          )}

          {paystackActive && selectedMethod === "mpesa-manual" && (
            <Button variant="outline" className="w-full" onClick={() => setShowStkPush(true)}>
              📱 Send STK Push via Paystack
            </Button>
          )}

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

          <div className="flex gap-2">
            {payments.length === 0 && remaining > 0 ? (
              <>
                <Button variant="secondary" className="flex-1" onClick={addPayment}>Split</Button>
                <Button className="flex-1" onClick={handleComplete} disabled={processing}>{processing ? "..." : "Complete"}</Button>
              </>
            ) : remaining > 0 ? (
              <Button className="w-full" onClick={addPayment}>Add Payment</Button>
            ) : (
              <Button className="w-full" onClick={handleComplete} disabled={processing}>{processing ? "Processing..." : "Complete Sale"}</Button>
            )}
          </div>

          {parseFloat(amount) > remaining && remaining <= 0 && (
            <div className="text-center text-sm">
              <span className="text-muted-foreground">Change: </span>
              <span className="font-mono font-medium text-green-600">{(parseFloat(amount) - total + paidSoFar).toFixed(2)}</span>
            </div>
          )}
        </div>
        )}
      </DialogContent>
      <TouchKeypad
        inputRef={amountRef}
        mode="currency"
        open={keypadOpen}
        onDismiss={() => setKeypadOpen(false)}
        onCommit={() => {
          setKeypadOpen(false);
          handleComplete();
        }}
      />
    </Dialog>
  );
}
