/**
 * Retail Brand detail — /retail/brands/:id
 *
 * Shows products of this brand, revenue in the last 30 days, top items.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TagSimple as Tag, Package } from "@phosphor-icons/react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { query } from "@/lib/db";
import { money as KES } from "@/lib/money";

interface Brand {
  id: string;
  name: string;
  slug: string | null;
  created_at: string;
}
interface Product {
  id: string;
  name: string;
  sku: string;
  reorder_level: number;
  active: number;
  stock_qty: number;
}
interface TopSeller {
  product_id: string;
  product_name: string;
  units: number;
  revenue: number;
}

export function BrandDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [topSellers, setTopSellers] = useState<TopSeller[]>([]);
  const [revenue30d, setRevenue30d] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      query<Brand>(`SELECT id, name, slug, created_at FROM brands WHERE id = ?1`, [id]),
      query<Product>(
        `SELECT p.id, p.name, p.sku, p.reorder_level, p.active,
                COALESCE((SELECT SUM(quantity) FROM batches WHERE product_id = p.id), 0) AS stock_qty
         FROM products p WHERE p.brand_id = ?1 AND p.active = 1
         ORDER BY p.name`,
        [id],
      ),
      query<TopSeller>(
        `SELECT si.product_id, p.name AS product_name,
                SUM(si.quantity) AS units,
                SUM(si.line_total) AS revenue
         FROM sale_items si
         JOIN products p ON p.id = si.product_id
         JOIN sales s ON s.id = si.sale_id
         WHERE p.brand_id = ?1 AND s.status != 'voided'
           AND s.created_at >= datetime('now', '-30 days')
         GROUP BY si.product_id
         ORDER BY revenue DESC LIMIT 5`,
        [id],
      ),
      query<{ v: number }>(
        `SELECT COALESCE(SUM(si.line_total), 0) AS v
         FROM sale_items si
         JOIN products p ON p.id = si.product_id
         JOIN sales s ON s.id = si.sale_id
         WHERE p.brand_id = ?1 AND s.status != 'voided'
           AND s.created_at >= datetime('now', '-30 days')`,
        [id],
      ),
    ]).then(([brands, prods, top, rev]) => {
      setBrand(brands[0] ?? null);
      setProducts(prods);
      setTopSellers(top);
      setRevenue30d(rev[0]?.v ?? 0);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!brand) return <p className="p-6 text-sm text-muted-foreground">Brand not found.</p>;

  const totalStock = products.reduce((s, p) => s + p.stock_qty, 0);
  const lowStockCount = products.filter((p) => p.stock_qty <= p.reorder_level && p.reorder_level > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ fallback: "/retail?tab=brands" }}
        eyebrow="Brand"
        title={brand.name}
        description={brand.slug ? `Slug · ${brand.slug}` : "Retail brand"}
      />

      <div className="grid grid-cols-4 gap-3">
        <Kpi label="Products" value={products.length.toLocaleString()} />
        <Kpi label="Total stock" value={totalStock.toLocaleString()} />
        <Kpi label="Low stock" value={lowStockCount.toLocaleString()} tone={lowStockCount ? "warn" : "muted"} />
        <Kpi label="Revenue 30d" value={KES(revenue30d)} />
      </div>

      {/* Top sellers */}
      {topSellers.length > 0 && (
        <section>
          <h2 className="text-[13px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Top sellers (30d)</h2>
          <ul className="rounded-lg border border-border divide-y divide-border/60">
            {topSellers.map((t, idx) => (
              <li key={t.product_id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="font-mono text-muted-foreground w-6">#{idx + 1}</span>
                <button
                  onClick={() => navigate(`/inventory/products/${t.product_id}`)}
                  className="flex-1 text-left hover:text-primary"
                >
                  {t.product_name}
                </button>
                <span className="text-xs text-muted-foreground font-mono">{t.units} units</span>
                <span className="font-mono tabular-nums">{KES(t.revenue)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* All products */}
      <section>
        <h2 className="text-[13px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">All products</h2>
        {products.length === 0 ? (
          <EmptyState icon={Package} title="No products under this brand yet" description="Assign a brand when creating or editing a product." />
        ) : (
          <ul className="rounded-lg border border-border divide-y divide-border/60">
            {products.map((p) => {
              const low = p.stock_qty <= p.reorder_level && p.reorder_level > 0;
              return (
                <li key={p.id} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-accent/30">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  <button
                    onClick={() => navigate(`/inventory/products/${p.id}`)}
                    className="flex-1 text-left hover:text-primary"
                  >
                    {p.name}
                  </button>
                  <span className="text-xs text-muted-foreground font-mono">{p.sku}</span>
                  <span className="font-mono tabular-nums text-xs">{p.stock_qty}</span>
                  {low && <Badge variant="outline" className="bg-amber-500/10 text-amber-600 text-[10px]">Low</Badge>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "warn" | "muted" }) {
  const cls =
    tone === "warn" ? "text-amber-600" :
    tone === "muted" ? "text-muted-foreground" :
    "text-foreground";
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold font-mono tabular-nums mt-1 ${cls}`}>{value}</div>
    </div>
  );
}
