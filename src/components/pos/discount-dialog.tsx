import { useEffect, useState } from "react";
import { CurrencyDollar as DollarSign, Percent } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cart";
import type { PosFormFactor } from "@/components/pos/use-pos-form-factor";

interface DiscountDialogProps {
  open: boolean;
  onClose: () => void;
  formFactor?: PosFormFactor;
}

export function DiscountDialog({ open, onClose, formFactor = "desktop" }: DiscountDialogProps) {
  const discount = useCartStore((state) => state.discount);
  const discountType = useCartStore((state) => state.discountType);
  const setDiscount = useCartStore((state) => state.setDiscount);
  const subtotal = useCartStore((state) => state.subtotal());
  const [type, setType] = useState<"amount" | "percent">(discountType);
  const [value, setValue] = useState(String(discount));

  useEffect(() => {
    if (!open) return;
    setType(discountType);
    setValue(String(discount));
  }, [discount, discountType, open]);

  const parsedValue = Math.max(0, Number.parseFloat(value) || 0);
  const normalizedValue = type === "percent" ? Math.min(100, parsedValue) : Math.min(subtotal, parsedValue);
  const previewAmount = type === "percent" ? subtotal * normalizedValue / 100 : normalizedValue;

  const apply = () => {
    setDiscount(normalizedValue, type);
    onClose();
  };

  const remove = () => {
    setDiscount(0, "amount");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={formFactor === "desktop"}
        className={cn(
          "flex flex-col",
          formFactor === "desktop"
            ? "max-w-sm"
            : "!inset-0 !left-0 !top-0 !h-[100dvh] !max-h-none !w-full !max-w-none !translate-x-0 !translate-y-0 !rounded-none !bg-background !backdrop-blur-none p-0 motion-reduce:!duration-0 [&_button]:min-h-11 [&_input]:min-h-11 [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-ring [&_input]:focus-visible:outline-none [&_input]:focus-visible:ring-2 [&_input]:focus-visible:ring-ring",
        )}
      >
        <DialogHeader className={cn(formFactor !== "desktop" && "shrink-0 border-b border-border px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]")}>
          <DialogTitle>Cart discount</DialogTitle>
          <p className="text-xs text-muted-foreground">Set one discount for the current sale.</p>
        </DialogHeader>

        <div className={cn("space-y-5", formFactor === "desktop" ? "py-2" : "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5")}>
          <div className="grid grid-cols-2 gap-2" aria-label="Discount type">
            <button
              type="button"
              onClick={() => setType("amount")}
              aria-pressed={type === "amount"}
              className={cn(
                "flex min-h-12 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold active:scale-[0.97] motion-reduce:transform-none",
                type === "amount" ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <DollarSign className="size-5" aria-hidden /> Amount
            </button>
            <button
              type="button"
              onClick={() => setType("percent")}
              aria-pressed={type === "percent"}
              className={cn(
                "flex min-h-12 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold active:scale-[0.97] motion-reduce:transform-none",
                type === "percent" ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <Percent className="size-5" aria-hidden /> Percent
            </button>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-semibold text-muted-foreground">{type === "amount" ? "Discount amount" : "Discount percent"}</span>
            <span className="relative block">
              <Input
                aria-label={type === "amount" ? "Discount amount" : "Discount percent"}
                type="number"
                inputMode="decimal"
                min={0}
                max={type === "percent" ? 100 : subtotal}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="h-14 pr-14 font-mono text-2xl tabular-nums"
                autoFocus
                onKeyDown={(event) => event.key === "Enter" && apply()}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{type === "amount" ? "KES" : "%"}</span>
            </span>
          </label>

          {type === "percent" ? (
            <div className="grid grid-cols-4 gap-2" aria-label="Quick discount percentages">
              {[5, 10, 15, 20].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setValue(String(preset))}
                  className="min-h-12 rounded-md border border-border font-mono text-sm font-semibold active:scale-[0.97] motion-reduce:transform-none"
                >
                  {preset}%
                </button>
              ))}
            </div>
          ) : null}

          <dl className="space-y-2 rounded-md border border-border p-4 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-mono tabular-nums">KES {subtotal.toFixed(2)}</dd></div>
            <div className="flex justify-between text-amber-700 dark:text-amber-300"><dt>Discount</dt><dd className="font-mono tabular-nums">− KES {previewAmount.toFixed(2)}</dd></div>
            <div className="flex justify-between border-t border-border pt-2 font-semibold"><dt>After discount</dt><dd className="font-mono tabular-nums">KES {Math.max(0, subtotal - previewAmount).toFixed(2)}</dd></div>
          </dl>
        </div>

        <DialogFooter className={cn(formFactor !== "desktop" && "m-0 shrink-0 grid grid-cols-2 border-t border-border px-4 py-3 sm:grid-cols-2", "pb-[max(0.75rem,env(safe-area-inset-bottom))]")}>
          {discount > 0 ? <Button variant="outline" className="h-12" onClick={remove}>Remove</Button> : <Button variant="outline" className="h-12" onClick={onClose}>Cancel</Button>}
          <Button className="h-12" onClick={apply}>Apply discount</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
