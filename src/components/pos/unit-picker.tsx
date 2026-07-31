/**
 * UnitPickerDialog — choose which physical unit to sell.
 *
 * Opens when a serial-tracked equipment product is added at POS. Lists the
 * in-stock units for that product; picking one adds a qty-1 line carrying the
 * unit id, so checkout can flip that exact serial to `sold` with warranty.
 */
import { useEffect, useState } from "react";
import { CircleNotch as Loader2, Wrench } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { availableUnits, specSummary, type EquipmentUnit } from "@/services/equipment";
import { cn } from "@/lib/utils";
import type { PosFormFactor } from "@/components/pos/use-pos-form-factor";

export function UnitPickerDialog({
  formFactor = "desktop",
  open,
  productId,
  productName,
  onPick,
  onClose,
}: {
  formFactor?: PosFormFactor;
  open: boolean;
  productId: string | null;
  productName: string;
  onPick: (unit: EquipmentUnit) => void;
  onClose: () => void;
}) {
  const [units, setUnits] = useState<EquipmentUnit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !productId) {
      setUnits([]);
      return;
    }
    setLoading(true);
    availableUnits(productId)
      .then(setUnits)
      .finally(() => setLoading(false));
  }, [open, productId]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "flex flex-col",
          formFactor === "desktop"
            ? "sm:max-w-lg"
            : "!inset-0 !top-0 !left-0 !h-[100dvh] !max-h-none !w-full !max-w-none !translate-x-0 !translate-y-0 !rounded-none !bg-background !backdrop-blur-none pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] [&_button]:min-h-11 motion-reduce:!duration-0 [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-ring",
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <Wrench className="size-4 text-primary" />
            Choose a unit — {productName}
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            Pick the physical unit being sold. Its warranty starts on this sale.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : units.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-[13px] text-muted-foreground">
            No in-stock units for this product. Receive units first.
          </div>
        ) : (
          <div className={cn("overflow-auto -mx-1 px-1 space-y-2", formFactor === "desktop" ? "max-h-[50vh]" : "min-h-0 flex-1")}>
            {units.map((u) => {
              const spec = specSummary(u.specs_json);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onPick(u)}
                  className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3 text-left hover:border-primary hover:bg-accent transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-[13px] font-medium truncate">SN {u.serial_number}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {[spec, u.year_of_manufacture ? `Year ${u.year_of_manufacture}` : "", u.condition].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  {u.meter_value != null ? (
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground shrink-0">
                      {u.meter_value} {u.meter_unit}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
