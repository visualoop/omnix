/**
 * Promo code dialog for POS.
 * Lets cashier enter a promo code or picks from active promotions.
 */
import { useState, useEffect } from "react";
import {
  MagnifyingGlass as Search,
  Tag,
} from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getActivePromotions, getPromotionByCode, computePromotionDiscount, type Promotion, type PromotionType } from "@/services/promotions";
import { useCartStore } from "@/stores/cart";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (discount: number, discountType: "percent" | "amount", promo?: { id: string; name: string }) => void;
}

function typeLabel(t: PromotionType): string {
  if (t === "percent_off") return "% off";
  if (t === "amount_off") return "KES off";
  return "Buy X Get Y";
}

export function PromoDialog({ open, onClose, onApply }: Props) {
  const [activePromos, setActivePromos] = useState<Promotion[]>([]);
  const [code, setCode] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (open) {
      getActivePromotions().then(setActivePromos);
      setCode("");
    }
  }, [open]);

  const applyPromo = (promo: Promotion) => {
    // Compute the real KES discount against the current cart (RT-12), so
    // buy_x_get_y + product/category targets are honoured, not just a flat %.
    const cart = useCartStore.getState();
    const lines = cart.items
      .filter((i) => !i.menu_item_id)
      .map((i) => ({ product_id: i.product_id, category_id: i.category_id ?? null, quantity: i.quantity, unit_price: i.unit_price }));
    const discount = computePromotionDiscount(promo, lines);
    if (discount <= 0) {
      toast.error(`${promo.name} doesn't apply to this cart (check minimum spend or eligible items)`);
      return;
    }
    onApply(discount, "amount", { id: promo.id, name: promo.name });
    toast.success(`Applied: ${promo.name} (−${discount.toFixed(0)})`);
    onClose();
  };

  const applyActive = (promo: Promotion) => applyPromo(promo);

  const searchCode = async () => {
    const c = code.trim();
    if (!c) { toast.error("Enter a promo code"); return; }
    setSearching(true);
    try {
      const promo = await getPromotionByCode(c);
      if (!promo) {
        toast.error("Invalid or expired promo code");
        return;
      }
      applyPromo(promo);
    } catch (e) {
      toast.error(String(e));
    } finally { setSearching(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-violet-400" /> Apply Promotion
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Promo code</label>
            <div className="flex gap-1.5">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g., WELCOME10"
                onKeyDown={(e) => e.key === "Enter" && searchCode()}
                className="flex-1"
              />
              <Button size="sm" onClick={searchCode} disabled={searching}>
                <Search className="h-3.5 w-3.5 mr-1" /> Apply
              </Button>
            </div>
          </div>

          {activePromos.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">Active promotions</label>
              <div className="space-y-1.5 max-h-48 overflow-auto">
                {activePromos.map((promo) => (
                  <button
                    key={promo.id}
                    onClick={() => applyActive(promo)}
                    className="w-full text-left p-2.5 rounded border border-border hover:bg-accent transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{promo.name}</span>
                      <Badge className="h-4 text-[9px] bg-violet-500/10 text-violet-400 border-violet-500/30">
                        {typeLabel(promo.type)}
                      </Badge>
                    </div>
                    {promo.code && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Code: {promo.code}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activePromos.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">
              No active promotions right now
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
