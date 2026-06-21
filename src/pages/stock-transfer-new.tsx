import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowsLeftRight as ArrowRightLeft,
  Check,
  CircleNotch as Loader2,
  MagnifyingGlass as Search,
  Trash as Trash2,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { listBranches, type BranchWithStats } from "@/services/branches";
import { getProducts, type Product } from "@/services/inventory";
import { createTransfer, dispatchTransfer } from "@/services/stock-transfers";
import { useActiveBranch } from "@/stores/active-branch";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

interface TransferLine {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  available: number;
}

export function NewStockTransferPage() {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);
  const activeBranch = useActiveBranch((s) => s.active);
  const [branches, setBranches] = useState<BranchWithStats[]>([]);
  const [fromBranchId, setFromBranchId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<TransferLine[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listBranches(false).then((bs) => {
      setBranches(bs);
      if (activeBranch?.id) setFromBranchId(activeBranch.id);
    });
  }, [activeBranch?.id]);

  useEffect(() => {
    if (fromBranchId) {
      getProducts(search).then(setProducts);
    }
  }, [fromBranchId, search]);

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const totalCost = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);

  const addProduct = (p: Product) => {
    if (items.find((i) => i.product_id === p.id)) {
      toast.error("Already added");
      return;
    }
    setItems([...items, {
      product_id: p.id,
      product_name: p.name,
      quantity: 1,
      unit_cost: p.buying_price || 0,
      available: p.stock_qty || 0,
    }]);
    setSearch("");
  };
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, patch: Partial<TransferLine>) => {
    setItems(items.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const save = async (then: "draft" | "dispatch") => {
    if (!userId) return;
    if (!fromBranchId || !toBranchId) { toast.error("Pick source and destination"); return; }
    if (fromBranchId === toBranchId) { toast.error("Source and destination must differ"); return; }
    if (items.length === 0) { toast.error("Add at least one item"); return; }
    if (items.some((i) => i.quantity <= 0)) { toast.error("All quantities must be > 0"); return; }
    if (items.some((i) => i.quantity > i.available)) { toast.error("Some quantities exceed available stock"); return; }

    setSubmitting(true);
    try {
      const id = await createTransfer({
        from_branch_id: fromBranchId,
        to_branch_id: toBranchId,
        user_id: userId,
        notes: notes || undefined,
        items: items.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_cost: i.unit_cost,
        })),
      });
      if (then === "dispatch") {
        await dispatchTransfer(id);
        toast.success("Transfer dispatched");
      } else {
        toast.success("Saved as draft");
      }
      navigate(`/stock-transfers/${id}`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-primary" /> New Stock Transfer
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Move stock between branches. Save as draft to review, or dispatch immediately.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">From Branch *</label>
              <select
                value={fromBranchId}
                onChange={(e) => setFromBranchId(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px]"
              >
                <option value="">Select source...</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">To Branch *</label>
              <select
                value={toBranchId}
                onChange={(e) => setToBranchId(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px]"
              >
                <option value="">Select destination...</option>
                {branches.filter((b) => b.id !== fromBranchId).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Notes</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Items</h2>
            <span className="text-xs text-muted-foreground">{items.length} items · {totalQty} total qty</span>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Add product..."
              className="pl-8"
              disabled={!fromBranchId}
            />
            {search && products.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 max-h-60 overflow-auto bg-popover border border-border rounded-md shadow-md">
                {products.slice(0, 10).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProduct(p)}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex items-center justify-between"
                  >
                    <span>{p.name}</span>
                    <span className="text-muted-foreground tabular-nums">{p.stock_qty || 0} available</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <div className="border border-dashed border-border rounded-md p-6 text-center text-xs text-muted-foreground">
              No items yet. Search above to add products.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Product</th>
                  <th className="text-right px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Available</th>
                  <th className="text-right px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-24">Qty</th>
                  <th className="text-right px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-28">Unit Cost</th>
                  <th className="text-right px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-24">Total</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={it.product_id} className="border-b border-border/60">
                    <td className="px-2 py-1.5 text-xs">{it.product_name}</td>
                    <td className="px-2 py-1.5 text-right text-xs tabular-nums">{it.available}</td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        value={it.quantity}
                        onChange={(e) => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                        className={`h-7 text-right tabular-nums ${it.quantity > it.available ? "border-red-500" : ""}`}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        value={it.unit_cost}
                        onChange={(e) => updateItem(idx, { unit_cost: parseFloat(e.target.value) || 0 })}
                        className="h-7 text-right tabular-nums"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right text-xs tabular-nums font-mono">
                      {(it.quantity * it.unit_cost).toFixed(2)}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Button variant="ghost" size="icon-xs" onClick={() => removeItem(idx)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/30 font-semibold">
                  <td colSpan={2} className="px-2 py-1.5 text-xs">Total</td>
                  <td className="px-2 py-1.5 text-right text-xs tabular-nums">{totalQty}</td>
                  <td></td>
                  <td className="px-2 py-1.5 text-right text-xs tabular-nums font-mono">KES {totalCost.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => navigate("/stock-transfers")}>Cancel</Button>
        <Button variant="outline" onClick={() => save("draft")} disabled={submitting}>
          {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Save as Draft
        </Button>
        <Button onClick={() => save("dispatch")} disabled={submitting}>
          {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          <Check className="h-3.5 w-3.5 mr-1" /> Save & Dispatch
        </Button>
      </div>
    </div>
  );
}
