import { useEffect, useRef, useState, type RefObject } from "react";
import { Minus, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { MobileCartItem } from "@/components/pos/mobile-pos-types";

interface MobileQuantitySheetProps {
  open: boolean;
  item: MobileCartItem | null;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
  onConfirm: (quantity: number) => void;
}

export function MobileQuantitySheet({ open, item, returnFocusRef, onOpenChange, onConfirm }: MobileQuantitySheetProps) {
  const [quantity, setQuantity] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const max = item?.stock_qty !== undefined && Number.isFinite(item.stock_qty) ? Math.max(1, item.stock_qty) : 99;

  useEffect(() => {
    if (!open || !item) return;
    setQuantity(Math.min(max, Math.max(1, item.quantity)));
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [open, item, max]);

  const close = () => {
    onOpenChange(false);
    requestAnimationFrame(() => returnFocusRef?.current?.focus());
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="!inset-0 !h-[100dvh] !max-h-none !w-full !max-w-none !rounded-none !bg-background !backdrop-blur-none motion-reduce:!transition-none [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-ring [&_button]:focus-visible:ring-offset-2"
      >
        <SheetHeader className="pt-[max(1rem,env(safe-area-inset-top))]">
          <SheetTitle>Edit quantity</SheetTitle>
          <SheetDescription>{item?.name ?? "Cart item"} · maximum {max}</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-6 py-6">
          <div className="mx-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              className="grid size-14 place-items-center rounded-md border border-border active:scale-[0.97] motion-reduce:transform-none"
              aria-label="Decrease quantity"
            >
              <Minus className="size-6" />
            </button>
            <label>
              <span className="sr-only">Quantity</span>
              <input
                ref={inputRef}
                type="number"
                inputMode="numeric"
                min={1}
                max={max}
                value={quantity}
                onChange={(event) => setQuantity(Math.min(max, Math.max(1, Number(event.target.value) || 1)))}
                className="h-20 w-28 rounded-md border border-input bg-background text-center font-mono text-4xl font-bold tabular-nums outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </label>
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.min(max, value + 1))}
              className="grid size-14 place-items-center rounded-md border border-border active:scale-[0.97] motion-reduce:transform-none"
              aria-label="Increase quantity"
            >
              <Plus className="size-6" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 5, 10].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setQuantity(Math.min(max, preset))}
                className="min-h-12 rounded-md border border-border font-mono font-semibold active:scale-[0.97] motion-reduce:transform-none"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-border py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <Button variant="outline" className="h-12" onClick={close}>Cancel</Button>
          <Button
            className="h-12"
            onClick={() => {
              onConfirm(quantity);
              close();
            }}
          >
            Update quantity
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
