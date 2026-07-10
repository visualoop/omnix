import { PLACEHOLDERS } from "@/lib/variant-placeholders";
import { VARIANT } from "@/lib/variant";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  Lightning as Zap,
  MagnifyingGlass as Search,
  Package,
  Package as PackagePlus,
  Pencil as Edit3,
  Plus,
  Stack as Layers,
  UploadSimple as Upload,
  ShoppingCart,
  Archive,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { getProductsPage, getCategories, deleteProduct, type Product, type Category, PRODUCTS_PAGE_SIZE } from "@/services/inventory";
import { ProductPanel } from "@/components/inventory/product-panel";
import { BulkEditDialog } from "@/components/inventory/bulk-edit-dialog";
import { ReceiveStockDialog } from "@/components/inventory/receive-stock-dialog";
import { VariantsDrawer } from "@/components/inventory/variants-drawer";
import { Can } from "@/components/require-role";

import { BackButton } from "@/components/ui/back-button";
export function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [variantsProduct, setVariantsProduct] = useState<Product | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");

  const load = useCallback(async () => {
    const [page, cats] = await Promise.all([
      getProductsPage(search || undefined),
      getCategories(),
    ]);
    setProducts(page.rows);
    setTotalProducts(page.total);
    setHasMore(page.hasMore);
    setCategories(cats);
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === products.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products.map((p) => p.id)));
    }
  };

  const openNew = () => { setEditingId(null); setPanelOpen(true); };
  const openEdit = (id: string) => { setEditingId(id); setPanelOpen(true); };
  const navigate = useNavigate();

  // Seed a purchase order with the given products (suggested qty = the gap to
  // the reorder level, min 1; unit cost = last buying price).
  const seedPO = (list: Product[]) => {
    const items = list.map((p) => ({
      product_id: p.id,
      product_name: p.name,
      quantity: Math.max(1, (p.reorder_level || 0) - (p.stock_qty || 0)),
      unit_cost: p.buying_price || 0,
    }));
    if (items.length === 0) { toast.error("Nothing to reorder"); return; }
    navigate("/purchase-orders/new", { state: { poSeed: { items } } });
  };
  const bulkCreatePO = () => seedPO(products.filter((p) => selected.has(p.id)));
  const bulkArchive = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      for (const id of ids) await deleteProduct(id);
      toast.success(`Archived ${ids.length} product${ids.length === 1 ? "" : "s"}`);
      setSelected(new Set());
      load();
    } catch (e) { toast.error(String(e)); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <BackButton fallback="/" />
        <h1 className="text-xl font-semibold tracking-tight">Inventory</h1>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <>
              <Can permission="inventory.bulk_edit">
                <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
                  <Edit3 className="h-4 w-4 mr-1" /> Bulk Edit ({selected.size})
                </Button>
              </Can>
              <Can permission="inventory.edit">
                <Button size="sm" variant="outline" onClick={bulkCreatePO}>
                  <ShoppingCart className="h-4 w-4 mr-1" /> Create PO ({selected.size})
                </Button>
                <Button size="sm" variant="outline" onClick={bulkArchive} className="text-amber-700 dark:text-amber-400">
                  <Archive className="h-4 w-4 mr-1" /> Archive
                </Button>
              </Can>
            </>
          )}
          <Can permission="inventory.edit">
            <Button size="sm" variant="outline" onClick={() => setReceiveOpen(true)}>
              <PackagePlus className="h-4 w-4 mr-1" /> Receive Stock
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/inventory/quick-add")}>
              <Zap className="h-4 w-4 mr-1" /> Quick Add
            </Button>
            <Button size="sm" variant="outline" onClick={async () => {
              try {
                const m = await import("@/services/products-export");
                const { rowCount } = await m.exportProductsCsv();
                toast.success(`Exported ${rowCount} product${rowCount === 1 ? "" : "s"}`);
              } catch (e) {
                toast.error(`Export failed: ${e}`);
              }
            }}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/inventory/import")}>
              <Upload className="h-4 w-4 mr-1" /> Import CSV
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> Add Product
            </Button>
          </Can>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[240px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={PLACEHOLDERS.inventorySearch}
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-56">
          <Combobox
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              { value: "", label: "All categories", hint: String(products.length) },
              ...categories.map((c) => ({
                value: c.id,
                label: c.name,
                hint: String(products.filter((p) => p.category_id === c.id).length),
              })),
            ]}
            placeholder="Filter by category"
            searchPlaceholder="Search categories…"
          />
        </div>
        {categoryFilter && (
          <button
            onClick={() => setCategoryFilter("")}
            className="text-[12px] font-medium text-muted-foreground hover:text-foreground"
          >
            Clear filter
          </button>
        )}
        <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5 text-[12px]">
          {([["all", "All stock"], ["low", "Low stock"], ["out", "Out of stock"]] as const).map(([f, lbl]) => (
            <button
              key={f}
              onClick={() => setStockFilter(f)}
              className={`px-2.5 py-1 rounded transition-colors ${stockFilter === f ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Truncation banner — the inventory query caps at PRODUCTS_PAGE_SIZE
          so a 12k-SKU catalogue doesn't lock the page. Only renders when
          the catalogue actually exceeds the cap; explains the cap +
          points the user to refine via the search box above. */}
      {hasMore && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-300 flex items-center justify-between gap-3">
          <span>
            Showing the first <strong>{products.length}</strong> of{" "}
            <strong>{totalProducts.toLocaleString("en-US")}</strong> products.
            Refine your search above (name, SKU, barcode) to find a specific item.
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] shrink-0 text-amber-700/80 dark:text-amber-300/80">
            Cap · {PRODUCTS_PAGE_SIZE}
          </span>
        </div>
      )}

      {/* Table */}
      {products.length === 0 ? (
        <EmptyState onAdd={openNew} />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b border-border">
                <th className="px-3 py-2.5 w-8">
                  <Checkbox checked={selected.size > 0 && selected.size === products.length} onCheckedChange={toggleSelectAll} />
                </th>
                <th className="text-left px-4 py-2.5 font-medium">Product</th>
                <th className="text-left px-4 py-2.5 font-medium">Category</th>
                <th className="text-right px-4 py-2.5 font-medium">Stock</th>
                <th className="text-right px-4 py-2.5 font-medium">Buying</th>
                <th className="text-right px-4 py-2.5 font-medium">Selling</th>
                <th className="text-right px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {products
                .filter((p) => !categoryFilter || p.category_id === categoryFilter)
                .filter((p) => stockFilter === "all" ? true : stockFilter === "out" ? p.stock_qty <= 0 : p.stock_qty <= p.reorder_level)
                .map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/inventory/products/${p.id}`)}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div>
                      <span className="font-medium hover:underline underline-offset-4">{p.name}</span>
                      {p.barcode && (
                        <span className="ml-2 text-xs text-muted-foreground font-mono">{p.barcode}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {p.category_name ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.05] px-2 py-0.5 text-[11px] font-medium text-foreground/80">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        {p.category_name}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">No category</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {p.stock_qty}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {p.buying_price.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {p.selling_price.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {p.stock_qty <= 0 ? (
                      <Badge variant="destructive" className="text-xs">Out</Badge>
                    ) : p.stock_qty <= p.reorder_level ? (
                      <Badge variant="secondary" className="text-xs">Low</Badge>
                    ) : (
                      <Badge variant="default" className="text-xs">OK</Badge>
                    )}
                    <Can permission="inventory.edit">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); seedPO([p]); }}
                        className="ml-1 h-7 w-7 p-0 cursor-pointer"
                        title="Reorder — create a purchase order for this item"
                      >
                        <ShoppingCart className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setVariantsProduct(p); }}
                        className="ml-1 h-7 w-7 p-0 cursor-pointer"
                        title="Manage variants (sizes, weights, options)"
                      >
                        <Layers className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); openEdit(p.id); }}
                        className="ml-1 h-7 w-7 p-0 cursor-pointer"
                        title="Edit product"
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-out panel */}
      <ProductPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        productId={editingId}
        onSaved={load}
      />
      <BulkEditDialog
        open={bulkOpen}
        selectedIds={Array.from(selected)}
        onClose={() => setBulkOpen(false)}
        onComplete={() => { setSelected(new Set()); load(); }}
        categories={categories}
      />
      <ReceiveStockDialog
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        onSaved={() => { setReceiveOpen(false); load(); }}
      />
      <VariantsDrawer
        productId={variantsProduct?.id ?? ""}
        productName={variantsProduct?.name ?? ""}
        open={!!variantsProduct}
        onOpenChange={(next) => {
          if (!next) {
            setVariantsProduct(null);
            // VariantsManager autosaves; reload to reflect any changes.
            void load();
          }
        }}
      />
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Package className="h-10 w-10 text-muted-foreground/50 mb-3" />
      <h3 className="text-sm font-medium">{
        VARIANT === "dawa" ? "No drugs yet" :
        VARIANT === "hospitality" ? "No menu items yet" :
        VARIANT === "hardware" ? "No parts yet" :
        "No products yet"
      }</h3>
      <p className="text-xs text-muted-foreground mt-1">{
        VARIANT === "dawa" ? "Add your first drug — name, batch number, expiry — to start dispensing." :
        VARIANT === "hospitality" ? "Add ingredients, then build menu items in Hospitality → Menu." :
        VARIANT === "hardware" ? "Add your first part — bag of cement, length of rebar — to ring up at the till." :
        "Add your first product to get started."
      }</p>
      <Button size="sm" className="mt-4" onClick={onAdd}>
        <Plus className="h-4 w-4 mr-1" /> Add Product
      </Button>
    </div>
  );
}
