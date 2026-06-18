import { PLACEHOLDERS } from "@/lib/variant-placeholders";
import { VARIANT } from "@/lib/variant";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Package, Upload, Edit3, Zap, PackagePlus, Layers, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getProducts, getCategories, type Product, type Category } from "@/services/inventory";
import { ProductPanel } from "@/components/inventory/product-panel";
import { BulkEditDialog } from "@/components/inventory/bulk-edit-dialog";
import { ReceiveStockDialog } from "@/components/inventory/receive-stock-dialog";
import { VariantsDialog } from "@/components/inventory/variants-dialog";
import { Can } from "@/components/require-role";

export function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [variantsProduct, setVariantsProduct] = useState<Product | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [data, cats] = await Promise.all([
      getProducts(search || undefined),
      getCategories(),
    ]);
    setProducts(data);
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Inventory</h1>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <Can permission="inventory.bulk_edit">
              <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
                <Edit3 className="h-4 w-4 mr-1" /> Bulk Edit ({selected.size})
              </Button>
            </Can>
          )}
          <Can permission="inventory.edit">
            <Button size="sm" variant="outline" onClick={() => setReceiveOpen(true)} className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
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

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={PLACEHOLDERS.inventorySearch}
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {products.length === 0 ? (
        <EmptyState onAdd={openNew} />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b border-border">
                <th className="px-3 py-2.5 w-8">
                  <input
                    type="checkbox"
                    checked={selected.size > 0 && selected.size === products.length}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
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
              {products.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <div>
                      <span className="font-medium">{p.name}</span>
                      {p.barcode && (
                        <span className="ml-2 text-xs text-muted-foreground font-mono">{p.barcode}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {p.category_name || "—"}
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
      <VariantsDialog
        product={variantsProduct}
        onClose={() => setVariantsProduct(null)}
        onSaved={load}
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
