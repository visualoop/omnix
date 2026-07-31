import { useEffect, useRef, useState } from "react";
import { Heart, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TouchKeypad } from "@/components/ui/touch-keypad";
import { useIsTouch } from "@/stores/density";
import { useCartStore } from "@/stores/cart";
import { useActiveBranch } from "@/stores/active-branch";
import { listEmployees, type EmployeeWithDetails } from "@/services/employees";
import { query } from "@/lib/db";
import { money as KES } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { PosFormFactor } from "@/components/pos/use-pos-form-factor";

interface TipDialogProps {
  open: boolean;
  onClose: () => void;
  formFactor?: PosFormFactor;
}

export function TipDialog({ open, onClose, formFactor = "desktop" }: TipDialogProps) {
  const cartTip = useCartStore((state) => state.tip);
  const cartTipEmployee = useCartStore((state) => state.tipEmployeeId);
  const setTip = useCartStore((state) => state.setTip);
  const subtotal = useCartStore((state) => state.subtotal());
  const cartDiscountAmount = useCartStore((state) => state.cartDiscountAmount());
  const taxTotal = useCartStore((state) => state.taxTotal());
  const branchId = useActiveBranch((state) => state.active?.id);

  const total = subtotal - cartDiscountAmount + taxTotal;
  const [amount, setAmount] = useState(String(cartTip || 0));
  const [employeeId, setEmployeeId] = useState<string | null>(cartTipEmployee);
  const [percentages, setPercentages] = useState([5, 10, 15, 20]);
  const [employees, setEmployees] = useState<EmployeeWithDetails[]>([]);
  const [assignToStaff, setAssignToStaff] = useState(false);
  const touch = useIsTouch();
  const amountRef = useRef<HTMLInputElement>(null);
  const [keypadOpen, setKeypadOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setAmount(String(cartTip || 0));
    setEmployeeId(cartTipEmployee);

    query<{ key: string; value: string }>(
      `SELECT key, value FROM settings WHERE key IN ('tips.default_percentages', 'tips.assign_to_staff')`,
    ).then((rows) => {
      if (cancelled) return;
      const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));
      if (map["tips.default_percentages"]) {
        setPercentages(map["tips.default_percentages"].split(",").map((entry) => Number.parseFloat(entry.trim())).filter(Number.isFinite));
      }
      setAssignToStaff(map["tips.assign_to_staff"] === "1");
    }).catch(() => {});

    listEmployees({ branchId, active: true })
      .then((rows) => { if (!cancelled) setEmployees(rows); })
      .catch(() => { if (!cancelled) setEmployees([]); });

    return () => { cancelled = true; };
  }, [open, branchId, cartTip, cartTipEmployee]);

  const tipAmount = Math.max(0, Number.parseFloat(amount) || 0);
  const staffOptions: ComboboxOption[] = [
    { value: "__none", label: "Pool / Direct", description: "No specific staff member" },
    ...employees.map((employee) => ({
      value: employee.id,
      label: employee.full_name,
      hint: employee.job_title ?? undefined,
    })),
  ];

  const apply = () => {
    setTip(tipAmount, employeeId);
    onClose();
  };

  const remove = () => {
    setTip(0, null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={formFactor === "desktop"}
        className={cn(
          "flex flex-col",
          formFactor === "desktop"
            ? "max-w-md"
            : "!inset-0 !left-0 !top-0 !h-[100dvh] !max-h-none !w-full !max-w-none !translate-x-0 !translate-y-0 !rounded-none !bg-background !backdrop-blur-none p-0 motion-reduce:!duration-0 [&_button]:min-h-11 [&_input]:min-h-11 [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-ring [&_input]:focus-visible:outline-none [&_input]:focus-visible:ring-2 [&_input]:focus-visible:ring-ring",
        )}
      >
        <DialogHeader className={cn(formFactor !== "desktop" && "shrink-0 border-b border-border px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]")}>
          <DialogTitle className="flex items-center gap-2"><Heart className="size-5 text-rose-600" /> Add tip</DialogTitle>
          <p className="text-xs text-muted-foreground">Optional gratuity for this sale.</p>
        </DialogHeader>

        <div className={cn("space-y-5", formFactor === "desktop" ? "py-2" : "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5")}>
          <div className="flex min-h-12 items-center justify-between rounded-md bg-muted/50 px-3 text-sm">
            <span className="text-muted-foreground">Bill excluding tip</span>
            <span className="font-mono font-semibold tabular-nums">{KES(total)}</span>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Quick tip</p>
            <div className={cn("grid gap-2", formFactor === "desktop" ? "grid-cols-3" : "grid-cols-2")}>
              {percentages.map((percentage) => {
                const calculated = total * percentage / 100;
                return (
                  <button
                    key={percentage}
                    type="button"
                    onClick={() => setAmount(calculated.toFixed(0))}
                    className="min-h-14 rounded-md border border-border px-3 text-center active:scale-[0.97] motion-reduce:transform-none"
                  >
                    <span className="block text-sm font-bold text-rose-700 dark:text-rose-300">{percentage}%</span>
                    <span className="block font-mono text-[10px] text-muted-foreground">{KES(calculated)}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setAmount("0")}
                className="min-h-14 rounded-md border border-border px-3 text-sm font-semibold active:scale-[0.97] motion-reduce:transform-none"
              >
                No tip
              </button>
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-semibold text-muted-foreground">Custom amount (KES)</span>
            <Input
              ref={amountRef}
              type="number"
              inputMode="decimal"
              min={0}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              onFocus={() => touch && setKeypadOpen(true)}
              className="h-14 font-mono text-2xl tabular-nums"
              placeholder="0"
              autoFocus
              onKeyDown={(event) => event.key === "Enter" && apply()}
            />
          </label>

          {tipAmount > 0 ? (
            <dl className="space-y-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Bill</dt><dd className="font-mono tabular-nums">{KES(total)}</dd></div>
              <div className="flex justify-between text-rose-700 dark:text-rose-300"><dt>Tip</dt><dd className="font-mono font-semibold tabular-nums">+{KES(tipAmount)}</dd></div>
              <div className="flex justify-between border-t border-rose-500/30 pt-2 font-bold"><dt>New total</dt><dd className="font-mono tabular-nums">{KES(total + tipAmount)}</dd></div>
            </dl>
          ) : null}

          {assignToStaff && employees.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Tip for (optional)</p>
              <Combobox
                value={employeeId ?? "__none"}
                onChange={(value) => setEmployeeId(value === "__none" ? null : value)}
                options={staffOptions}
                placeholder="Pool / Direct"
                searchPlaceholder="Search staff…"
                emptyText="No active staff found. Add staff from Employees."
                className={cn(formFactor !== "desktop" && "[&_button]:min-h-11 [&_input]:min-h-11")}
              />
            </div>
          ) : null}
        </div>

        <DialogFooter className={cn(formFactor !== "desktop" && "m-0 shrink-0 grid grid-cols-2 border-t border-border px-4 py-3 sm:grid-cols-2", "pb-[max(0.75rem,env(safe-area-inset-bottom))]")}>
          {cartTip > 0 ? (
            <Button variant="outline" className="h-12" onClick={remove}><X className="mr-2 size-4" /> Remove tip</Button>
          ) : (
            <Button variant="outline" className="h-12" onClick={onClose}>Cancel</Button>
          )}
          <Button className="h-12" onClick={apply}><Heart className="mr-2 size-4" /> Apply tip</Button>
        </DialogFooter>
      </DialogContent>
      <TouchKeypad
        inputRef={amountRef}
        mode="currency"
        open={keypadOpen}
        onDismiss={() => setKeypadOpen(false)}
        onCommit={() => {
          setKeypadOpen(false);
          apply();
        }}
      />
    </Dialog>
  );
}
