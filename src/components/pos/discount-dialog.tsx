import { useState } from "react";
import { Percent, DollarSign, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCartStore } from "@/stores/cart";

export function DiscountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { discount, discountType, setDiscount, subtotal } = useCartStore();
  const [type, setType] = useState<"amount" | "percent">(discountType);
  const [value, setValue] = useState(String(discount));

  if (!open) return null;

  const apply = () => {
    const n = parseFloat(value) || 0;
    setDiscount(n, type);
    onClose();
  };

  const remove = () => {
    setDiscount(0, "amount");
    onClose();
  };

  const previewAmount = type === "percent"
    ? subtotal() * (parseFloat(value) || 0) / 100
    : (parseFloat(value) || 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-semibold">Cart Discount</h2>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="p-5 space-y-4">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setType("amount")}
              className={`px-3 py-2 rounded-md border text-sm flex items-center justify-center gap-2 ${
                type === "amount" ? "border-primary bg-primary/5 font-medium" : "border-border"
              }`}
            >
              <DollarSign className="h-4 w-4" /> Amount (KES)
            </button>
            <button
              onClick={() => setType("percent")}
              className={`px-3 py-2 rounded-md border text-sm flex items-center justify-center gap-2 ${
                type === "percent" ? "border-primary bg-primary/5 font-medium" : "border-border"
              }`}
            >
              <Percent className="h-4 w-4" /> Percent (%)
            </button>
          </div>

          {/* Value */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {type === "amount" ? "Discount amount" : "Discount percent"}
            </label>
            <div className="relative">
              <Input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="text-xl font-mono h-12"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && apply()}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                {type === "amount" ? "KES" : "%"}
              </span>
            </div>
          </div>

          {/* Preview */}
          <div className="border border-border rounded-md p-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">KES {subtotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-amber-700">Discount</span>
              <span className="font-mono text-amber-700">- {previewAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold pt-1 border-t border-border">
              <span>After discount</span>
              <span className="font-mono">{Math.max(0, subtotal() - previewAmount).toFixed(2)}</span>
            </div>
          </div>

          {/* Quick presets */}
          {type === "percent" && (
            <div className="flex gap-1.5">
              {[5, 10, 15, 20].map((p) => (
                <button
                  key={p}
                  onClick={() => setValue(String(p))}
                  className="flex-1 px-2 py-1.5 rounded-md border border-border text-xs hover:bg-accent/50"
                >
                  {p}%
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            {discount > 0 && (
              <Button variant="outline" onClick={remove} className="flex-1">Remove</Button>
            )}
            <Button onClick={apply} className="flex-1">Apply</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
