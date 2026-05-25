import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Minus, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/stores/cart";
import { getProducts, type Product } from "@/services/inventory";
import { PaymentModal } from "@/components/pos/payment-modal";
import { InteractionAlerts } from "@/components/pos/interaction-alerts";

export function POSPage() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const { items, addItem, removeItem, updateQty, clear, subtotal, taxTotal, grandTotal, discount } = useCartStore();

  // Search products
  useEffect(() => {
    if (search.length >= 1) {
      getProducts(search).then(setResults);
    } else {
      setResults([]);
    }
  }, [search]);

  const handleAddProduct = (p: Product) => {
    addItem({ id: p.id, name: p.name, selling_price: p.selling_price, tax_rate: p.tax_rate });
    setSearch("");
    searchRef.current?.focus();
  };

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "F1") { e.preventDefault(); clear(); searchRef.current?.focus(); }
    if (e.key === "F4") { e.preventDefault(); if (items.length > 0) setPayOpen(true); }
    if (e.key === "Escape") { e.preventDefault(); setSearch(""); searchRef.current?.focus(); }
  }, [items.length, clear]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex h-[calc(100vh-96px)] gap-0 -m-6">
      {/* Left: Search + Results */}
      <div className="flex-1 flex flex-col border-r border-border">
        {/* Search bar */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Search or scan barcode..."
              className="pl-9 h-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto p-3">
          {results.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleAddProduct(p)}
                  className="text-left p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                >
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-muted-foreground">Stock: {p.stock_qty}</span>
                    <span className="text-sm font-mono font-medium">{p.selling_price.toFixed(0)}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : search ? (
            <p className="text-sm text-muted-foreground text-center py-8">No products found</p>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">Type to search or scan barcode</p>
              <div className="mt-4 text-xs text-muted-foreground space-y-1">
                <p><kbd className="bg-muted px-1.5 py-0.5 rounded text-[10px]">F1</kbd> New sale</p>
                <p><kbd className="bg-muted px-1.5 py-0.5 rounded text-[10px]">F4</kbd> Pay</p>
                <p><kbd className="bg-muted px-1.5 py-0.5 rounded text-[10px]">Esc</kbd> Clear search</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-[340px] flex flex-col bg-sidebar">
        <div className="p-3 border-b border-border">
          <h2 className="text-sm font-semibold">Cart</h2>
        </div>

        {/* Drug interaction warnings */}
        <div className="px-3 pt-3">
          <InteractionAlerts />
        </div>

        {/* Items */}
        <div className="flex-1 overflow-auto">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No items</p>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => (
                <div key={item.id} className="px-3 py-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium truncate flex-1">{item.name}</span>
                    <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive ml-2">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQty(item.id, item.quantity - 1)}
                        className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-accent"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-sm font-mono w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.id, item.quantity + 1)}
                        className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-accent"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="text-sm font-mono">{(item.unit_price * item.quantity).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="border-t border-border p-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-mono">{subtotal().toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span className="font-mono text-green-600">-{discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax</span>
            <span className="font-mono">{taxTotal().toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-semibold pt-1 border-t border-border">
            <span>Total</span>
            <span className="font-mono">{grandTotal().toFixed(2)}</span>
          </div>
        </div>

        {/* Pay button */}
        <div className="p-3 border-t border-border">
          <Button
            className="w-full h-11 text-base"
            disabled={items.length === 0}
            onClick={() => setPayOpen(true)}
          >
            Pay — F4
          </Button>
        </div>
      </div>

      {/* Payment modal */}
      <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} />
    </div>
  );
}
