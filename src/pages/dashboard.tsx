import { useState, useEffect } from "react";
import { TrendingUp, ShoppingCart, AlertTriangle, Package, Users, Banknote, FileText } from "lucide-react";
import { getDashboardKPIs, getSalesByDay, getTopProducts, getSalesByPaymentMethod, type DashboardKPIs, type SalesByDay, type TopProduct, type SalesByPaymentMethod } from "@/services/reports";
import { SokoAreaChart, SokoPieChart } from "@/components/charts";
import { Link } from "react-router-dom";

export function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [salesByDay, setSalesByDay] = useState<SalesByDay[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [paymentMix, setPaymentMix] = useState<SalesByPaymentMethod[]>([]);

  useEffect(() => {
    Promise.all([
      getDashboardKPIs(),
      getSalesByDay(7),
      getTopProducts(30, 5),
      getSalesByPaymentMethod(30),
    ]).then(([k, s, t, p]) => {
      setKpis(k);
      setSalesByDay(s);
      setTopProducts(t);
      setPaymentMix(p);
    }).catch(() => {
      // DB not initialized yet — silent
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Today, {new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={ShoppingCart}
          label="Today's Sales"
          value={kpis ? kpis.today_sales_total.toFixed(0) : "—"}
          sub={`${kpis?.today_sales_count || 0} transactions`}
          prefix="KES"
        />
        <KpiCard
          icon={TrendingUp}
          label="Today's Profit"
          value={kpis ? kpis.today_profit.toFixed(0) : "—"}
          prefix="KES"
          tone="success"
        />
        <KpiCard
          icon={Banknote}
          label="Cash on Hand"
          value={kpis ? kpis.cash_position.toFixed(0) : "—"}
          prefix="KES"
        />
        <Link to="/inventory">
          <KpiCard
            icon={AlertTriangle}
            label="Low Stock"
            value={kpis?.low_stock_count ?? "—"}
            sub="items need reorder"
            tone={kpis && kpis.low_stock_count > 0 ? "warning" : "default"}
          />
        </Link>
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-3">
        <Link to="/inventory">
          <MiniCard icon={Package} label="Products" value={kpis?.total_products ?? "—"} />
        </Link>
        <MiniCard icon={Users} label="Customers" value={kpis?.total_customers ?? "—"} />
        <Link to="/pharmacy/expiry">
          <MiniCard
            icon={FileText}
            label="Expiring Soon"
            value={kpis?.expiring_count ?? "—"}
            tone={kpis && kpis.expiring_count > 0 ? "warning" : "default"}
          />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sales chart */}
        <Card title="Sales — Last 7 Days">
          {salesByDay.length === 0 ? (
            <EmptyMini text="No sales yet" />
          ) : (
            <SokoAreaChart data={salesByDay} xKey="date" yKey="total" height={220} />
          )}
        </Card>

        {/* Payment method mix (pie chart) */}
        <Card title="Payment Methods (30d)">
          {paymentMix.length === 0 ? (
            <EmptyMini text="No sales yet" />
          ) : (
            <SokoPieChart
              data={paymentMix.map((p) => ({ name: p.method_name, value: p.total }))}
              height={220}
            />
          )}
        </Card>
      </div>

      {/* Top products */}
      <Card title="Top Products — Last 30 Days">
        {topProducts.length === 0 ? (
          <EmptyMini text="No sales yet" />
        ) : (
          <div className="space-y-2">
            {topProducts.map((p, i) => (
              <div key={p.product_id} className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground w-5">#{i + 1}</span>
                <span className="text-sm flex-1 truncate">{p.product_name}</span>
                <span className="text-xs text-muted-foreground">{p.qty_sold}x</span>
                <span className="text-sm font-mono w-20 text-right">{p.total_revenue.toFixed(0)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, prefix, tone = "default" }: any) {
  const tones = {
    default: "border-border",
    warning: "border-amber-500/50 bg-amber-500/5",
    success: "border-green-500/50 bg-green-500/5",
  };
  return (
    <div className={`border rounded-lg p-4 ${tones[tone as keyof typeof tones]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2">
        {prefix && <span className="text-xs text-muted-foreground mr-1">{prefix}</span>}
        <span className="text-2xl font-semibold font-mono">{value}</span>
      </div>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function MiniCard({ icon: Icon, label, value, tone = "default" }: any) {
  const tones = {
    default: "border-border hover:bg-accent/30",
    warning: "border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10",
  };
  return (
    <div className={`border rounded-lg p-3 transition-colors cursor-pointer ${tones[tone as keyof typeof tones]}`}>
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <p className="text-base font-semibold font-mono">{value}</p>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}

function EmptyMini({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground text-center py-6">{text}</p>;
}
