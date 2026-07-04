/**
 * Price list settings (v0.48 — converged on price_lists + product_prices).
 *
 * Manage the REAL price lists that POS reads, and set per-product prices on
 * each list. A customer assigned to a list (customers.pricing_list_id) gets
 * that list's price resolved at the till via resolvePrice.
 */
import { useEffect, useState, useCallback } from "react";
import { Plus, Tag, Trash as Trash2, MagnifyingGlass as Search } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listPricingLists, createPricingList,
  listProductPrices, setProductPrice, removeProductPrice,
  type PricingList, type ProductPriceRow,
} from "@/services/retail";
import { getProducts, type Product } from "@/services/inventory";
import { money as KES } from "@/lib/money";
import { toast } from "sonner";

export function PriceListSettingsPage() {
  const [lists, setLists] = useState<PricingList[]>([]);
  const [activeList, setActiveList] = useState<string>("default");
  const [newName, setNewName] = useState("");
  const [rows, setRows] = useState<ProductPriceRow[]>([]);
  const [search, setSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [priceInput, setPriceInput] = useState("");
  const [picked, setPicked] = useState<Product | null>(null);

  const loadLists = useCallback(() => {
    listPricingLists().then((l) => {
      setLists(l);
      if (!l.find((x) => x.id === activeList) && l[0]) setActiveList(l[0].id);
    });
  }, [activeList]);
  useEffect(() => { loadLists(); }, []);

  const loadRows = useCallback(() => {
    if (activeList) listProductPrices(activeList, search || undefined).then(setRows);
  }, [activeList, search]);
  useEffect(() => { loadRows(); }, [loadRows]);

  useEffect(() => {
    if (productSearch.trim().length >= 1) getProducts(productSearch).then(setProductResults);
    else setProductResults([]);
  }, [productSearch]);

  const addList = async () => {
    const name = newName.trim();
    if (!name) { toast.error("Enter a name"); return; }
    await createPricingList(name);
    setNewName("");
    loadLists();
    toast.success("Price list added");
  };

  const savePrice = async () => {
    if (!picked) { toast.error("Pick a product"); return; }
    const price = parseFloat(priceInput);
    if (!(price >= 0)) { toast.error("Enter a valid price"); return; }
    await setProductPrice({ product_id: picked.id, price_list_id: activeList, selling_price: price });
    toast.success(`${picked.name} priced on ${lists.find((l) => l.id === activeList)?.name}`);
    setPicked(null); setPriceInput(""); setProductSearch("");
    loadRows();
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h3 className="text-sm font-medium flex items-center gap-2"><Tag className="h-4 w-4" /> Price Lists</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Create tiers (Wholesale, VIP…) and set per-product prices. Assign a customer to a list and the POS
          resolves that price automatically.
        </p>
      </div>

      {/* Lists row */}
      <div className="flex flex-wrap gap-2">
        {lists.map((l) => (
          <button
            key={l.id}
            onClick={() => setActiveList(l.id)}
            className={`px-3 py-1.5 rounded text-xs border transition-colors ${
              activeList === l.id ? "bg-accent text-accent-foreground border-accent" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {l.name}{l.is_default ? " (default)" : ""}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New price list name..." className="flex-1" onKeyDown={(e) => e.key === "Enter" && addList()} />
        <Button size="sm" onClick={addList}><Plus className="h-3.5 w-3.5 mr-1" /> Add list</Button>
      </div>

      {/* Add product price */}
      <div className="border border-border rounded-md p-3 space-y-2">
        <p className="text-xs font-medium">Set a product price on <span className="font-semibold">{lists.find((l) => l.id === activeList)?.name}</span></p>
        {picked ? (
          <div className="flex items-center gap-2">
            <span className="text-sm flex-1">{picked.name}</span>
            <Input type="number" value={priceInput} onChange={(e) => setPriceInput(e.target.value)} placeholder="Price" className="w-28 h-8" autoFocus />
            <Button size="sm" onClick={savePrice}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setPicked(null); setPriceInput(""); }}>Cancel</Button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Search product to price..." className="pl-9" />
            {productResults.length > 0 && (
              <div className="absolute z-10 top-full mt-1 w-full bg-popover border border-border rounded-md shadow-md max-h-48 overflow-auto">
                {productResults.slice(0, 10).map((p) => (
                  <button key={p.id} onClick={() => { setPicked(p); setPriceInput(String(p.selling_price ?? "")); setProductResults([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-accent">
                    {p.name} <span className="text-xs text-muted-foreground">{KES(p.selling_price ?? 0)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Existing prices on the list */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter priced products..." className="pl-9" />
      </div>
      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr className="text-xs text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium">Product</th>
              <th className="text-right px-3 py-2 font-medium">Price</th>
              <th className="text-right px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={3} className="py-6 text-center text-xs text-muted-foreground">No products priced on this list yet.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.product_id} className="border-b border-border/60">
                <td className="px-3 py-2">{r.product_name}</td>
                <td className="px-3 py-2 text-right font-mono">{KES(r.selling_price)}</td>
                <td className="px-3 py-2 text-right">
                  {activeList !== "default" && (
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={async () => {
                      await removeProductPrice(r.product_id, activeList); loadRows(); toast.success("Removed");
                    }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
