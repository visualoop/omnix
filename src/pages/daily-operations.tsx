/**
 * Daily Operations Report — end-of-day manager view.
 * Shows ALL products sold, payments, returns, petty cash, shift status, expenses.
 */
import { useEffect, useState } from "react";
import { Calendar, Package, RotateCcw, Banknote, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { query } from "@/lib/db";
import { getActiveBranchId } from "@/stores/active-branch";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowSkeleton } from "@/components/ui/skeletons";

const KES = (n: number) => "KES " + (n || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface ProductItem {
  product_name: string;
  qty_sold: number;
  revenue: number;
  cost: number;
  profit: number;
}

interface PaymentBreakdown {
  method: string;
  count: number;
  total: number;
}

interface DailyData {
  date: string;
  productItems: ProductItem[];
  payments: PaymentBreakdown[];
  totalSales: number;
  totalProducts: number;
  returnsCount: number;
  returnsTotal: number;
  pettyIn: number;
  pettyOut: number;
  expenses: number;
  shiftOpen: boolean;
  shiftOpening: number;
  shiftClosing: number;
}

export function DailyOperationsPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);
  const branchId = getActiveBranchId();

  const load = async () => {
    setLoading(true);
    try {
      const from = `${date} 00:00:00`;
      const to = `${date} 23:59:59`;

      const [products] = await Promise.all([
        query<ProductItem>(
          `SELECT si.product_name,
                  SUM(si.quantity) AS qty_sold,
                  SUM(si.total) AS revenue,
                  COALESCE(SUM(COALESCE(b.buying_price, 0) * si.quantity), 0) AS cost,
                  0 AS profit
           FROM sale_items si
           JOIN sales s ON s.id = si.sale_id
           LEFT JOIN batches b ON b.id = si.batch_id
           WHERE s.created_at BETWEEN ?1 AND ?2 AND s.status = 'completed' AND s.branch_id = ?3
           GROUP BY si.product_id, si.product_name
           ORDER BY qty_sold DESC`,
          [from, to, branchId],
        ),
      ]);

      // Subtract returns from product items
      const returns = await query<{ product_name: string; qty: number; total: number }>(
        `SELECT sri.product_name, SUM(sri.quantity) AS qty, SUM(sri.line_total) AS total
         FROM sale_return_items sri
         JOIN sale_returns sr ON sr.id = sri.return_id
         WHERE sr.created_at BETWEEN ?1 AND ?2 AND sr.branch_id = ?3
         GROUP BY sri.product_id, sri.product_name`,
        [from, to, branchId],
      );

      for (const p of products) {
        const ret = returns.find((r) => r.product_name === p.product_name);
        if (ret) {
          p.qty_sold = Math.max(0, p.qty_sold - ret.qty);
          p.revenue = Math.max(0, p.revenue - ret.total);
          p.cost = Math.max(0, p.cost * (p.qty_sold / (p.qty_sold + ret.qty)));
        }
        p.profit = p.revenue - p.cost;
      }

      const payments = await query<PaymentBreakdown>(
        `SELECT COALESCE(pm.name, p.method_name, 'Other') AS method,
                COUNT(DISTINCT s.id) AS count,
                COALESCE(SUM(p.amount), 0) AS total
         FROM payments p
         JOIN sales s ON s.id = p.sale_id
         LEFT JOIN payment_methods pm ON pm.id = p.method_id
         WHERE s.created_at BETWEEN ?1 AND ?2 AND s.status = 'completed' AND s.branch_id = ?3
           AND s.id NOT IN (SELECT sale_id FROM sale_returns WHERE created_at BETWEEN ?1 AND ?2)
         GROUP BY method ORDER BY total DESC`,
        [from, to, branchId],
      );

      const [retAgg] = await query<{ count: number; total: number }>(
        `SELECT COUNT(*) AS count, COALESCE(SUM(refund_amount), 0) AS total
         FROM sale_returns WHERE created_at BETWEEN ?1 AND ?2 AND branch_id = ?3`,
        [from, to, branchId],
      );

      const [pettyAgg] = await query<{ inTotal: number; outTotal: number }>(
        `SELECT
           COALESCE(SUM(CASE WHEN type = 'topup' THEN amount ELSE 0 END), 0) AS inTotal,
           COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS outTotal
         FROM petty_cash WHERE created_at BETWEEN ?1 AND ?2 AND branch_id = ?3`,
        [from, to, branchId],
      );

      const [expAgg] = await query<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM expenses WHERE expense_date BETWEEN ?1 AND ?2 AND branch_id = ?3`,
        [from, to, branchId],
      );

      const [shift] = await query<{ opening_balance: number; actual_closing: number | null }>(
        `SELECT opening_balance, actual_closing
         FROM cash_register WHERE opened_at <= ?2 AND (closed_at >= ?1 OR closed_at IS NULL) AND branch_id = ?3
         ORDER BY opened_at DESC LIMIT 1`,
        [from, to, branchId],
      );

      setData({
        date,
        productItems: products.filter((p) => p.qty_sold > 0),
        payments,
        totalSales: products.reduce((s, p) => s + p.revenue, 0),
        totalProducts: products.filter((p) => p.qty_sold > 0).length,
        returnsCount: retAgg?.count || 0,
        returnsTotal: retAgg?.total || 0,
        pettyIn: pettyAgg?.inTotal || 0,
        pettyOut: pettyAgg?.outTotal || 0,
        expenses: expAgg?.total || 0,
        shiftOpen: !!shift,
        shiftOpening: shift?.opening_balance || 0,
        shiftClosing: shift?.actual_closing || 0,
      });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [date, branchId]);

  const grandTotal = (data?.totalSales || 0) - (data?.returnsTotal || 0);
  const netCash = grandTotal - (data?.expenses || 0) - (data?.pettyOut || 0);

  if (loading) return (
    <div className="space-y-4 p-6">
      <TableRowSkeleton />
      <TableRowSkeleton />
      <TableRowSkeleton />
    </div>
  );

  if (!data) return <EmptyState icon={Package} title="No data" description="No transactions for this date." />;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Daily Operations</h1>
        <p className="text-sm text-muted-foreground mt-1">End-of-day summary: everything sold, payments, returns, and cash movement.</p>
      </div>

      {/* Date picker */}
      <div className="flex items-center gap-3">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-44"
        />
        <span className="text-sm text-muted-foreground">{data.date}</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Net Sales</div>
          <div className="font-mono font-bold text-lg">{KES(grandTotal)}</div>
          <div className="text-[10px] text-muted-foreground">{data.payments.length} methods</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Products Sold</div>
          <div className="font-mono font-bold text-lg">{data.totalProducts}</div>
          <div className="text-[10px] text-muted-foreground">{data.productItems.reduce((s, p) => s + p.qty_sold, 0)} units</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Returns</div>
          <div className="font-mono font-bold text-lg">{data.returnsCount}</div>
          <div className="text-[10px] text-muted-foreground">{KES(data.returnsTotal)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Net Cash</div>
          <div className="font-mono font-bold text-lg">{KES(netCash)}</div>
          <div className="text-[10px] text-muted-foreground">after expenses & petty</div>
        </CardContent></Card>
      </div>

      {/* Payment breakdown */}
      <section>
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
          <Banknote className="h-3.5 w-3.5 text-muted-foreground" /> Payment Methods
        </h3>
        <div className="space-y-1">
          {data.payments.map((p) => (
            <div key={p.method} className="flex justify-between py-1.5 px-3 bg-muted/30 rounded text-sm">
              <span>{p.method}</span>
              <span className="font-mono tabular-nums">
                {p.count} txns — {KES(p.total)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Petty cash + expenses */}
      {(data.pettyIn > 0 || data.pettyOut > 0 || data.expenses > 0) && (
        <section>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" /> Cash Movement
          </h3>
          <div className="space-y-1 text-sm">
            {data.pettyIn > 0 && <Row label="Petty cash in" value={data.pettyIn} color="text-emerald-600 dark:text-emerald-400" />}
            {data.pettyOut > 0 && <Row label="Petty cash out" value={-data.pettyOut} color="text-destructive" />}
            {data.expenses > 0 && <Row label="Expenses" value={-data.expenses} color="text-destructive" />}
          </div>
        </section>
      )}

      {/* All products sold */}
      <section>
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
          <Package className="h-3.5 w-3.5 text-muted-foreground" /> All Products Sold
        </h3>
        {data.productItems.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">No products sold today</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="text-left px-3 py-2 font-medium">Product</th>
                  <th className="text-right px-3 py-2 font-medium w-20">Qty</th>
                  <th className="text-right px-3 py-2 font-medium w-28">Revenue</th>
                  <th className="text-right px-3 py-2 font-medium w-28">Profit</th>
                </tr>
              </thead>
              <tbody>
                {data.productItems.map((p, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-1.5 font-medium">{p.product_name}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{p.qty_sold}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{p.revenue.toFixed(2)}</td>
                    <td className={`px-3 py-1.5 text-right font-mono tabular-nums ${p.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                      {p.profit.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Returns detail */}
      {data.returnsCount > 0 && (
        <section>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" /> Returns
          </h3>
          <p className="text-sm text-muted-foreground">
            {data.returnsCount} return{data.returnsCount !== 1 ? "s" : ""} totaling {KES(data.returnsTotal)}
          </p>
        </section>
      )}
    </div>
  );
}

function Row({ label, value, color = "" }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex justify-between py-1.5 px-3 bg-muted/30 rounded">
      <span>{label}</span>
      <span className={`font-mono tabular-nums ${color}`}>{value < 0 ? "-" : ""}{KES(Math.abs(value))}</span>
    </div>
  );
}
