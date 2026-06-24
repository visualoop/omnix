import { useState, useEffect } from "react";
import {
  Calendar,
  CircleNotch as Loader2,
  MagnifyingGlass as Search,
  Package,
  Plus,
  Trash as Trash2,
} from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getProducts, type Product } from "@/services/inventory";
import { execute } from "@/lib/db";
import { useAuthStore } from "@/stores/auth";
import { getActiveBranchId } from "@/stores/active-branch";
import { toast } from "sonner";

interface StockLine {
  product_id: string;
  product_name: string;
  quantity: string;
  buying_price: string;
  expiry_date: string;
  batch_number: string;
}

export function ReceiveStockDialog({ open, onClose, onSaved, supplierName, prefillProductId }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  supplierName?: string;
  /** Optional product to seed into the line list when the dialog opens — used by /inventory/products/:id "Receive stock" action so the user doesn't have to search again. */
  prefillProductId?: string;
}) {
  const userId = useAuthStore((s) => s.user?.id);
  const [supplier, setSupplier] = useState(supplierName || "");
  const [reference, setReference] = useState("");
  const [items, setItems] = useState<StockLine[]>([]);
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSupplier(supplierName || "");
      setReference("");
      setItems([]);
      setSearch("");
    }
  }, [open, supplierName]);

  // When opened with a prefill, fetch the product + add as a line. Runs
  // once per open with prefill, never overwrites if the user already
  // started building lines.
  useEffect(() => {
    if (!open || !prefillProductId) return;
    if (items.length > 0) return;
    let cancelled = false;
    getProducts().then((all) => {
      if (cancelled) return;
      const p = all.find((x) => x.id === prefillProductId);
      if (!p) return;
      setItems([
        {
          product_id: p.id,
          product_name: p.name,
          quantity: "1",
          buying_price: String(p.buying_price || 0),
          expiry_date: "",
          batch_number: "",
        },
      ]);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefillProductId]);

  useEffect(() => {
    if (search) getProducts(search).then(setProducts);
    else setProducts([]);
  }, [search]);

  const totalCost = items.reduce(
    (s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.buying_price) || 0),
    0,
  );

  const addLine = (p: Product) => {
    if (items.find((i) => i.product_id === p.id)) {
      toast.error("Already in list");
      return;
    }
    setItems([...items, {
      product_id: p.id,
      product_name: p.name,
      quantity: "1",
      buying_price: String(p.buying_price || 0),
      expiry_date: "",
      batch_number: "",
    }]);
    setSearch("");
  };

  const update = (idx: number, patch: Partial<StockLine>) => {
    setItems(items.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const remove = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const save = async () => {
    if (!userId) return;
    if (items.length === 0) { toast.error("Add at least one product"); return; }
    if (items.some((i) => !i.quantity || parseFloat(i.quantity) <= 0)) {
      toast.error("All quantities must be > 0");
      return;
    }

    setSubmitting(true);
    try {
      const branchId = getActiveBranchId();
      for (const item of items) {
        const qty = parseFloat(item.quantity);
        const cost = parseFloat(item.buying_price) || 0;

        // Insert batch
        const batchId = crypto.randomUUID();
        await execute(
          `INSERT INTO batches (id, product_id, batch_number, quantity, buying_price, expiry_date, branch_id)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
          [batchId, item.product_id, item.batch_number || null, qty, cost,
            item.expiry_date || null, branchId],
        );

        // Stock movement entry
        await execute(
          `INSERT INTO stock_movements (id, product_id, batch_id, type, quantity, reference_type, reference_id, notes, user_id)
           VALUES (?1, ?2, ?3, 'purchase', ?4, 'manual_receive', ?5, ?6, ?7)`,
          [crypto.randomUUID(), item.product_id, batchId, qty,
            reference || "Manual receive",
            `From ${supplier || "supplier"}${reference ? ` · ${reference}` : ""}`,
            userId],
        );
      }
      toast.success(`Received ${items.length} item${items.length !== 1 ? "s" : ""}`);
      onSaved();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-4 w-4 text-emerald-600" /> Receive Stock
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-xs text-muted-foreground">
            Quick way to add stock when you receive a delivery without a Purchase Order. For tracked supplier orders, use Purchase Orders instead.
          </p>

          {/* Supplier + reference */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">From (supplier)</label>
              <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g., Mama Mary's" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Reference / Delivery Note #</label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
            </div>
          </div>

          {/* Add product search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product to add..."
              className="pl-8"
            />
            {search && products.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 max-h-48 overflow-auto bg-popover border border-border rounded-md shadow-md">
                {products.slice(0, 10).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addLine(p)}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex justify-between"
                  >
                    <span>{p.name}</span>
                    <span className="text-muted-foreground tabular-nums">Stock: {p.stock_qty}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Items table */}
          {items.length === 0 ? (
            <div className="border border-dashed border-border rounded-md p-6 text-center text-xs text-muted-foreground">
              Search above and click a product to add it to this receipt.
            </div>
          ) : (
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    <th className="text-left px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Product</th>
                    <th className="text-right px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground w-20">Qty</th>
                    <th className="text-right px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground w-24">Buy Price</th>
                    <th className="text-left px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground w-32">Expiry</th>
                    <th className="text-left px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground w-24">Batch #</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className="border-b border-border/60">
                      <td className="px-2 py-1 text-xs">{it.product_name}</td>
                      <td className="px-1 py-1">
                        <Input
                          type="number"
                          value={it.quantity}
                          onChange={(e) => update(idx, { quantity: e.target.value })}
                          className="h-7 text-right tabular-nums text-xs"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          type="number"
                          value={it.buying_price}
                          onChange={(e) => update(idx, { buying_price: e.target.value })}
                          className="h-7 text-right tabular-nums text-xs"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          type="date"
                          value={it.expiry_date}
                          onChange={(e) => update(idx, { expiry_date: e.target.value })}
                          className="h-7 text-xs"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          value={it.batch_number}
                          onChange={(e) => update(idx, { batch_number: e.target.value })}
                          className="h-7 text-xs font-mono"
                          placeholder="Optional"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Button variant="ghost" size="icon-xs" onClick={() => remove(idx)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30 font-semibold">
                    <td colSpan={5} className="px-2 py-1.5 text-xs">Total Receive Cost</td>
                    <td className="px-2 py-1.5 text-right text-xs font-mono tabular-nums">
                      KES {totalCost.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 rounded p-2">
            <Calendar className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>
              Set expiry dates for pharmacy products. Batches without expiry won't appear in the expiry alert.
              Batch numbers help with recalls.
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={submitting || items.length === 0} className="bg-emerald-600 hover:bg-emerald-700">
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Receive {items.length} Item{items.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
