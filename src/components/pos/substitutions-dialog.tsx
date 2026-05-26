import { useEffect, useState } from "react";
import { Pill, X, ArrowDownRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { suggestSubstitutionsFromGeneric, getSubstitutions } from "@/services/pharmacy-extras";
import { useCartStore } from "@/stores/cart";
import type { Product } from "@/services/inventory";
import { toast } from "sonner";

interface Props {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  /** Called when user confirms — switches the cart line to the substitute. */
  onSwap?: (originalId: string, substitute: SuggestedSub) => void;
}

export interface SuggestedSub {
  id: string;
  name: string;
  sku?: string;
  selling_price: number;
  stock?: number;
  generic_name?: string | null;
  source: "manual" | "generic";
  notes?: string | null;
}

export function SubstitutionsDialog({ open, product, onClose, onSwap }: Props) {
  const [manual, setManual] = useState<any[]>([]);
  const [generics, setGenerics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const cart = useCartStore();

  useEffect(() => {
    if (open && product) {
      setLoading(true);
      Promise.all([
        getSubstitutions(product.id),
        suggestSubstitutionsFromGeneric(product.id),
      ])
        .then(([m, g]) => { setManual(m); setGenerics(g); })
        .catch(() => { setManual([]); setGenerics([]); })
        .finally(() => setLoading(false));
    }
  }, [open, product]);

  if (!open || !product) return null;

  const allSubs: SuggestedSub[] = [
    ...manual.map((s) => ({
      id: s.substitute_product_id,
      name: s.substitute_name,
      sku: s.substitute_sku,
      selling_price: s.substitute_price,
      stock: s.substitute_stock,
      generic_name: s.substitute_generic,
      source: "manual" as const,
      notes: s.notes,
    })),
    ...generics
      .filter((g) => !manual.find((m) => m.substitute_product_id === g.id))
      .map((g) => ({
        id: g.id,
        name: g.name,
        sku: g.sku,
        selling_price: g.selling_price,
        stock: g.stock,
        generic_name: g.generic_name,
        source: "generic" as const,
      })),
  ];

  const handleSelect = (sub: SuggestedSub) => {
    if (sub.stock === 0) {
      if (!confirm("This substitute is out of stock. Continue anyway?")) return;
    }
    if (onSwap) {
      onSwap(product.id, sub);
    } else {
      // Default: replace the line in cart
      cart.removeItem(product.id);
      cart.addItem({
        id: sub.id,
        name: sub.name,
        selling_price: sub.selling_price,
        tax_rate: 16,
      });
      toast.success(`Switched to ${sub.name}`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-semibold flex items-center gap-2">
            <Pill className="h-4 w-4 text-primary" /> Substitutes for {product.name}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Finding alternatives...
            </div>
          ) : allSubs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Pill className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No substitutes found</p>
              <p className="text-xs mt-1">Add substitutes from Inventory → Product detail</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {allSubs.map((sub) => {
                const priceDiff = sub.selling_price - product.selling_price;
                const cheaper = priceDiff < 0;
                const outOfStock = sub.stock === 0;
                return (
                  <button
                    key={sub.id}
                    onClick={() => handleSelect(sub)}
                    disabled={outOfStock && false /* allow with confirm */}
                    className="w-full text-left px-4 py-3 hover:bg-muted/30 disabled:opacity-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{sub.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${sub.source === "manual" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {sub.source === "manual" ? "Suggested" : "Same generic"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          {sub.sku && <span className="font-mono">{sub.sku}</span>}
                          {sub.generic_name && <span>· {sub.generic_name}</span>}
                          <span className={outOfStock ? "text-red-600 font-medium" : ""}>
                            · Stock: {sub.stock ?? 0}
                          </span>
                        </div>
                        {sub.notes && <p className="text-xs italic text-muted-foreground mt-1">{sub.notes}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono text-sm">KES {sub.selling_price.toFixed(2)}</div>
                        {priceDiff !== 0 && (
                          <div className={`text-xs flex items-center justify-end gap-0.5 ${cheaper ? "text-emerald-700" : "text-amber-700"}`}>
                            <ArrowDownRight className={`h-3 w-3 ${!cheaper && "rotate-180"}`} />
                            {Math.abs(priceDiff).toFixed(0)}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground flex justify-between items-center">
          <span>Click a substitute to swap it into the cart</span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <Check className="h-3.5 w-3.5 mr-1" /> Keep original
          </Button>
        </div>
      </div>
    </div>
  );
}
