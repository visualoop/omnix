import { useEffect, useState, useCallback } from "react";
import {
  CircleNotch as Loader2,
  DotsSixVertical as GripVertical,
  Plus,
  Stack as Layers,
  Trash as Trash2,
} from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirm } from "@/components/ui/confirm-dialog";
import { listVariants, upsertVariant, deleteVariant, adjustVariantStock, type ProductVariant } from "@/services/retail";
import type { Product } from "@/services/inventory";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  product: Product | null;
  onClose: () => void;
  onSaved?: () => void;
}

interface DraftRow {
  /** Stable client key. id present = persisted. Falsy = new (unsaved). */
  key: string;
  id?: string;
  variant_name: string;
  variant_sku: string;
  selling_price: string; // string so empty input → null (inherit from product)
  stock_qty: string;
  /** Server stock at load time — used to compute the movement delta on save. */
  original_stock: number;
  sort_order: number;
  /** Has unsaved changes vs server. */
  dirty: boolean;
}

function rowFromVariant(v: ProductVariant): DraftRow {
  return {
    key: v.id,
    id: v.id,
    variant_name: v.variant_name,
    variant_sku: v.variant_sku,
    selling_price: v.selling_price !== null ? String(v.selling_price) : "",
    stock_qty: String(v.stock_qty ?? 0),
    original_stock: Number(v.stock_qty ?? 0),
    sort_order: v.sort_order ?? 0,
    dirty: false,
  };
}

function genSku(productSku: string | null, label: string, idx: number): string {
  const prefix = productSku || "PRD";
  // "50 kg" → "50KG"
  const slug = label.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 8) || `V${idx + 1}`;
  return `${prefix}-${slug}`;
}

/**
 * Variants management dialog.
 *
 * Common use case: same product sold at different sizes/weights with different
 * prices. Example: "Maize flour" → variants 5kg KES 350, 10kg KES 680, 25kg KES 1600.
 *
 * Each variant has its own SKU, price, and stock. Leave price blank to inherit
 * from the parent product.
 */
export function VariantsDialog({ product, onClose, onSaved }: Props) {
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!product) return;
    setLoading(true);
    try {
      const vs = await listVariants(product.id, true);
      setRows(vs.map(rowFromVariant));
    } catch (e) {
      toast.error(`Could not load variants: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [product]);

  useEffect(() => {
    if (product) {
      reload();
    } else {
      setRows([]);
    }
  }, [product, reload]);

  if (!product) return null;

  const update = (key: string, patch: Partial<DraftRow>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, dirty: true } : r)));
  };

  const addRow = () => {
    const idx = rows.length;
    setRows((rs) => [
      ...rs,
      {
        key: `new-${Date.now()}-${idx}`,
        variant_name: "",
        variant_sku: "",
        selling_price: "",
        stock_qty: "0",
        original_stock: 0,
        sort_order: idx,
        dirty: true,
      },
    ]);
  };

  const removeRow = async (row: DraftRow) => {
    if (row.id) {
      const ok = await confirm({
        title: `Delete "${row.variant_name}"?`,
        description: "This variant cannot be recovered. Sales history is unaffected.",
        confirmText: "Delete",
        variant: "destructive",
      });
      if (!ok) return;
      try {
        await deleteVariant(row.id);
        toast.success("Variant deleted");
      } catch (e) {
        toast.error(`Delete failed: ${e}`);
        return;
      }
    }
    setRows((rs) => rs.filter((r) => r.key !== row.key));
  };

  const saveAll = async () => {
    // Validate
    for (const r of rows) {
      if (!r.variant_name.trim()) {
        toast.error("Every variant needs a name (e.g. 50kg, Large, Red).");
        return;
      }
      if (r.selling_price && Number.isNaN(Number(r.selling_price))) {
        toast.error(`"${r.variant_name}" has an invalid price.`);
        return;
      }
    }
    setSaving(true);
    try {
      let i = 0;
      for (const r of rows) {
        if (!r.dirty) {
          i += 1;
          continue;
        }
        const sku = r.variant_sku.trim() || genSku(product.sku, r.variant_name, i);
        const sellingPrice = r.selling_price === "" ? null : Number(r.selling_price);
        const stockQty = r.stock_qty === "" ? 0 : Number(r.stock_qty);

        const savedId = await upsertVariant({
          id: r.id,
          product_id: product.id,
          variant_name: r.variant_name.trim(),
          variant_sku: sku,
          selling_price: sellingPrice,
          // On CREATE this sets opening stock; on UPDATE upsertVariant ignores
          // it (stock only moves via adjustVariantStock), so reconcile below.
          stock_qty: stockQty,
          sort_order: r.sort_order ?? i,
          active: 1,
        });
        // Existing variant: the UPDATE path doesn't persist stock_qty, so post
        // the delta as an auditable stock movement (RT-6).
        if (r.id) {
          const delta = stockQty - r.original_stock;
          if (delta !== 0) {
            await adjustVariantStock(savedId, delta, "Manual stock edit", undefined);
          }
        }
        i += 1;
      }
      toast.success("Variants saved");
      await reload();
      onSaved?.();
    } catch (e) {
      toast.error(`Save failed: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const dirtyCount = rows.filter((r) => r.dirty).length;
  const validCount = rows.filter((r) => r.variant_name.trim()).length;

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Variants — {product.name}
          </DialogTitle>
          <DialogDescription>
            Same product, different size or weight (e.g. 5kg, 10kg, 25kg). Each variant has its own price and stock.
            Leave price blank to inherit from the product (KES {product.selling_price.toFixed(2)}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1 -mr-1">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading variants…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 px-4">
              <Layers className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No variants yet.</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Add one when the same product comes in different sizes or weights.
              </p>
            </div>
          ) : (
            <>
              {/* Headers */}
              <div className="grid grid-cols-[16px_2fr_1fr_110px_90px_28px] gap-2 px-2 pt-1 pb-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                <span />
                <span>Name</span>
                <span>SKU</span>
                <span className="text-right">Price (KES)</span>
                <span className="text-right">Stock</span>
                <span />
              </div>

              {rows.map((r, idx) => (
                <div
                  key={r.key}
                  className={cn(
                    "grid grid-cols-[16px_2fr_1fr_110px_90px_28px] gap-2 items-center rounded-lg border px-2 py-1.5 transition-colors",
                    r.dirty ? "border-primary/40 bg-primary/[0.03]" : "border-border/60",
                  )}
                >
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
                  <Input
                    value={r.variant_name}
                    onChange={(e) => update(r.key, { variant_name: e.target.value })}
                    placeholder={`e.g. 50kg or Large`}
                    autoFocus={idx === rows.length - 1 && !r.id}
                  />
                  <Input
                    value={r.variant_sku}
                    onChange={(e) => update(r.key, { variant_sku: e.target.value.toUpperCase() })}
                    placeholder="auto"
                    className="font-mono text-xs"
                  />
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={r.selling_price}
                    onChange={(e) => update(r.key, { selling_price: e.target.value })}
                    placeholder={`${product.selling_price.toFixed(0)}`}
                    className="font-mono text-right tabular-nums"
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={r.stock_qty}
                    onChange={(e) => update(r.key, { stock_qty: e.target.value })}
                    placeholder="0"
                    className="font-mono text-right tabular-nums"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeRow(r)}
                    title="Delete variant"
                    className="text-muted-foreground hover:text-destructive cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 -mb-1">
          <Button variant="outline" size="sm" onClick={addRow} className="rounded-lg cursor-pointer">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add variant
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {validCount} variant{validCount === 1 ? "" : "s"}
              {dirtyCount > 0 && <span className="text-primary"> · {dirtyCount} unsaved</span>}
            </span>
            <Button variant="outline" size="sm" onClick={onClose} className="rounded-lg cursor-pointer">Close</Button>
            <Button size="sm" onClick={saveAll} disabled={saving || dirtyCount === 0} className="rounded-lg cursor-pointer">
              {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Saving…</> : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
