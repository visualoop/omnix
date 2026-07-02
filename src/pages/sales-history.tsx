import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Eye,
  MagnifyingGlass as Search,
  Money as Banknote,
  Printer as Printer,
  Receipt,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { query } from "@/lib/db";
import { pageSales } from "@/services/paged";
import { useListData } from "@/hooks/use-list-data";
import { PaginationBar } from "@/components/pagination-bar";
import { buildReceiptData, printReceipt } from "@/services/receipt";
import { useActiveBranch } from "@/stores/active-branch";
import { toast } from "sonner";
import { intlLocale } from "@/lib/intl";
import { money } from "@/lib/money";

interface SaleRow {
  id: string;
  sale_number: number;
  created_at: string;
  total: number;
  payment_status: string;
  status: string;
  cashier: string | null;
  customer: string | null;
  customer_name?: string | null;
  item_count: number;
}

interface SaleDetail extends SaleRow {
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  items: Array<{ product_name: string; quantity: number; unit_price: number; total: number }>;
  payments: Array<{ method_name: string; amount: number; reference: string | null }>;
}

export function SalesHistoryPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<"today" | "week" | "month" | "all">("today");
  const [activeSale, setActiveSale] = useState<SaleDetail | null>(null);
  const branchId = useActiveBranch((s) => s.active?.id || "default-branch");

  const fetcher = useCallback(
    (q: { search?: string; page?: number; pageSize?: number }) => {
      let from: string | undefined;
      if (period === "today") from = new Date(Date.now() - 0).toISOString().slice(0, 10) + " 00:00:00";
      else if (period === "week") from = new Date(Date.now() - 7 * 86400000).toISOString();
      else if (period === "month") from = new Date(Date.now() - 30 * 86400000).toISOString();
      return pageSales({ ...q, from, branch_id: branchId, exclude_held: true });
    },
    [period, branchId],
  );
  const list = useListData(fetcher, { pageSize: 50 });
  const sales = (list.rows as unknown as SaleRow[]).map((s) => ({
    ...s,
    customer: (s as any).customer_name ?? null,
  }));
  const loading = list.loading;

  const openDetail = async (id: string) => {
    const sale = (await query<SaleDetail>(
      `SELECT s.id, s.sale_number, s.created_at, s.total, s.subtotal, s.discount_amount, s.tax_amount,
              s.payment_status, s.status,
              u.full_name as cashier, c.name as customer,
              (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as item_count
       FROM sales s
       LEFT JOIN users u ON u.id = s.user_id
       LEFT JOIN customers c ON c.id = s.customer_id
       WHERE s.id = ?1`,
      [id]
    ))[0];
    if (!sale) return;
    sale.items = await query("SELECT product_name, quantity, unit_price, total FROM sale_items WHERE sale_id = ?1", [id]);
    sale.payments = await query("SELECT method_name, amount, reference FROM payments WHERE sale_id = ?1", [id]);
    setActiveSale(sale);
  };

  const handleReprint = async (saleId: string) => {
    try {
      const data = await buildReceiptData(saleId);
      if (!data) { toast.error("Receipt data not found"); return; }
      printReceipt(data);
    } catch (e) {
      toast.error("Print failed: " + e);
    }
  };

  const totalSales = sales.reduce((s, x) => s + x.total, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ fallback: "/" }}
        eyebrow="Commerce"
        title="Sales"
        description="Browse, view detail, and reprint past receipts."
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label={`${period === "today" ? "Today" : period === "week" ? "This Week" : period === "month" ? "This Month" : "All Time"} Sales`} value={money(totalSales)} icon={Banknote} />
        <StatCard label="Transactions" value={String(sales.length)} icon={Receipt} />
        <StatCard label="Avg Sale" value={sales.length > 0 ? money(totalSales / sales.length) : money(0)} icon={Calendar} />
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="flex gap-1 border border-border rounded-md p-0.5">
          {(["today", "week", "month", "all"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {p === "today" ? "Today" : p === "week" ? "Week" : p === "month" ? "Month" : "All"}
            </button>
          ))}
        </div>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={list.search}
            onChange={(e) => list.setSearch(e.target.value)}
            placeholder="Search by receipt #, customer, cashier..."
            className="pl-9"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
      ) : sales.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No sales in this period</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">Receipt #</th>
                <th className="text-left px-3 py-2 font-medium">Date</th>
                <th className="text-left px-3 py-2 font-medium">Cashier</th>
                <th className="text-left px-3 py-2 font-medium">Customer</th>
                <th className="text-right px-3 py-2 font-medium">Items</th>
                <th className="text-right px-3 py-2 font-medium">Total</th>
                <th className="text-center px-3 py-2 font-medium">Status</th>
                <th className="text-right px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr
                  key={sale.id}
                  onClick={() => navigate(`/sales/${sale.id}`)}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                >
                  <td className="px-3 py-2 font-mono text-xs hover:underline underline-offset-4">#{sale.sale_number}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    {new Date(sale.created_at).toLocaleString(intlLocale(), {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className="px-3 py-2">{sale.cashier || "—"}</td>
                  <td className="px-3 py-2">{sale.customer || <span className="text-muted-foreground">Walk-in</span>}</td>
                  <td className="px-3 py-2 text-right font-mono">{sale.item_count}</td>
                  <td className="px-3 py-2 text-right font-mono font-medium">{sale.total.toFixed(2)}</td>
                  <td className="px-3 py-2 text-center">
                    <PaymentBadge status={sale.payment_status} saleStatus={sale.status} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(sale.id)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleReprint(sale.id)}>
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!activeSale} onOpenChange={(o) => !o && setActiveSale(null)}>
        <SheetContent side="right" className="w-[500px] sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle>Receipt #{activeSale?.sale_number}</SheetTitle>
          </SheetHeader>
          {activeSale && <SaleDetailView sale={activeSale} onReprint={() => handleReprint(activeSale.id)} />}
        </SheetContent>
      </Sheet>

      <PaginationBar list={list} />
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Receipt }) {
  return (
    <div className="border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="h-6 w-6 rounded-md bg-muted/30 flex items-center justify-center">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>
      <p className="text-xl font-semibold font-mono">{value}</p>
    </div>
  );
}

function PaymentBadge({ status, saleStatus }: { status: string; saleStatus: string }) {
  if (saleStatus === "voided") return <Badge variant="destructive">Voided</Badge>;
  if (status === "paid") return <Badge className="bg-green-600 hover:bg-green-600">Paid</Badge>;
  if (status === "partial") return <Badge variant="outline" className="border-amber-500/50 text-amber-700">Partial</Badge>;
  return <Badge variant="secondary">Unpaid</Badge>;
}

function SaleDetailView({ sale, onReprint }: { sale: SaleDetail; onReprint: () => void }) {
  const date = new Date(sale.created_at).toLocaleString(intlLocale(), {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="border border-border rounded-lg p-4 space-y-1.5">
        <div className="flex justify-between">
          <span className="text-xs text-muted-foreground">Date</span>
          <span className="text-sm">{date}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-muted-foreground">Cashier</span>
          <span className="text-sm">{sale.cashier || "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-muted-foreground">Customer</span>
          <span className="text-sm">{sale.customer || "Walk-in"}</span>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-muted-foreground">Status</span>
          <PaymentBadge status={sale.payment_status} saleStatus={sale.status} />
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="bg-muted/30 px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Items ({sale.items.length})
        </div>
        <div className="divide-y divide-border">
          {sale.items.map((it, i) => (
            <div key={i} className="px-3 py-2 flex justify-between text-sm">
              <div>
                <p>{it.product_name}</p>
                <p className="text-xs text-muted-foreground">{it.quantity} × {it.unit_price.toFixed(2)}</p>
              </div>
              <p className="font-mono">{it.total.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-border rounded-lg p-4 space-y-1.5">
        <Row label="Subtotal" value={sale.subtotal} />
        {sale.discount_amount > 0 && <Row label="Discount" value={-sale.discount_amount} />}
        {sale.tax_amount > 0 && <Row label="VAT" value={sale.tax_amount} />}
        <div className="border-t border-border pt-1.5" />
        <Row label="Total" value={sale.total} bold />
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="bg-muted/30 px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Payments
        </div>
        <div className="divide-y divide-border">
          {sale.payments.map((p, i) => (
            <div key={i} className="px-3 py-2 flex justify-between text-sm">
              <div>
                <p>{p.method_name}</p>
                {p.reference && <p className="text-xs text-muted-foreground font-mono">{p.reference}</p>}
              </div>
              <p className="font-mono">{p.amount.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>

      <Button onClick={onReprint} className="w-full">
        <Printer className="h-4 w-4 mr-2" /> Reprint Receipt
      </Button>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className={bold ? "font-medium" : "text-muted-foreground"}>{label}</span>
      <span className={`font-mono ${bold ? "font-semibold" : ""}`}>
        {value < 0 ? "-" : ""}KES {Math.abs(value).toFixed(2)}
      </span>
    </div>
  );
}
