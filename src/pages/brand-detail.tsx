import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TagSimple as Tag, Package } from "@phosphor-icons/react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PaginationBar } from "@/components/pagination-bar";
import { OperationalContext } from "@/components/shared/operational-context";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { query } from "@/lib/db";
import { formatMoney } from "@/lib/locale";
import { useCountry } from "@/stores/country";

interface Brand { id: string; name: string; slug: string | null; created_at: string }
interface Product { id: string; name: string; sku: string; reorder_level: number; active: number; stock_qty: number }
interface TopSeller { product_id: string; product_name: string; units: number; revenue: number }

export function BrandDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const country = useCountry((state) => state.code);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [topSellers, setTopSellers] = useState<TopSeller[]>([]);
  const [revenue30d, setRevenue30d] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      query<Brand>("SELECT id, name, slug, created_at FROM brands WHERE id = ?1", [id]),
      query<Product>("SELECT p.id, p.name, p.sku, p.reorder_level, p.active, COALESCE((SELECT SUM(quantity) FROM batches WHERE product_id = p.id), 0) AS stock_qty FROM stockable_products p WHERE p.brand_id = ?1 AND p.active = 1 ORDER BY p.name LIMIT 500", [id]),
      query<TopSeller>("SELECT si.product_id, p.name AS product_name, SUM(si.quantity) AS units, SUM(si.line_total) AS revenue FROM sale_items si JOIN products p ON p.id = si.product_id JOIN sales s ON s.id = si.sale_id WHERE p.brand_id = ?1 AND s.status != 'voided' AND s.created_at >= datetime('now', '-30 days') GROUP BY si.product_id ORDER BY revenue DESC LIMIT 5", [id]),
      query<{ v: number }>("SELECT COALESCE(SUM(si.line_total), 0) AS v FROM sale_items si JOIN products p ON p.id = si.product_id JOIN sales s ON s.id = si.sale_id WHERE p.brand_id = ?1 AND s.status != 'voided' AND s.created_at >= datetime('now', '-30 days')", [id]),
    ]).then(([brands, productRows, sellers, revenue]) => { setBrand(brands[0] ?? null); setProducts(productRows); setTopSellers(sellers); setRevenue30d(revenue[0]?.v ?? 0); }).finally(() => setLoading(false));
  }, [id]);

  const filtered = useMemo(() => products.filter((product) => !search || `${product.name} ${product.sku}`.toLowerCase().includes(search.toLowerCase())), [products, search]);
  const productList = useClientPagination(filtered, 12, search);

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading brand…</p>;
  if (!brand) return <div className="p-6"><EmptyState icon={Tag} title="Brand not found" description="The brand may have been deactivated or removed." cta={{ label: "Back to brands", onClick: () => navigate("/retail?tab=brands"), icon: Tag }} /></div>;

  const totalStock = products.reduce((total, product) => total + product.stock_qty, 0);
  const lowStockCount = products.filter((product) => product.stock_qty <= product.reorder_level && product.reorder_level > 0).length;

  return <div className="space-y-6">
    <PageHeader back={{ fallback: "/retail?tab=brands" }} eyebrow="Retail brand" title={brand.name} description={brand.slug ? `Slug · ${brand.slug}` : "Catalogue and 30-day performance"} />
    <OperationalContext compact />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Kpi label="Products" value={products.length.toLocaleString()} /><Kpi label="Total stock" value={totalStock.toLocaleString()} /><Kpi label="Low stock" value={lowStockCount.toLocaleString()} tone={lowStockCount ? "warn" : "muted"} /><Kpi label="Revenue 30d" value={formatMoney(revenue30d, country)} /></div>

    {topSellers.length > 0 && <section><h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">Top sellers · 30 days</h2><ul className="divide-y divide-border/60 rounded-lg border border-border">{topSellers.map((seller, index) => <li key={seller.product_id} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-4 py-3 text-sm sm:flex sm:items-center"><span className="font-mono text-muted-foreground">#{index + 1}</span><Button variant="ghost" className="min-h-11 justify-start px-0 text-left" onClick={() => navigate(`/inventory/products/${seller.product_id}`)}>{seller.product_name}</Button><span className="col-start-2 text-xs text-muted-foreground sm:ml-auto">{seller.units} units</span><span className="col-start-2 font-mono tabular-nums sm:col-auto">{formatMoney(seller.revenue, country)}</span></li>)}</ul></section>}

    <section className="space-y-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">All products</h2><p className="mt-1 text-xs text-muted-foreground">Search and open a product to adjust its brand or stock details.</p></div><Input aria-label="Search brand products" className="h-11 sm:max-w-xs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product or SKU…" /></div>
      {filtered.length === 0 ? <EmptyState icon={Package} title={search ? "No matching products" : "No products under this brand"} description={search ? "Try a different product name or SKU." : "Assign this brand while creating or editing a product."} cta={!search ? { label: "Open products", onClick: () => navigate("/inventory/products"), icon: Package } : undefined} /> : <>
        <div className="space-y-2 lg:hidden" aria-label="Brand product cards">{productList.pageRows.map((product) => { const low = product.stock_qty <= product.reorder_level && product.reorder_level > 0; return <button key={product.id} type="button" onClick={() => navigate(`/inventory/products/${product.id}`)} className="min-h-11 w-full rounded-md border border-border p-4 text-left active:scale-[0.99]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{product.name}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{product.sku}</p></div>{low && <Badge variant="outline" className="bg-amber-500/10 text-amber-600">Low stock</Badge>}</div><p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground"><span className="font-mono text-foreground">{product.stock_qty}</span> on hand</p></button>; })}</div>
        <div className="hidden overflow-hidden rounded-lg border border-border lg:block"><table className="w-full text-sm"><thead className="border-b border-border bg-muted/30"><tr><th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Product</th><th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">SKU</th><th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">On hand</th><th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Status</th></tr></thead><tbody>{productList.pageRows.map((product) => { const low = product.stock_qty <= product.reorder_level && product.reorder_level > 0; return <tr key={product.id} className="border-b border-border/60 last:border-0"><td className="px-4 py-2"><Button variant="ghost" className="justify-start px-0" onClick={() => navigate(`/inventory/products/${product.id}`)}>{product.name}</Button></td><td className="px-4 py-2 font-mono text-xs text-muted-foreground">{product.sku}</td><td className="px-4 py-2 text-right font-mono">{product.stock_qty}</td><td className="px-4 py-2 text-right">{low ? <Badge variant="outline" className="bg-amber-500/10 text-amber-600">Low</Badge> : <span className="text-xs text-muted-foreground">Available</span>}</td></tr>; })}</tbody></table></div>
        <PaginationBar list={productList.pagination} />
      </>}
    </section>
  </div>;
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "warn" | "muted" }) { const toneClass = tone === "warn" ? "text-amber-600" : tone === "muted" ? "text-muted-foreground" : "text-foreground"; return <div className="rounded-lg border border-border p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div><div className={`mt-1 font-mono text-lg font-semibold tabular-nums ${toneClass}`}>{value}</div></div>; }
