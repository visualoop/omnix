import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSalesByDay, getTopProducts, getSalesByPaymentMethod, type SalesByDay, type TopProduct, type SalesByPaymentMethod } from "@/services/reports";
import { exportToCSV } from "@/lib/export";
import { AreaChart, PieChart, BarChart } from "@/components/charts";
import { ComparisonPanel } from "@/components/shared/comparison-panel";
import { money } from "@/lib/money";

export function ReportsPage() {
  const [period, setPeriod] = useState(30);
  const [salesByDay, setSalesByDay] = useState<SalesByDay[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [paymentMix, setPaymentMix] = useState<SalesByPaymentMethod[]>([]);

  useEffect(() => {
    Promise.all([
      getSalesByDay(period),
      getTopProducts(period, 20),
      getSalesByPaymentMethod(period),
    ]).then(([s, t, p]) => {
      setSalesByDay(s);
      setTopProducts(t);
      setPaymentMix(p);
    });
  }, [period]);

  const totalRevenue = salesByDay.reduce((s, d) => s + d.total, 0);
  const totalSales = salesByDay.reduce((s, d) => s + d.count, 0);
  const avgSale = totalSales > 0 ? totalRevenue / totalSales : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Sales Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Last {period} days</p>
        </div>
        <div className="flex gap-1 border border-border rounded-md p-0.5">
          {[7, 30, 90, 365].map((d) => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                period === d ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d === 365 ? "1Y" : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Total Revenue" value={money(totalRevenue)} />
        <SummaryCard label="Transactions" value={String(totalSales)} />
        <SummaryCard label="Average Sale" value={money(avgSale)} />
      </div>

      {/* Period comparison */}
      <ComparisonPanel currentDays={period} />

      {/* Sales trend chart */}
      <div className="border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">Sales Trend</h2>
        {salesByDay.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No data</p>
        ) : (
          <AreaChart data={salesByDay} xKey="date" yKey="total" height={260} />
        )}
      </div>

      {/* Top Products */}
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Top Products</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => exportToCSV("top-products", topProducts)}
          >
            <Download className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
        </div>
        {topProducts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No sales in this period</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bar chart */}
            <BarChart
              data={topProducts.slice(0, 8).map((p) => ({ name: p.product_name.slice(0, 15), revenue: p.total_revenue }))}
              xKey="name"
              yKey="revenue"
              horizontal
              height={260}
            />
            {/* Table */}
            <div className="overflow-auto max-h-[260px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2 font-medium">Product</th>
                    <th className="text-right py-2 font-medium">Qty</th>
                    <th className="text-right py-2 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p) => (
                    <tr key={p.product_id} className="border-b border-border last:border-0">
                      <td className="py-2 truncate max-w-[140px]">{p.product_name}</td>
                      <td className="py-2 text-right font-mono">{p.qty_sold}</td>
                      <td className="py-2 text-right font-mono">{p.total_revenue.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Payment mix */}
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Payment Methods</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => exportToCSV("payment-mix", paymentMix)}
          >
            <Download className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
        </div>
        {paymentMix.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No payments in this period</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <PieChart
              data={paymentMix.map((p) => ({ name: p.method_name, value: p.total }))}
              height={240}
            />
            <div className="space-y-2">
              {paymentMix.map((p) => {
                const pct = (p.total / totalRevenue) * 100;
                return (
                  <div key={p.method_name} className="flex justify-between text-sm border-b border-border pb-1.5">
                    <span>{p.method_name}</span>
                    <span className="font-mono">
                      {p.total.toFixed(0)}
                      <span className="text-muted-foreground ml-1">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-lg p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="text-2xl font-semibold mt-1 font-mono">{value}</p>
    </div>
  );
}
