import { MobileRouteContext } from "@/components/shared/mobile-route-context";
import { useState, useEffect } from "react";
import { getStockMovements, getProducts, adjustStock, type Product } from "@/services/inventory";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";

import { BackButton } from "@/components/ui/back-button";
function StockPageContent() {
  const [movements, setMovements] = useState<Array<{
    id: string; product_name: string; type: string; quantity: number; notes: string | null; created_at: string;
  }>>([]);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const load = () => getStockMovements().then(setMovements);
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <BackButton fallback="/inventory" />
          <h1 className="text-xl font-semibold tracking-tight">Stock Movements</h1>
        </div>
        <Button size="sm" onClick={() => setAdjustOpen(true)}>Adjust Stock</Button>
      </div>

      {movements.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No stock movements yet.</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2.5 font-medium">Product</th>
                <th className="text-left px-4 py-2.5 font-medium">Type</th>
                <th className="text-right px-4 py-2.5 font-medium">Qty</th>
                <th className="text-left px-4 py-2.5 font-medium">Notes</th>
                <th className="text-left px-4 py-2.5 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5">{m.product_name}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="secondary" className="text-xs capitalize">{m.type}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    <span className={m.quantity > 0 ? "text-green-600" : "text-red-600"}>
                      {m.quantity > 0 ? "+" : ""}{m.quantity}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{m.notes || "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{m.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdjustPanel open={adjustOpen} onClose={() => setAdjustOpen(false)} onSaved={load} />
    </div>
  );
}

function AdjustPanel({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => { if (open) getProducts().then(setProducts); }, [open]);

  const handleSave = async () => {
    if (!productId || !qty || !reason) { toast.error("Fill all fields"); return; }
    await adjustStock(productId, parseFloat(qty), reason);
    toast.success("Stock adjusted");
    onSaved();
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full max-w-full overflow-y-auto sm:w-[380px] sm:max-w-[380px]">
        <SheetHeader><SheetTitle>Adjust Stock</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-6">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Product</label>
            <Combobox
              value={productId}
              onChange={setProductId}
              options={products.map((product) => ({ value: product.id, label: product.name, hint: product.sku ?? undefined }))}
              placeholder="Select product"
              searchPlaceholder="Search products…"
              emptyText="No products match. Add products from Inventory first."
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Quantity (+ to add, - to remove)</label>
            <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 10 or -5" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Reason</label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged goods" />
          </div>
          <Button onClick={handleSave} className="w-full">Save Adjustment</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function StockPage() {
  return (
    <>
      <MobileRouteContext />
      <StockPageContent />
    </>
  );
}
