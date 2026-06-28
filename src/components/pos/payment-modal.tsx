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
import { getDarajaConfig, getManualMpesaConfig, type ManualMpesaConfig } from "@/services/daraja";
import { payByPaystackPopup } from "@/services/paystack-popup";
import { createClaim, type InsuranceProvider, type InsuranceMember } from "@/services/insurance";
import { buildReceiptData, printReceipt } from "@/services/receipt";
import { markOrderPaidFromPos } from "@/services/hospitality";
import { PaystackMpesaCharge } from "@/components/pos/paystack-mpesa";
import { DarajaMpesaCharge } from "@/components/pos/daraja-mpesa";
import { InsuranceVerifyPanel } from "@/components/pos/insurance-verify";
import { paymentBrandIcon, paymentBrandTint } from "@/components/icons/payment-brands";
import { cn } from "@/lib/utils";
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
  const [paystackKey, setPaystackKey] = useState<string | null>(null);
  const [darajaActive, setDarajaActive] = useState(false);
  const [manualMpesa, setManualMpesa] = useState<ManualMpesaConfig | null>(null);
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
      getPaystackConfig().then((c) => { setPaystackActive(!!c?.active); setPaystackKey(c?.public_key ?? null); });
      getDarajaConfig().then((c) => setDarajaActive(!!c?.active));
      getManualMpesaConfig().then(setManualMpesa);
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

  /** Remove a split chunk and restore its amount to the input for re-entry. */
  const removePayment = (index: number) => {
    const removed = payments[index];
    const next = payments.filter((_, i) => i !== index);
    setPayments(next);
    // Restore the freed amount into the input so the cashier can re-key it.
    const newRemaining = total - next.reduce((s, p) => s + p.amount, 0);
    setAmount(String(Math.max(0, newRemaining).toFixed(2)));
    if (removed?.method_id === "insurance") setInsurance(null);
  };

  /**
   * Card payment via the Paystack Popup (hosted iframe). Keeps us out of
   * PCI scope + the RAMS fraud penalty box. The popup amount is the
   * current input (a chunk) or the whole remaining balance.
   */
  const payViaPaystackPopup = async () => {
    if (!paystackKey) { toast.error("Paystack not configured"); return; }
    const amt = parseFloat(amount) || remaining;
    if (amt <= 0) { toast.error("Enter amount"); return; }
    const ref = `OMX-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
    const result = await payByPaystackPopup({
      publicKey: paystackKey,
      email: "sales@omnix.local",
      amountKes: amt,
      reference: ref,
    });
    if (result.status === "success") {
      setPayments([...payments, {
        method_id: "card",
        method_name: "Card (Paystack)",
        amount: amt,
        reference: result.reference,
      }]);
      setAmount(String(Math.max(0, remaining - amt).toFixed(2)));
      toast.success("Card payment captured — verify on the dashboard");
    } else if (result.status === "error") {
      toast.error(result.message || "Paystack error");
    }
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
      <DialogContent
        className={cn(
          // Wider so the 2-col payment-method grid breathes and focus rings
          // don't clip the card edges. Disable the outer scroll + max-h —
          // the payment-modal renders its own sticky-header / scrollable-
          // body / sticky-footer layout, and the outer scroll was creating
          // a second scrollbar on the same axis.
          "sm:max-w-[560px] overflow-visible max-h-none p-0 gap-0",
        )}
      >
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle>Payment</DialogTitle>
        </DialogHeader>

        {showDarajaStk ? (
          <div className="px-5 pb-5 max-h-[min(86vh,720px)] overflow-y-auto">
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
          </div>
        ) : showStkPush ? (
          <div className="px-5 pb-5 max-h-[min(86vh,720px)] overflow-y-auto">
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
          </div>
        ) : showInsuranceVerify ? (
          <div className="px-5 pb-5 max-h-[min(86vh,720px)] overflow-y-auto">
            <InsuranceVerifyPanel
              grossAmount={total}
              onMemberSelected={handleInsuranceConfirmed}
              onCancel={() => { setShowInsuranceVerify(false); setSelectedMethod("cash"); }}
            />
          </div>
        ) : (
        <div className="flex flex-col max-h-[min(86vh,720px)]">
          {/* ── Sticky header: total + remaining + progress ───────── */}
          <div className="flex-shrink-0 border-b border-border/60 px-5 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Total due</p>
                <p className="text-2xl font-bold font-mono tabular-nums leading-tight">{total.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Remaining</p>
                <p className={`text-2xl font-bold font-mono tabular-nums leading-tight ${remaining <= 0 ? "text-emerald-600" : ""}`}>
                  {Math.max(0, remaining).toFixed(2)}
                </p>
              </div>
            </div>
            {/* progress bar */}
            <div className="mt-3 h-1.5 w-full rounded-full bg-foreground/[0.08] overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${total > 0 ? Math.min(100, (paidSoFar / total) * 100) : 0}%` }}
              />
            </div>
            {insurance && (
              <p className="text-xs text-amber-700 mt-2">
                Insurance covers KES {insurance.claim.toFixed(0)} · member pays copay KES {insurance.copay.toFixed(0)}
              </p>
            )}
          </div>

          {/* ── Scrollable body — single scroll axis ─────────────── */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
            {/* Method picker — brand-coloured cards. ring-inset prevents
                the focus highlight from clipping at the card edges when
                the dialog runs against its width. */}
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground mb-2">Pay with</p>
              <div className="grid grid-cols-2 gap-2.5">
                {methods.map((m) => {
                  const Icon = paymentBrandIcon(m.id + " " + m.name);
                  const tint = paymentBrandTint(m.id + " " + m.name);
                  const selected = selectedMethod === m.id;
                  // How much has already been added to splits under this
                  // method. Shown INSIDE the card so the cashier sees
                  // their running tally per-method without scrolling to
                  // the "paid so far" list below.
                  const methodTotal = payments
                    .filter((p) => p.method_id === m.id)
                    .reduce((s, p) => s + p.amount, 0);
                  // Selected method also previews the current input.
                  const inputAmt = parseFloat(amount) || 0;
                  const previewing = selected && inputAmt > 0;
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleSelectMethod(m.id)}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer",
                        selected
                          ? `${tint.bg} ring-2 ring-inset ${tint.ring} border-transparent`
                          : "border-border hover:bg-accent/40",
                      )}
                    >
                      <Icon size={26} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium leading-tight ${selected ? tint.text : "text-foreground"}`}>
                          {m.name}
                        </div>
                        {(methodTotal > 0 || previewing) && (
                          <div className={`mt-0.5 font-mono tabular-nums text-[11px] leading-tight ${selected ? tint.text : "text-muted-foreground"}`}>
                            {methodTotal > 0 && previewing
                              ? `KES ${methodTotal.toFixed(2)} + ${inputAmt.toFixed(2)}`
                              : methodTotal > 0
                                ? `KES ${methodTotal.toFixed(2)}`
                                : `KES ${inputAmt.toFixed(2)}`}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Amount (KES)
              </label>
              <Input
                ref={amountRef}
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onFocus={() => touch && setKeypadOpen(true)}
                className="text-2xl font-mono h-14 tabular-nums"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && (remaining - (parseFloat(amount) || 0) <= 0 ? handleComplete() : addPayment())}
              />
              {selectedMethod === "cash" && (
                <>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[50, 100, 200, 500, 1000, 2000].map((denom) => (
                      <button key={denom} type="button" onClick={() => { const current = parseFloat(amount) || 0; setAmount(String(current + denom)); }} className="h-9 px-3 text-xs font-mono rounded-md border border-border bg-background hover:bg-accent transition">
                        +{denom}
                      </button>
                    ))}
                    <button type="button" onClick={() => setAmount(String(Math.max(0, remaining).toFixed(2)))} className="h-9 px-3 text-xs rounded-md border border-primary text-primary bg-background hover:bg-primary/5 transition">Exact</button>
                    <button type="button" onClick={() => setAmount("")} className="h-9 px-3 text-xs rounded-md border border-border bg-background hover:bg-accent transition text-muted-foreground">Clear</button>
                  </div>
                  {parseFloat(amount) > remaining && remaining > 0 && (
                    <div className="text-sm pt-1">
                      <span className="text-muted-foreground">Change: </span>
                      <span className="font-mono font-semibold text-emerald-600">KES {(parseFloat(amount) - remaining).toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Reference field for non-cash, non-insurance methods */}
            {selectedMethod !== "cash" && selectedMethod !== "insurance" && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Reference / Transaction code
                </label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. SLK7A9B2C1" className="h-11 font-mono" />
              </div>
            )}

            {/* STK push triggers */}
            {darajaActive && selectedMethod === "mpesa-manual" && (
              <Button variant="outline" className="w-full border-[#4FC52E] text-[#2E7D1B] hover:bg-[#4FC52E]/10" onClick={() => setShowDarajaStk(true)}>
                Send STK push via M-Pesa
              </Button>
            )}
            {paystackActive && selectedMethod === "mpesa-manual" && (
              <Button variant="outline" className="w-full border-[#13B7F5] text-[#0A6F9E] hover:bg-[#13B7F5]/10" onClick={() => setShowStkPush(true)}>
                Send STK push via Paystack
              </Button>
            )}

            {/* Manual M-Pesa — show the business Paybill/Till prominently so
                the cashier can read it to the customer, then capture the
                confirmation code. Shown when no Daraja STK is configured. */}
            {selectedMethod === "mpesa-manual" && !darajaActive &&
              (manualMpesa?.paybill_number || manualMpesa?.till_number) && (
              <div className="rounded-xl bg-[#4FC52E]/[0.07] ring-1 ring-[#4FC52E]/30 p-4 space-y-2">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#2E7D1B]">
                  Ask the customer to pay
                </p>
                {manualMpesa?.till_number ? (
                  <div>
                    <p className="text-xs text-muted-foreground">Buy Goods · Till number</p>
                    <p className="text-3xl font-bold font-mono tabular-nums text-[#2E7D1B]">{manualMpesa.till_number}</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div>
                      <p className="text-xs text-muted-foreground">Paybill number</p>
                      <p className="text-3xl font-bold font-mono tabular-nums text-[#2E7D1B]">{manualMpesa?.paybill_number}</p>
                    </div>
                    {manualMpesa?.paybill_account_hint && (
                      <p className="text-xs text-muted-foreground">
                        Account: <span className="font-medium text-foreground">{manualMpesa.paybill_account_hint}</span>
                      </p>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground pt-1">
                  Then enter the M-Pesa confirmation code from the customer's SMS in the reference field above.
                </p>
              </div>
            )}

            {/* Card via Paystack Popup (hosted iframe) */}
            {paystackActive && selectedMethod === "card" && (
              <Button variant="outline" className="w-full border-[#13B7F5] text-[#0A6F9E] hover:bg-[#13B7F5]/10" onClick={payViaPaystackPopup}>
                Pay by card via Paystack
              </Button>
            )}

            {/* Splits paid so far */}
            {payments.length > 0 && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground mb-2">Paid so far</p>
                <div className="space-y-1.5">
                  {payments.map((p, i) => {
                    const Icon = paymentBrandIcon(p.method_id + " " + p.method_name);
                    return (
                      <div key={i} className="flex items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2">
                        <Icon size={22} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{p.method_name}</div>
                          {p.reference && <div className="text-[11px] font-mono text-muted-foreground truncate">{p.reference}</div>}
                        </div>
                        <span className="font-mono tabular-nums text-sm font-semibold">{p.amount.toFixed(2)}</span>
                        <button
                          onClick={() => removePayment(i)}
                          className="text-muted-foreground hover:text-destructive transition-colors text-lg leading-none px-1"
                          aria-label={`Remove ${p.method_name}`}
                        >×</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Sticky footer: single contextual CTA ──────────────── */}
          <div className="flex-shrink-0 border-t border-border/60 px-5 py-4 bg-popover/95 backdrop-blur-sm">
            {(() => {
              const inputAmt = parseFloat(amount) || 0
              const wouldUnderpay = remaining - inputAmt > 0.001
              const wouldOverpay = inputAmt > remaining + 0.001
              // Which methods require an asynchronous upstream action
              // (STK push / Paystack popup / manual code entry) before
              // a chunk can legitimately be added or the sale completed.
              //
              // The pre-fix bug: when the cashier selected M-Pesa with a
              // pending amount, the footer showed "Complete sale" purely
              // because the math added up, even though the STK push had
              // never fired. They could tap it and ship a sale with zero
              // M-Pesa payment ever happening. Routing the footer button
              // through the method's real action first makes that path
              // impossible.
              const mpesaWantsDaraja = selectedMethod === "mpesa-manual" && darajaActive
              const mpesaWantsPaystack = selectedMethod === "mpesa-manual" && !darajaActive && paystackActive
              const cardWantsPaystack = selectedMethod === "card" && paystackActive
              const manualMpesaNeedsCode =
                selectedMethod === "mpesa-manual" && !darajaActive && !paystackActive &&
                (manualMpesa?.paybill_number || manualMpesa?.till_number) && reference.trim() === ""

              // Async-action methods get their action button no matter
              // what the math says — over-tendering doesn't apply to an
              // STK push, and the cashier should NEVER bypass the action
              // by typing an amount that happens to zero the remainder.
              if (inputAmt > 0 && mpesaWantsDaraja) {
                return (
                  <Button
                    className="w-full h-12 text-base bg-[#4FC52E] hover:bg-[#3DB31C] text-white"
                    onClick={() => setShowDarajaStk(true)}
                  >
                    Send M-Pesa STK push · {inputAmt.toFixed(2)}
                  </Button>
                )
              }
              if (inputAmt > 0 && mpesaWantsPaystack) {
                return (
                  <Button
                    className="w-full h-12 text-base bg-[#13B7F5] hover:bg-[#0EA0DA] text-white"
                    onClick={() => setShowStkPush(true)}
                  >
                    Send M-Pesa STK push · {inputAmt.toFixed(2)}
                  </Button>
                )
              }
              if (inputAmt > 0 && cardWantsPaystack) {
                return (
                  <Button
                    className="w-full h-12 text-base bg-[#13B7F5] hover:bg-[#0EA0DA] text-white"
                    onClick={payViaPaystackPopup}
                  >
                    Open Paystack to charge card · {inputAmt.toFixed(2)}
                  </Button>
                )
              }
              if (inputAmt > 0 && manualMpesaNeedsCode) {
                return (
                  <Button
                    className="w-full h-12 text-base"
                    disabled
                    title="Enter the M-Pesa confirmation code from the customer's SMS in the Reference field first"
                  >
                    Enter M-Pesa code above to confirm
                  </Button>
                )
              }

              if (wouldUnderpay) {
                // Adding this chunk leaves a balance — split-payment path.
                return (
                  <Button className="w-full h-12 text-base" onClick={addPayment}>
                    Add payment · {inputAmt.toFixed(2)}
                  </Button>
                )
              }

              // The math zeroes (or over-tenders for cash). Complete the sale.
              return (
                <Button
                  className="w-full h-12 text-base"
                  onClick={handleComplete}
                  disabled={processing}
                >
                  {processing ? "Processing…" : "Complete sale"}
                </Button>
              )
              // Suppress unused-warning — kept for clarity even if not
              // currently checked outside the cash branch below.
              void wouldOverpay
            })()}
            {/* Change line when the tendered amount exceeds what's left */}
            {(parseFloat(amount) || 0) > remaining && remaining > 0 && selectedMethod === "cash" && (
              <p className="text-center text-sm mt-2">
                <span className="text-muted-foreground">Change due: </span>
                <span className="font-mono font-semibold text-emerald-600">KES {((parseFloat(amount) || 0) - remaining).toFixed(2)}</span>
              </p>
            )}
          </div>
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
