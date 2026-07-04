import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { UnitSelect } from "@/components/ui/unit-select";
import { getProducts, type Product } from "@/services/inventory";
import { getRecipeForMenuItem, replaceRecipe, type RecipeIngredientRow } from "@/services/hospitality";
import { money as KES } from "@/lib/money";
import { toast } from "sonner";
import { Trash, Plus } from "@phosphor-icons/react";

interface Line {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  wastagePercent: number;
  buyingPrice: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  menuItemId: string;
  menuItemName: string;
}

export function RecipeDialog({ open, onClose, menuItemId, menuItemName }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [yieldQty, setYieldQty] = useState(1);
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    getProducts().then(setProducts);
    getRecipeForMenuItem(menuItemId).then((r) => {
      if (r) {
        setYieldQty(r.yield_quantity);
        setLines(r.ingredients.map((i: RecipeIngredientRow) => ({
          productId: i.product_id,
          productName: i.product_name,
          quantity: i.quantity,
          unit: i.unit,
          wastagePercent: i.wastage_percent,
          buyingPrice: i.buying_price,
        })));
      } else {
        setYieldQty(1);
        setLines([]);
      }
    });
  }, [open, menuItemId]);

  const totalCost = lines.reduce((s, l) => s + l.quantity * l.buyingPrice * (1 + l.wastagePercent / 100), 0);

  const addLine = () => setLines([...lines, { productId: "", productName: "", quantity: 0, unit: "g", wastagePercent: 0, buyingPrice: 0 }]);

  const removeLine = (i: number) => setLines(lines.filter((_, j) => j !== i));

  const patch = (i: number, p: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...p } : l)));

  const productOptions = products.map((p) => ({ value: p.id, label: p.name }));

  const save = async () => {
    if (lines.length === 0) {
      toast.error("Add at least one ingredient");
      return;
    }
    if (lines.some((l) => !l.productId || l.quantity <= 0)) {
      toast.error("Every line needs a product + quantity");
      return;
    }
    setSaving(true);
    try {
      await replaceRecipe(menuItemId, yieldQty, lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unit: l.unit,
        wastagePercent: l.wastagePercent,
      })));
      toast.success("Recipe saved");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save recipe");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Recipe · {menuItemName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Recipe yields</span>
            <Input
              type="number"
              value={yieldQty}
              onChange={(e) => setYieldQty(Number(e.target.value) || 1)}
              className="w-24"
              min={1}
            />
            <span className="text-xs text-muted-foreground">serving(s)</span>
          </div>

          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 w-2/5">Ingredient</th>
                  <th className="text-right px-3 py-2">Qty</th>
                  <th className="text-left px-3 py-2 w-16">Unit</th>
                  <th className="text-right px-3 py-2 w-24">Waste %</th>
                  <th className="text-right px-3 py-2">Cost</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2">
                      <Combobox
                        value={l.productId}
                        onChange={(v) => {
                          const p = products.find((pp) => pp.id === v);
                          patch(i, {
                            productId: v,
                            productName: p?.name ?? "",
                            buyingPrice: (p as unknown as { buying_price?: number })?.buying_price ?? 0,
                          });
                        }}
                        options={productOptions}
                        placeholder="Pick product…"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        step="0.01"
                        value={l.quantity}
                        onChange={(e) => patch(i, { quantity: Number(e.target.value) })}
                        className="w-24 text-right font-mono"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <UnitSelect
                        value={l.unit}
                        onChange={(v) => patch(i, { unit: v })}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        step="1"
                        value={l.wastagePercent}
                        onChange={(e) => patch(i, { wastagePercent: Number(e.target.value) })}
                        className="w-16 text-right font-mono"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-xs text-muted-foreground">
                      {KES(l.quantity * l.buyingPrice * (1 + l.wastagePercent / 100))}
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => removeLine(i)} className="text-muted-foreground hover:text-rose-600" title="Remove">
                        <Trash size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No ingredients yet — click Add ingredient below.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/20 font-mono text-xs">
                  <td colSpan={4} className="px-3 py-2 text-right uppercase tracking-wide text-muted-foreground">Cost per recipe</td>
                  <td className="px-3 py-2 text-right font-medium">{KES(totalCost)}</td>
                  <td />
                </tr>
                <tr className="bg-muted/20 font-mono text-xs">
                  <td colSpan={4} className="px-3 py-2 text-right uppercase tracking-wide text-muted-foreground">Cost per serving</td>
                  <td className="px-3 py-2 text-right font-medium">{KES(totalCost / (yieldQty || 1))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <Button variant="outline" size="sm" onClick={addLine} className="gap-1">
            <Plus size={14} />
            Add ingredient
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save recipe"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
