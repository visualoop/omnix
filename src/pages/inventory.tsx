import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Package, Upload, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getProducts, getCategories, type Product, type Category } from "@/services/inventory";
import { ProductPanel } from "@/components/inventory/product-panel";
import { BulkEditDialog } from "@/components/inventory/bulk-edit-dialog";
import { Can } from "@/components/require-role";

export function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

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
          placeholder="Search products..."
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); openEdit(p.id); }}
                      className="ml-2 h-7 w-7 p-0"
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
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
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Package className="h-10 w-10 text-muted-foreground/50 mb-3" />
      <h3 className="text-sm font-medium">No products yet</h3>
      <p className="text-xs text-muted-foreground mt-1">Add your first product to get started.</p>
      <Button size="sm" className="mt-4" onClick={onAdd}>
        <Plus className="h-4 w-4 mr-1" /> Add Product
      </Button>
    </div>
  );
}
