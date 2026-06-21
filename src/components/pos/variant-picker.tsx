import { useEffect, useState } from "react";
import {
  Package,
} from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listVariants, type ProductVariant } from "@/services/retail";
import type { Product } from "@/services/inventory";

interface Props {
  product: Product | null;
  onClose: () => void;
  onPick: (product: Product, variant: ProductVariant | null) => void;
}

/**
 * Shows a variant picker when a product has variants.
 * If the product has no variants, calls onPick with null variant immediately.
 */
export function VariantPickerDialog({ product, onClose, onPick }: Props) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!product) return;
    setLoading(true);
    listVariants(product.id, false).then((vs) => {
      setVariants(vs);
      setLoading(false);
      // No variants → just add product directly and close
      if (vs.length === 0) {
        onPick(product, null);
      }
    }).catch(() => {
      onPick(product, null);
    });
  }, [product?.id]);

  if (!product) return null;

  // While loading or if no variants, no UI needed
  if (loading || variants.length === 0) {
    return null;
  }

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pick variant — {product.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 py-2 max-h-96 overflow-auto">
          {variants.map((v) => {
            const oos = v.stock_qty <= 0;
            const price = v.selling_price ?? product.selling_price;
            return (
              <button
                key={v.id}
                type="button"
                disabled={oos}
                onClick={() => { onPick(product, v); onClose(); }}
                className={`w-full text-left p-2.5 rounded-md border border-border flex items-center gap-3 transition ${
                  oos ? "opacity-40 cursor-not-allowed" : "hover:bg-accent hover:border-primary"
                }`}
              >
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                  {v.image_path ? (
                    <img src={v.image_path} alt={v.variant_name} className="h-full w-full object-cover rounded" />
                  ) : (
                    <Package className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{v.variant_name}</div>
                  <div className="text-[10px] text-muted-foreground flex gap-2">
                    {v.color && <span>{v.color}</span>}
                    {v.size && <span>{v.size}</span>}
                    {v.shade && <span>{v.shade}</span>}
                    <span className="font-mono">{v.variant_sku}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">KES {price.toFixed(0)}</div>
                  <div className={`text-[10px] ${oos ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                    {oos ? "Out of stock" : `${v.stock_qty} avail`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
