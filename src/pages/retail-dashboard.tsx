import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDots as CalendarClock,
  CalendarPlus,
  CaretRight as ChevronRight,
  Package,
  ShoppingBag,
  Tag,
  TrendUp as TrendingUp,
  Warning as AlertTriangle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import {
  getBrandPerformance, getCategoryMix, getRetailKpis,
  type BrandPerformance, type CategoryMix, type RetailKpis,
} from "@/services/retail-reports";
import { useActiveBranch } from "@/stores/active-branch";
import { money as KES } from "@/lib/money";
import { moduleAccent, ModuleMasthead, ModuleStat } from "@/components/shared/module-kit";

const ACCENT = moduleAccent("retail");

export function RetailDashboardPage() {
  const navigate = useNavigate();
  const branchId = useActiveBranch((s) => s.active?.id);
  const [period, setPeriod] = useState({
    start: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
  });
  const [kpis, setKpis] = useState<RetailKpis | null>(null);
  const [brands, setBrands] = useState<BrandPerformance[]>([]);
  const [categories, setCategories] = useState<CategoryMix[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getRetailKpis({ ...period, branchId }),
      getBrandPerformance({ ...period, branchId }),
      getCategoryMix({ ...period, branchId }),
    ]).then(([k, b, c]) => {
      setKpis(k); setBrands(b); setCategories(c);
    }).finally(() => setLoading(false));
  }, [period, branchId]);

  return (
    <div>
      <ModuleMasthead
        accent={ACCENT}
        title="Retail Dashboard"
        subtitle="Brand performance, category mix, shrinkage, and laybys for the period."
        actions={
          <div className="flex items-center gap-2">
            <Input type="date" value={period.start} onChange={(e) => setPeriod({ ...period, start: e.target.value })} className="h-8 w-36" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={period.end} onChange={(e) => setPeriod({ ...period, end: e.target.value })} className="h-8 w-36" />
          </div>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        <ModuleStat accent={ACCENT} label="Revenue" value={kpis ? KES(kpis.total_revenue) : "—"} icon={TrendingUp} tone="accent" />
        <ModuleStat accent={ACCENT} label="Orders" value={kpis ? String(kpis.total_orders) : "—"} icon={ShoppingBag} />
        <ModuleStat accent={ACCENT} label="Avg order" value={kpis ? KES(kpis.avg_order_value) : "—"} icon={Package} />
        <ModuleStat accent={ACCENT} label="Units sold" value={kpis ? String(kpis.total_units_sold) : "—"} icon={Package} />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <Card className="cursor-pointer hover:bg-accent/30" onClick={() => navigate("/retail/shrinkage")}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Shrinkage cost</p>
              <AlertTriangle className="h-3 w-3 text-amber-600" />
            </div>
            <p className="text-base font-semibold font-mono mt-1 text-red-600">{kpis ? KES(kpis.total_shrinkage_cost) : "—"}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/30" onClick={() => navigate("/retail/laybys")}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Layby balance owed</p>
              <CalendarClock className="h-3 w-3 text-blue-600" />
            </div>
            <p className="text-base font-semibold font-mono mt-1">{kpis ? KES(kpis.active_layby_balance) : "—"}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{kpis?.active_laybys || 0} active</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/30" onClick={() => navigate("/retail/special-orders")}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pending orders</p>
              <CalendarPlus className="h-3 w-3 text-purple-600" />
            </div>
            <p className="text-base font-semibold font-mono mt-1">{kpis ? String(kpis.pending_special_orders) : "—"}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">special orders</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Brand performance */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" /> Brand Performance
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/retail/brands")}>
                View all <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
            <table className="w-full text-xs">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Brand</th>
                  <th className="text-right py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Units</th>
                  <th className="text-right py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableRowSkeleton cells={3} rows={4} />
                ) : brands.length === 0 ? (
                  <tr><td colSpan={3} className="py-6 text-center text-muted-foreground text-xs">
                    No branded sales in this period
                  </td></tr>
                ) : (
                  brands.slice(0, 8).map((b) => (
                    <tr key={b.brand_id} className="border-b border-border/60">
                      <td className="py-1.5">{b.brand_name}</td>
                      <td className="py-1.5 text-right tabular-nums font-mono">{b.units_sold}</td>
                      <td className="py-1.5 text-right tabular-nums font-mono font-semibold">{KES(b.revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Category mix */}
        <Card>
          <CardContent className="p-4">
            <h2 className="font-semibold text-sm mb-3">Sales by Category</h2>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-6 bg-muted/30 rounded animate-pulse" />)}
              </div>
            ) : categories.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-xs">No sales in this period</div>
            ) : (
              <div className="space-y-2">
                {categories.slice(0, 8).map((c) => (
                  <div key={c.category_id || c.category_name}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span>{c.category_name}</span>
                      <span className="tabular-nums font-mono text-muted-foreground">
                        {KES(c.revenue)} <span className="text-[10px]">· {c.percentage.toFixed(1)}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all"
                        style={{ width: `${c.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
