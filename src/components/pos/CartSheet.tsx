import type { RefObject } from "react";
import { Heart, Pause, ShoppingCart, Tag, Trash, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MobileCustomerPicker } from "@/components/pos/MobileCustomerPicker";
import { AllergyAlertBanner } from "@/components/pos/allergy-alert-banner";
import { InteractionAlerts } from "@/components/pos/interaction-alerts";
import { money as KES } from "@/lib/money";
import type { MobileCartItem, MobilePosAccent } from "@/components/pos/mobile-pos-types";

interface CartSheetProps {
  open: boolean;
  embedded?: boolean;
  accent: MobilePosAccent;
  items: MobileCartItem[];
  customerId: string | null;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  discountAmount: number;
  tip: number;
  serviceChargeAmount: number;
  taxMode: "off" | "inclusive" | "exclusive";
  shiftOpen: boolean;
  quoteMode: boolean;
  heldCount: number;
  sourceLabel: string | null;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
  onUpdateQty: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  onEditQuantity: (item: MobileCartItem, trigger: HTMLElement) => void;
  onSetTaxMode: (mode: "off" | "inclusive" | "exclusive") => void;
  onPark: () => void;
  onReturns: () => void;
  onDiscount: () => void;
  onTip: () => void;
  onClear: () => void;
  onOpenShift: () => void;
  onCheckout: () => void;
}

export function CartSheet({
  open,
  embedded = false,
  accent,
  items,
  customerId,
  subtotal,
  taxTotal,
  grandTotal,
  discountAmount,
  tip,
  serviceChargeAmount,
  taxMode,
  shiftOpen,
  quoteMode,
  heldCount,
  sourceLabel,
  returnFocusRef,
  onOpenChange,
  onUpdateQty,
  onRemoveItem,
  onEditQuantity,
  onSetTaxMode,
  onPark,
  onReturns,
  onDiscount,
  onTip,
  onClear,
  onOpenShift,
  onCheckout,
}: CartSheetProps) {
  const close = () => {
    onOpenChange(false);
    requestAnimationFrame(() => returnFocusRef?.current?.focus());
  };

  const content = (
    <>
      <div className={`flex items-center justify-between border-b border-border ${embedded ? "px-3 py-3" : "pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]"}`}>
        <div>
          <p className="text-sm font-semibold">Current sale</p>
          <p className="text-xs text-muted-foreground">{items.length} line{items.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onClear}
            disabled={items.length === 0}
            className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-destructive disabled:opacity-40"
          >
            <Trash className="size-5" /> Clear
          </button>
          {!embedded ? (
            <button
              type="button"
              onClick={close}
              className="grid size-11 place-items-center rounded-md text-muted-foreground"
              aria-label="Close cart"
            >
              <X className="size-5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className={`border-b border-border ${embedded ? "p-3" : "py-3"}`}>
        <MobileCustomerPicker />
      </div>

      {sourceLabel ? (
        <div className={`border-b border-border bg-muted/50 ${embedded ? "px-3 py-2" : "py-2"}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Source checkout</p>
          <p className="truncate text-sm font-medium">{sourceLabel}</p>
        </div>
      ) : null}

      {accent.isPharmacy ? (
        <div className={`space-y-2 border-b border-border ${embedded ? "p-3" : "py-3"}`}>
          <InteractionAlerts />
          <AllergyAlertBanner customerId={customerId} productIds={items.map((item) => item.product_id)} />
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {items.length === 0 ? (
          <div className="grid min-h-48 place-items-center px-6 text-center text-sm text-muted-foreground">
            <div>
              <ShoppingCart className="mx-auto mb-3 size-8 opacity-40" />
              <p className="font-semibold text-foreground">Cart is empty</p>
              <p className="mt-1">Close the cart and tap a product to add it.</p>
            </div>
          </div>
        ) : (
          items.map((item) => {
            const lineTotal = Math.max(0, item.unit_price * item.quantity - item.discount);
            return (
              <div key={item.id} className={`border-b border-border ${embedded ? "px-3 py-3" : "py-3"}`}>
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-muted text-sm font-bold">
                    {item.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold leading-tight">{item.name}</p>
                    {(item.variant_label || item.serial) ? (
                      <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {[item.variant_label, item.serial ? `SN ${item.serial}` : null].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{KES(item.unit_price)} each</p>
                  </div>
                  <span className="font-mono text-sm font-bold tabular-nums">{KES(lineTotal)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="inline-flex items-center rounded-md border border-border">
                    <button
                      type="button"
                      onClick={() => onUpdateQty(item.id, item.quantity - 1)}
                      className="grid size-11 place-items-center text-lg"
                      aria-label={`Decrease ${item.name} quantity`}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      onClick={(event) => onEditQuantity(item, event.currentTarget)}
                      className="min-h-11 min-w-12 border-x border-border px-2 font-mono font-bold tabular-nums"
                      aria-label={`Edit ${item.name} quantity, currently ${item.quantity}`}
                    >
                      {item.quantity}
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateQty(item.id, item.quantity + 1)}
                      className="grid size-11 place-items-center text-lg"
                      aria-label={`Increase ${item.name} quantity`}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    className="grid size-11 place-items-center rounded-md text-destructive"
                    aria-label={`Remove ${item.name} from cart`}
                  >
                    <Trash className="size-5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className={`shrink-0 border-t border-border bg-background ${embedded ? "p-3" : "pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"}`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tax mode</span>
          <div className="inline-flex rounded-md border border-border p-0.5">
            {(["off", "inclusive", "exclusive"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onSetTaxMode(mode)}
                aria-pressed={taxMode === mode}
                className={`min-h-11 rounded px-3 text-xs font-semibold ${taxMode === mode ? "bg-foreground text-background" : "text-muted-foreground"}`}
              >
                {mode === "inclusive" ? "Incl" : mode === "exclusive" ? "Excl" : "Off"}
              </button>
            ))}
          </div>
        </div>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-mono tabular-nums">{KES(subtotal)}</dd></div>
          {discountAmount > 0 ? <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd className="font-mono text-emerald-700">−{KES(discountAmount)}</dd></div> : null}
          {taxTotal > 0 ? <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd className="font-mono tabular-nums">{KES(taxTotal)}</dd></div> : null}
          {serviceChargeAmount > 0 ? <div className="flex justify-between"><dt className="text-muted-foreground">Service charge</dt><dd className="font-mono tabular-nums">+{KES(serviceChargeAmount)}</dd></div> : null}
          {tip > 0 ? <div className="flex justify-between"><dt className="text-muted-foreground">Tip</dt><dd className="font-mono tabular-nums">+{KES(tip)}</dd></div> : null}
          <div className="flex items-end justify-between border-t border-border pt-2"><dt className="font-semibold">Total</dt><dd className={`font-mono text-xl font-bold tabular-nums ${accent.accentText}`}>{KES(grandTotal)}</dd></div>
        </dl>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={onPark} className="flex min-h-11 items-center justify-center gap-1 rounded-md border border-border text-xs font-semibold">
            <Pause className="size-4" /> Hold / recall{heldCount > 0 ? ` (${heldCount})` : ""}
          </button>
          <button type="button" onClick={onReturns} className="flex min-h-11 items-center justify-center gap-1 rounded-md border border-border text-xs font-semibold">
            <span aria-hidden>↩</span> Returns
          </button>
          <button type="button" onClick={onDiscount} disabled={items.length === 0} className="flex min-h-11 items-center justify-center gap-1 rounded-md border border-border text-xs font-semibold disabled:opacity-40"><Tag className="size-4" /> Discount</button>
          <button type="button" onClick={onTip} disabled={items.length === 0} className="flex min-h-11 items-center justify-center gap-1 rounded-md border border-border text-xs font-semibold disabled:opacity-40"><Heart className="size-4" /> Tip</button>
        </div>
        <Button
          className={`mt-2 h-14 w-full text-base font-semibold text-white ${accent.pay}`}
          disabled={items.length === 0 || !shiftOpen}
          onClick={onCheckout}
        >
          {quoteMode ? "Save quote" : "Review payment"} · {KES(grandTotal)}
        </Button>
        {!shiftOpen && items.length > 0 ? (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-2">
            <p className="text-xs font-medium text-destructive">A cash shift is required to complete sales.</p>
            <Button variant="outline" className="h-11 shrink-0" onClick={onOpenShift}>Open shift</Button>
          </div>
        ) : null}
      </div>
    </>
  );

  if (embedded) {
    return <aside className="flex min-h-0 flex-col border-l border-border bg-background" aria-label="Cart">{content}</aside>;
  }

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="!inset-0 !h-[100dvh] !max-h-none !w-full !max-w-none !rounded-none !bg-background !backdrop-blur-none motion-reduce:!transition-none [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-ring [&_button]:focus-visible:ring-offset-2"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Cart</SheetTitle>
          <SheetDescription>Review products, customer, tax, and sale total.</SheetDescription>
        </SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  );
}
