import { PLACEHOLDERS } from "@/lib/variant-placeholders";
import { VARIANT } from "@/lib/variant";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  Download,
  Lightning as Zap,
  MagnifyingGlass as Search,
  Package,
  Package as PackagePlus,
  Pencil as Edit3,
  Plus,
  ShoppingCart,
  Stack as Layers,
  UploadSimple as Upload,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import {
  getProductsPage,
  getCategories,
  deleteProduct,
  type Product,
  type Category,
  PRODUCTS_PAGE_SIZE,
} from "@/services/inventory";
import { ProductPanel } from "@/components/inventory/product-panel";
import { BulkEditDialog } from "@/components/inventory/bulk-edit-dialog";
import { ReceiveStockDialog } from "@/components/inventory/receive-stock-dialog";
import { VariantsDrawer } from "@/components/inventory/variants-drawer";
import { BackButton } from "@/components/ui/back-button";
import { PaginationBar } from "@/components/pagination-bar";
import type { UseListDataResult } from "@/hooks/use-list-data";
import { MobileRouteContext } from "@/components/shared/mobile-route-context";
import { useAuthStore } from "@/stores/auth";
import { hasPermission } from "@/lib/permissions";
import { money } from "@/lib/money";

const PAGE_SIZE = 25;
type StockFilter = "all" | "low" | "out";

export function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [catalogueHasMore, setCatalogueHasMore] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [variantsProduct, setVariantsProduct] = useState<Product | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const canEdit = hasPermission(user, "inventory.edit");
  const canBulkEdit = hasPermission(user, "inventory.bulk_edit");
  const canArchive = hasPermission(user, "inventory.delete");
  const canCreatePo = hasPermission(user, "purchase_orders.create");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [productPage, cats] = await Promise.all([
        getProductsPage(search || undefined),
        getCategories(),
      ]);
      setProducts(productPage.rows);
      setTotalProducts(productPage.total);
      setCatalogueHasMore(productPage.hasMore);
      setCategories(cats);
    } catch (error) {
      toast.error(`Could not load inventory: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, categoryFilter, stockFilter]);

  const filteredProducts = useMemo(
    () => products
      .filter((product) => !categoryFilter || product.category_id === categoryFilter)
      .filter((product) => stockFilter === "all"
        ? true
        : stockFilter === "out"
          ? product.stock_qty <= 0
          : product.stock_qty > 0 && product.stock_qty <= product.reorder_level),
    [products, categoryFilter, stockFilter],
  );
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const inventoryList: UseListDataResult<Product> = {
    rows: pageRows,
    loading,
    error: null,
    total: filteredProducts.length,
    page: currentPage,
    pageSize: PAGE_SIZE,
    pageCount,
    hasMore: currentPage < pageCount,
    search,
    setPage,
    setSearch,
    refresh: load,
  };

  const toggleSelect = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allPageSelected = pageRows.length > 0 && pageRows.every((product) => selected.has(product.id));
    setSelected((previous) => {
      const next = new Set(previous);
      for (const product of pageRows) {
        if (allPageSelected) next.delete(product.id); else next.add(product.id);
      }
      return next;
    });
  };

  const openNew = () => { setEditingId(null); setPanelOpen(true); };
  const openEdit = (id: string) => { setEditingId(id); setPanelOpen(true); };

  const seedPO = (itemsToOrder: Product[]) => {
    const items = itemsToOrder.map((product) => ({
      product_id: product.id,
      product_name: product.name,
      quantity: Math.max(1, (product.reorder_level || 0) - (product.stock_qty || 0)),
      unit_cost: product.buying_price || 0,
    }));
    if (items.length === 0) { toast.error("Nothing to reorder"); return; }
    navigate("/purchase-orders/new", { state: { poSeed: { items } } });
  };

  const bulkArchive = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      for (const id of ids) await deleteProduct(id);
      toast.success(`Archived ${ids.length} product${ids.length === 1 ? "" : "s"}`);
      setSelected(new Set());
      await load();
    } catch (error) {
      toast.error(String(error));
    }
  };

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("");
    setStockFilter("all");
  };
  const isFiltered = Boolean(search || categoryFilter || stockFilter !== "all");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <BackButton fallback="/" />
          <h1 className="text-xl font-semibold tracking-tight">Inventory</h1>
        </div>
        {canEdit && (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
            <Button size="sm" variant="outline" onClick={() => setReceiveOpen(true)} className="min-h-11 lg:min-h-0">
              <PackagePlus className="size-4" /> Receive stock
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/inventory/quick-add")} className="min-h-11 lg:min-h-0">
              <Zap className="size-4" /> Quick add
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 lg:min-h-0"
              onClick={async () => {
                try {
                  const exporter = await import("@/services/products-export");
                  const { rowCount } = await exporter.exportProductsCsv();
                  toast.success(`Exported ${rowCount} product${rowCount === 1 ? "" : "s"}`);
                } catch (error) {
                  toast.error(`Export failed: ${error}`);
                }
              }}
            >
              <Download className="size-4" /> Export CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/inventory/import")} className="min-h-11 lg:min-h-0">
              <Upload className="size-4" /> Import CSV
            </Button>
            <Button size="sm" onClick={openNew} className="col-span-2 min-h-11 sm:w-auto lg:min-h-0">
              <Plus className="size-4" /> Add product
            </Button>
          </div>
        )}
      </div>
      <MobileRouteContext />

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-y border-border py-2">
          <span className="mr-auto text-xs font-medium text-muted-foreground">{selected.size} selected</span>
          {canBulkEdit && (
            <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)} className="min-h-11 lg:min-h-0">
              <Edit3 className="size-4" /> Bulk edit
            </Button>
          )}
          {canCreatePo && (
            <Button size="sm" variant="outline" onClick={() => seedPO(products.filter((product) => selected.has(product.id)))} className="min-h-11 lg:min-h-0">
              <ShoppingCart className="size-4" /> Create PO
            </Button>
          )}
          {canArchive && (
            <Button size="sm" variant="outline" onClick={bulkArchive} className="min-h-11 text-amber-700 dark:text-amber-400 lg:min-h-0">
              <Archive className="size-4" /> Archive
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-2 lg:grid-cols-[minmax(240px,1fr)_224px_auto] lg:items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={PLACEHOLDERS.inventorySearch}
            className="h-11 pl-9 lg:h-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Combobox
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[
            { value: "", label: "All categories", hint: String(products.length) },
            ...categories.map((category) => ({
              value: category.id,
              label: category.name,
              hint: String(products.filter((product) => product.category_id === category.id).length),
            })),
          ]}
          placeholder="Filter by category"
          searchPlaceholder="Search categories…"
          className="[&_button]:h-11 lg:[&_button]:h-9"
        />
        <div className="grid grid-cols-3 gap-0.5 rounded-md border border-border p-0.5 text-xs">
          {([[
            "all", "All stock",
          ], ["low", "Low"], ["out", "Out"]] as const).map(([filter, label]) => (
            <button
              type="button"
              key={filter}
              onClick={() => setStockFilter(filter)}
              className={`min-h-11 rounded px-2.5 py-1 transition-colors lg:min-h-0 ${stockFilter === filter ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {catalogueHasMore && (
        <div className="flex items-start justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <span>
            Showing the first <strong>{products.length}</strong> of <strong>{totalProducts.toLocaleString()}</strong> products.
            Refine by name, SKU, or barcode to find records beyond this local safety cap.
          </span>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em]">Cap · {PRODUCTS_PAGE_SIZE}</span>
        </div>
      )}

      {!loading && pageRows.length === 0 ? (
        <EmptyState filtered={isFiltered} canAdd={canEdit} onAdd={openNew} onClear={clearFilters} />
      ) : (
        <>
          <div data-mobile-list="inventory" className="space-y-2 lg:hidden">
            {pageRows.map((product) => (
              <article key={product.id} className="overflow-hidden rounded-lg border border-border bg-background">
                <button
                  type="button"
                  onClick={() => navigate(`/inventory/products/${product.id}`)}
                  className="min-h-11 w-full px-4 py-3 text-left active:bg-muted/40"
                  aria-label={`Open ${product.name}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{product.name}</p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                        {product.sku || product.barcode || "No SKU or barcode"}
                      </p>
                    </div>
                    <StockBadge product={product} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3 border-t border-border pt-3 text-xs">
                    <div><span className="block text-muted-foreground">On hand</span><strong className="font-mono">{product.stock_qty}</strong></div>
                    <div><span className="block text-muted-foreground">Cost</span><strong className="font-mono">{money(product.buying_price)}</strong></div>
                    <div><span className="block text-muted-foreground">Sell</span><strong className="font-mono">{money(product.selling_price)}</strong></div>
                  </div>
                  <p className="mt-2 truncate text-xs text-muted-foreground">{product.category_name || "Uncategorised"} · {product.unit}</p>
                </button>
                {(canCreatePo || canEdit) && (
                  <div className="flex border-t border-border">
                    {canCreatePo && (
                      <Button variant="ghost" onClick={() => seedPO([product])} className="min-h-11 min-w-11 flex-1 rounded-none border-r border-border">
                        <ShoppingCart className="size-4" /> Reorder
                      </Button>
                    )}
                    {canEdit && (
                      <>
                        <Button variant="ghost" onClick={() => setVariantsProduct(product)} className="min-h-11 min-w-11 flex-1 rounded-none border-r border-border">
                          <Layers className="size-4" /> Variants
                        </Button>
                        <Button variant="ghost" onClick={() => openEdit(product.id)} className="min-h-11 min-w-11 flex-1 rounded-none">
                          <Edit3 className="size-4" /> Edit
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>

          <div data-desktop-table="inventory" className="hidden overflow-hidden rounded-lg border border-border lg:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b border-border">
                  <th className="w-8 px-3 py-2.5">
                    <Checkbox checked={pageRows.length > 0 && pageRows.every((product) => selected.has(product.id))} onCheckedChange={toggleSelectAll} />
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium">Product</th>
                  <th className="px-4 py-2.5 text-left font-medium">Category</th>
                  <th className="px-4 py-2.5 text-right font-medium">Stock</th>
                  <th className="px-4 py-2.5 text-right font-medium">Buying</th>
                  <th className="px-4 py-2.5 text-right font-medium">Selling</th>
                  <th className="px-4 py-2.5 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((product) => (
                  <tr
                    key={product.id}
                    onClick={() => navigate(`/inventory/products/${product.id}`)}
                    className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                      <Checkbox checked={selected.has(product.id)} onCheckedChange={() => toggleSelect(product.id)} />
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium hover:underline hover:underline-offset-4">{product.name}</span>
                      {product.barcode && <span className="ml-2 font-mono text-xs text-muted-foreground">{product.barcode}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{product.category_name || "Uncategorised"}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{product.stock_qty}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{money(product.buying_price)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{money(product.selling_price)}</td>
                    <td className="px-4 py-2.5 text-right" onClick={(event) => event.stopPropagation()}>
                      <StockBadge product={product} />
                      {canCreatePo && (
                        <Button variant="ghost" size="sm" onClick={() => seedPO([product])} className="ml-1 size-7 p-0" title="Create a purchase order">
                          <ShoppingCart className="size-3" />
                        </Button>
                      )}
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => setVariantsProduct(product)} className="ml-1 size-7 p-0" title="Manage variants">
                            <Layers className="size-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(product.id)} className="ml-1 size-7 p-0" title="Edit product">
                            <Edit3 className="size-3" />
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="[&_button]:min-h-11 lg:[&_button]:min-h-0">
        <PaginationBar list={inventoryList} />
      </div>

      <ProductPanel open={panelOpen} onClose={() => setPanelOpen(false)} productId={editingId} onSaved={load} />
      <BulkEditDialog
        open={bulkOpen}
        selectedIds={Array.from(selected)}
        onClose={() => setBulkOpen(false)}
        onComplete={() => { setSelected(new Set()); void load(); }}
        categories={categories}
      />
      <ReceiveStockDialog
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        onSaved={() => { setReceiveOpen(false); void load(); }}
      />
      <VariantsDrawer
        productId={variantsProduct?.id ?? ""}
        productName={variantsProduct?.name ?? ""}
        open={!!variantsProduct}
        onOpenChange={(open) => {
          if (!open) {
            setVariantsProduct(null);
            void load();
          }
        }}
      />
    </div>
  );
}

function StockBadge({ product }: { product: Product }) {
  if (product.stock_qty <= 0) return <Badge variant="destructive">Out</Badge>;
  if (product.stock_qty <= product.reorder_level) return <Badge variant="secondary">Low</Badge>;
  return <Badge variant="default">OK</Badge>;
}

function EmptyState({ filtered, canAdd, onAdd, onClear }: {
  filtered: boolean;
  canAdd: boolean;
  onAdd: () => void;
  onClear: () => void;
}) {
  const productLabel = VARIANT === "dawa" ? "drugs" : VARIANT === "hospitality" ? "menu items" : VARIANT === "hardware" ? "parts" : "products";
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border px-6 py-12 text-center">
      <Package className="mb-3 size-10 text-muted-foreground/50" />
      <h3 className="text-sm font-medium">{filtered ? `No ${productLabel} match these filters` : `No ${productLabel} yet`}</h3>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        {filtered ? "Clear the filters or search by a different name, SKU, or barcode." : "Add the first catalogue item so stock can be received and sold."}
      </p>
      {filtered ? (
        <Button variant="outline" onClick={onClear} className="mt-4 min-h-11">Clear filters</Button>
      ) : canAdd ? (
        <Button onClick={onAdd} className="mt-4 min-h-11"><Plus className="size-4" /> Add first product</Button>
      ) : null}
    </div>
  );
}
