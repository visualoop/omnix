import type { RefObject } from "react";
import { CaretUp, ShoppingCart } from "@phosphor-icons/react";
import { money as KES } from "@/lib/money";

interface CartSummaryBarProps {
  buttonRef: RefObject<HTMLButtonElement | null>;
  itemCount: number;
  unitCount: number;
  total: number;
  onOpen: () => void;
}

export function CartSummaryBar({ buttonRef, itemCount, unitCount, total, onOpen }: CartSummaryBarProps) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/98 px-3 pt-2 backdrop-blur-sm"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={onOpen}
        className="flex min-h-14 w-full items-center gap-3 rounded-md bg-foreground px-4 text-background active:scale-[0.985] motion-reduce:transform-none"
        aria-label={`Open cart, ${unitCount} units, total ${KES(total)}`}
      >
        <span className="relative grid size-10 place-items-center rounded-md bg-background/10">
          <ShoppingCart className="size-5" aria-hidden />
          {itemCount > 0 ? (
            <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-background px-1 font-mono text-[10px] font-bold text-foreground">
              {itemCount}
            </span>
          ) : null}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-semibold">{itemCount === 0 ? "Cart is empty" : `${unitCount} unit${unitCount === 1 ? "" : "s"}`}</span>
          <span className="block text-xs opacity-70">Tap to review sale</span>
        </span>
        <span className="font-mono text-lg font-bold tabular-nums">{KES(total)}</span>
        <CaretUp className="size-4 opacity-70" aria-hidden />
      </button>
    </div>
  );
}
