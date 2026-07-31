import { useEffect, useRef, useState, type RefObject } from "react";
import { ArrowLeft, Check, CreditCard, Receipt, ShieldCheck } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MobileCustomerPicker } from "@/components/pos/MobileCustomerPicker";
import { money as KES } from "@/lib/money";

interface MobilePaymentFlowProps {
  open: boolean;
  itemCount: number;
  unitCount: number;
  total: number;
  branchName: string;
  syncLabel: string;
  shiftOpen: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
  onContinueToAuthoritativePayment: () => void;
}

export function MobilePaymentFlow({
  open,
  itemCount,
  unitCount,
  total,
  branchName,
  syncLabel,
  shiftOpen,
  returnFocusRef,
  onOpenChange,
  onContinueToAuthoritativePayment,
}: MobilePaymentFlowProps) {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const customerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) setStage(0);
  }, [open]);

  const close = () => {
    onOpenChange(false);
    requestAnimationFrame(() => returnFocusRef?.current?.focus());
  };

  const stageLabel = stage === 0 ? "Review" : stage === 1 ? "Customer" : "Payment";

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="!inset-0 !h-[100dvh] !max-h-none !w-full !max-w-none !rounded-none !bg-background !backdrop-blur-none motion-reduce:!transition-none [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-ring [&_button]:focus-visible:ring-offset-2"
      >
        <SheetHeader className="pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-2 pr-10">
            {stage > 0 ? (
              <button
                type="button"
                onClick={() => setStage((stage - 1) as 0 | 1)}
                className="grid size-11 shrink-0 place-items-center rounded-md"
                aria-label="Previous checkout step"
              >
                <ArrowLeft className="size-5" />
              </button>
            ) : null}
            <div>
              <SheetTitle>Checkout · {stageLabel}</SheetTitle>
              <SheetDescription>Step {stage + 1} of 3</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ol className="grid grid-cols-3 gap-2 border-b border-border py-3" aria-label="Checkout progress">
          {["Review", "Customer", "Payment"].map((label, index) => (
            <li
              key={label}
              aria-current={index === stage ? "step" : undefined}
              className={`flex min-h-11 items-center justify-center gap-1 rounded-md text-xs font-semibold ${index <= stage ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}
            >
              {index < stage ? <Check className="size-4" aria-hidden /> : null}{label}
            </li>
          ))}
        </ol>

        <div className="min-h-0 flex-1 overflow-y-auto py-5">
          {stage === 0 ? (
            <div className="space-y-4">
              <div className="rounded-md border border-border p-4">
                <Receipt className="mb-3 size-6" aria-hidden />
                <p className="text-sm font-semibold">Sale summary</p>
                <p className="mt-1 text-sm text-muted-foreground">{itemCount} line{itemCount === 1 ? "" : "s"} · {unitCount} unit{unitCount === 1 ? "" : "s"}</p>
                <p className="mt-4 font-mono text-3xl font-bold tabular-nums">{KES(total)}</p>
              </div>
              <div className="rounded-md border border-border p-4">
                <ShieldCheck className="mb-3 size-6" aria-hidden />
                <p className="text-sm font-semibold">{branchName} controls this sale</p>
                <p className="mt-1 text-sm text-muted-foreground">Payment recording, stock commitment, and eTIMS remain on the existing branch checkout command.</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{syncLabel}</p>
              </div>
            </div>
          ) : stage === 1 ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold">Confirm customer</p>
                <p className="mt-1 text-sm text-muted-foreground">Keep Walk-in or attach a searchable customer record.</p>
              </div>
              <MobileCustomerPicker triggerRef={customerRef} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border border-border p-4">
                <CreditCard className="mb-3 size-6" aria-hidden />
                <p className="text-sm font-semibold">Choose and confirm payment</p>
                <p className="mt-1 text-sm text-muted-foreground">Continue to the existing payment screen. It remains the only place that records tenders and completes the sale.</p>
                <div className="mt-4 grid grid-cols-2 gap-2" aria-label="Available payment paths">
                  {["Cash", "M-Pesa", "Split payment", "Customer credit", "Insurance"].map((method) => (
                    <span key={method} className="flex min-h-11 items-center rounded-md border border-border px-3 text-xs font-semibold last:col-span-2">
                      {method}
                    </span>
                  ))}
                </div>
                <p className="mt-4 font-mono text-3xl font-bold tabular-nums">{KES(total)}</p>
              </div>
              {!shiftOpen ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive">Open a cash shift before continuing.</p>
              ) : null}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-border py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <Button variant="outline" className="h-12" onClick={close}>Cancel</Button>
          {stage < 2 ? (
            <Button className="h-12" onClick={() => setStage((stage + 1) as 1 | 2)}>Continue</Button>
          ) : (
            <Button
              className="h-12"
              disabled={!shiftOpen}
              onClick={() => {
                onOpenChange(false);
                onContinueToAuthoritativePayment();
              }}
            >
              Continue to payment
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
