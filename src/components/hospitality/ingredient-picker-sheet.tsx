/**
 * IngredientPickerSheet — right-side sheet for adding ingredients to a
 * recipe. Reuses the inventory product list + search + category chips +
 * the existing ProductPanel for creating a new raw ingredient inline
 * (chef doesn't have to leave the recipe builder to onboard a new
 * spice).
 *
 * Design choices:
 *  - Multi-select. Chefs building a recipe often add 4-8 ingredients
 *    at once; single-pick means many round trips.
 *  - Stock-health colour on each row so the chef sees which ingredients
 *    are already scarce before designing the recipe around them.
 *  - "+ New ingredient" opens the same ProductPanel the Inventory tab
 *    uses. Whatever workflow works there works here.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Check, Warning } from "@phosphor-icons/react";
import { getProducts, getCategories, type Product, type Category } from "@/services/inventory";
import { ProductPanel } from "@/components/inventory/product-panel";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Product ids already used by the current recipe — hidden from the
   *  picker so the chef can't double-add. */
  excludeIds?: string[];
  /** Fires with the picked product ids when the user confirms. */
  onPick: (productIds: string[]) => void;
}

export function IngredientPickerSheet({ open, onClose, excludeIds = [], onPick }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [newProductOpen, setNewProductOpen] = useState(false);

  const load = () => {
    Promise.all([getProducts(), getCategories()]).then(([p, c]) => {
      setProducts(p);
      setCategories(c);
    });
  };

  useEffect(() => {
    if (!open) return;
    load();
    setSearch("");
    setCategoryFilter(null);
    setPicked(new Set());
  }, [open]);

  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (excludeSet.has(p.id)) return false;
      if (categoryFilter && p.category_id !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.sku?.toLowerCase().includes(q) ?? false) ||
          (p.barcode?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [products, categoryFilter, search, excludeSet]);

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirm = () => {
    if (picked.size === 0) {
      toast.error("Pick at least one ingredient");
      return;
    }
    onPick(Array.from(picked));
    onClose();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle>Add ingredients</SheetTitle>
            <SheetDescription>
              Pick from your inventory. Everything here is a real product with real stock —
              recipes deduct these when a menu item is sold.
            </SheetDescription>
          </SheetHeader>

          {/* Search + category filter */}
          <div className="px-5 pt-3 pb-2 space-y-2 border-b border-border">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, SKU, barcode…"
              autoFocus
            />
            {categories.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setCategoryFilter(null)}
                  className={cn(
                    "text-[11px] px-2 py-0.5 rounded-full border transition-colors",
                    categoryFilter === null
                      ? "border-foreground/30 bg-foreground/[0.06] text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  All
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategoryFilter(c.id)}
                    className={cn(
                      "text-[11px] px-2 py-0.5 rounded-full border transition-colors",
                      categoryFilter === c.id
                        ? "border-foreground/30 bg-foreground/[0.06] text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Product list */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground italic">
                {search
                  ? "No matching ingredients in inventory."
                  : "No ingredients available (all already in this recipe or none in inventory)."}
              </div>
            ) : (
              <ul>
                {filtered.map((p) => {
                  const isPicked = picked.has(p.id);
                  const stock = p.stock_qty ?? 0;
                  const low = p.reorder_level > 0 && stock <= p.reorder_level;
                  const out = stock <= 0;
                  return (
                    <li
                      key={p.id}
                      onClick={() => toggle(p.id)}
                      className={cn(
                        "flex items-center gap-3 px-5 py-2.5 border-b border-border cursor-pointer transition-colors",
                        isPicked ? "bg-primary/[0.08]" : "hover:bg-accent/40",
                      )}
                    >
                      <div
                        className={cn(
                          "shrink-0 size-5 rounded border grid place-items-center transition-colors",
                          isPicked
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border",
                        )}
                      >
                        {isPicked ? <Check size={12} weight="bold" /> : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          {p.category_name ? <span>{p.category_name}</span> : null}
                          {p.sku ? <span className="font-mono">{p.sku}</span> : null}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div
                          className={cn(
                            "text-xs font-mono tabular-nums",
                            out
                              ? "text-rose-600"
                              : low
                              ? "text-amber-600"
                              : "text-muted-foreground",
                          )}
                        >
                          {stock} {p.unit}
                        </div>
                        {out ? (
                          <div className="text-[9px] text-rose-600 inline-flex items-center gap-0.5">
                            <Warning size={9} /> out
                          </div>
                        ) : low ? (
                          <div className="text-[9px] text-amber-600">low</div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <SheetFooter className="border-t border-border p-3 flex-row gap-2 sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNewProductOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" /> New ingredient
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground font-mono">
                {picked.size} selected
              </span>
              <Button size="sm" onClick={confirm} disabled={picked.size === 0}>
                Add {picked.size > 0 ? picked.size : ""}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Nested — the real inventory ProductPanel. When a new product is
       *  saved, we reload the list and auto-tick the new id so the chef
       *  can hit Confirm immediately. */}
      <ProductPanel
        open={newProductOpen}
        onClose={() => setNewProductOpen(false)}
        productId={null}
        onSaved={(savedId) => {
          setNewProductOpen(false);
          load();
          if (savedId) {
            setPicked((prev) => {
              const next = new Set(prev);
              next.add(savedId);
              return next;
            });
          }
        }}
      />
    </>
  );
}
