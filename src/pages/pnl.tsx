import { useState, useEffect } from "react";
import { Download, TrendingUp, TrendingDown, Printer, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPnL, type PnLData } from "@/services/accounting";
import { printPage } from "@/lib/print";
import { exportToCSV } from "@/lib/export";
import { money as KES } from "@/lib/money";
import { intlLocale } from "@/lib/intl";


export function PnLPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [data, setData] = useState<PnLData | null>(null);

  useEffect(() => {
    getPnL(startDate, endDate).then(setData);
  }, [startDate, endDate]);

  const setQuickRange = (days: number) => {
    setEndDate(today);
    setStartDate(new Date(Date.now() - days * 86400000).toISOString().slice(0, 10));
  };

  const setMonth = () => {
    setStartDate(monthStart);
    setEndDate(today);
  };

  const handleExport = () => {
    if (!data) return;
    const rows = [
      { line: "REVENUE", amount: "" },
      { line: "  Sales (Cash)", amount: data.revenue.sales_cash.toFixed(2) },
      { line: "  Sales (Credit)", amount: data.revenue.sales_credit.toFixed(2) },
      { line: "  Sales (Other Methods)", amount: data.revenue.sales_other.toFixed(2) },
      { line: "  Sales Returns", amount: `-${data.revenue.returns.toFixed(2)}` },
      { line: "  Other Income", amount: data.revenue.other_income.toFixed(2) },
      { line: "Net Revenue", amount: data.revenue.total.toFixed(2) },
      { line: "", amount: "" },
      { line: "Cost of Goods Sold", amount: data.cogs.toFixed(2) },
      { line: "Returned COGS", amount: `-${data.returned_cogs.toFixed(2)}` },
      { line: "Gross Profit", amount: data.gross_profit.toFixed(2) },
      { line: "", amount: "" },
      { line: "EXPENSES", amount: "" },
      ...data.expenses.map((e) => ({ line: `  ${e.category}`, amount: e.amount.toFixed(2) })),
      { line: "Total Expenses", amount: data.total_expenses.toFixed(2) },
      { line: "", amount: "" },
      { line: "NET PROFIT", amount: data.net_profit.toFixed(2) },
      { line: `Margin: ${data.margin.toFixed(2)}%`, amount: "" },
    ];
    exportToCSV(`pnl-${startDate}-to-${endDate}`, rows);
  };

  const totalIn = data ? data.revenue.total : 0;
  const totalOut = data ? data.cogs + data.total_expenses : 0;
  const barRatio = totalIn > 0 ? Math.min(Math.abs(data?.net_profit || 0) / totalIn, 1) : 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between print-hide">
        <h1 className="text-xl font-semibold tracking-tight">Profit & Loss</h1>
        {data && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => printPage(`P&L ${startDate} to ${endDate}`)}>
              <Printer className="h-3.5 w-3.5 mr-1" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap print-hide">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 w-40 rounded-md border border-border bg-background px-2 text-[13px]"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 w-40 rounded-md border border-border bg-background px-2 text-[13px]"
          />
        </div>
        <div className="flex gap-1 border border-border rounded-md p-0.5">
          {[
            { label: "7d", fn: () => setQuickRange(7) },
            { label: "30d", fn: () => setQuickRange(30) },
            { label: "This Month", fn: setMonth },
            { label: "1Y", fn: () => setQuickRange(365) },
          ].map(({ label, fn }) => (
            <button key={label} onClick={fn} className="px-3 py-1 text-xs rounded hover:bg-accent transition">
              {label}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <div className="py-16 text-sm text-muted-foreground">Loading statement&hellip;</div>
      ) : (
        <div>
          {/* Health bar */}
          <div className="mb-8">
            <div className="flex items-end gap-4 mb-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Revenue</div>
                <div className="text-2xl font-bold font-mono tabular-nums">{KES(data.revenue.total)}</div>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground mb-1" />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Costs</div>
                <div className="text-2xl font-bold font-mono tabular-nums">{KES(totalOut)}</div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Profit</div>
                <div className={`text-2xl font-bold font-mono tabular-nums ${data.net_profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                  {KES(data.net_profit)}
                </div>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden flex">
              <div
                className="h-full bg-muted-foreground/40 transition-all"
                style={{ width: `${Math.min(totalOut / Math.max(totalIn, 1) * 100, 60)}%` }}
              />
              <div
                className={`h-full transition-all ${data.net_profit >= 0 ? "bg-emerald-500 dark:bg-emerald-400" : "bg-destructive"}`}
                style={{ width: `${Math.max(barRatio * 40, 2)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-muted-foreground">
                {totalIn > 0 ? ((totalOut / totalIn) * 100).toFixed(0) : 0}% cost ratio
              </span>
              <span className={`text-[10px] font-semibold ${data.net_profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                {data.margin.toFixed(1)}% margin
              </span>
            </div>
          </div>

          {/* Revenue Section */}
          <Section title="Revenue" icon={TrendingUp}>
            <Row label="Cash sales" value={data.revenue.sales_cash} ratio={data.revenue.total} />
            <Row label="Credit sales" value={data.revenue.sales_credit} ratio={data.revenue.total} />
            {data.revenue.sales_other > 0 && (
              <Row label="Other methods" value={data.revenue.sales_other} ratio={data.revenue.total} />
            )}
            {data.revenue.returns > 0 && (
              <Row label="Returns" value={-data.revenue.returns} negative />
            )}
            {data.revenue.other_income > 0 && (
              <Row label="Other income" value={data.revenue.other_income} ratio={data.revenue.total} />
            )}
            <div className="flex justify-between py-2 border-t border-border mt-1">
              <span className="text-sm font-semibold">Net Revenue</span>
              <span className="text-sm font-bold font-mono tabular-nums">{KES(data.revenue.total)}</span>
            </div>
          </Section>

          {/* COGS Section */}
          <Section title="Cost of Goods Sold" icon={TrendingDown}>
            <Row label="COGS" value={data.cogs} ratio={data.revenue.total} />
            {data.returned_cogs > 0 && (
              <Row label="Returned COGS" value={-data.returned_cogs} negative />
            )}
            <div className="flex justify-between py-2 border-t border-border mt-1">
              <span className="text-sm font-semibold">Gross Profit</span>
              <span className={`text-sm font-bold font-mono tabular-nums ${data.gross_profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                {KES(data.gross_profit)}
              </span>
            </div>
          </Section>

          {/* Expenses Section */}
          <Section title="Operating Expenses" icon={TrendingDown}>
            {data.expenses.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3">No expenses recorded in this period</p>
            ) : (
              <>
                {data.expenses.map((e) => (
                  <Row key={e.category} label={e.category} value={e.amount} ratio={data.revenue.total} />
                ))}
              </>
            )}
            <div className="flex justify-between py-2 border-t border-border mt-1">
              <span className="text-sm font-semibold">Total Expenses</span>
              <span className="text-sm font-bold font-mono tabular-nums">{KES(data.total_expenses)}</span>
            </div>
          </Section>

          {/* Net Profit */}
          <div className="mt-6 pt-5 border-t-2 border-border">
            <div className="flex justify-between items-baseline">
              <div>
                <div className="text-lg font-bold tracking-tight">Net Profit</div>
                <div className="text-xs text-muted-foreground">Before tax &bull; {startDate} &ndash; {endDate}</div>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-bold font-mono tabular-nums ${data.net_profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                  {KES(data.net_profit)}
                </div>
                <div className={`text-xs mt-0.5 ${data.net_profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                  {data.margin.toFixed(1)}% of revenue
                </div>
              </div>
            </div>
          </div>

          {/* Print-only footer */}
          <div className="hidden print:block mt-10 pt-4 border-t border-border text-[10px] text-muted-foreground space-y-1">
            <p>Profit &amp; Loss Statement &bull; {startDate} to {endDate}</p>
            <p>Generated {new Date().toLocaleString(intlLocale())}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof TrendingUp; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  ratio,
  negative,
}: {
  label: string;
  value: number;
  ratio?: number;
  negative?: boolean;
}) {
  const pct = ratio && ratio > 0 ? ((Math.abs(value) / ratio) * 100).toFixed(0) : null;
  return (
    <div className="flex justify-between py-1.5 group">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        {pct && !negative && (
          <span className="text-[10px] text-muted-foreground/60 tabular-nums opacity-0 group-hover:opacity-100 transition">
            {pct}%
          </span>
        )}
        <span className={`text-sm font-mono tabular-nums ${negative ? "text-destructive" : ""}`}>
          {negative ? "-" : ""}{KES(Math.abs(value))}
        </span>
      </div>
    </div>
  );
}
