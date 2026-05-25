import { useState, useEffect } from "react";
import { Download, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPnL, type PnLData } from "@/services/accounting";
import { exportToCSV } from "@/lib/export";

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
      { line: "  Other Income", amount: data.revenue.other_income.toFixed(2) },
      { line: "Total Revenue", amount: data.revenue.total.toFixed(2) },
      { line: "", amount: "" },
      { line: "Cost of Goods Sold", amount: data.cogs.toFixed(2) },
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Profit & Loss</h1>
        {data && (
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
          </Button>
        )}
      </div>

      {/* Date controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 w-40" />
          <span className="text-sm text-muted-foreground">to</span>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-40" />
        </div>
        <div className="flex gap-1 border border-border rounded-md p-0.5">
          <button onClick={() => setQuickRange(7)} className="px-3 py-1 text-xs rounded hover:bg-accent">7d</button>
          <button onClick={() => setQuickRange(30)} className="px-3 py-1 text-xs rounded hover:bg-accent">30d</button>
          <button onClick={setMonth} className="px-3 py-1 text-xs rounded hover:bg-accent">This Month</button>
          <button onClick={() => setQuickRange(365)} className="px-3 py-1 text-xs rounded hover:bg-accent">1Y</button>
        </div>
      </div>

      {!data ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <SummaryCard label="Total Revenue" value={data.revenue.total} icon={TrendingUp} tone="success" />
            <SummaryCard label="Total Expenses" value={data.total_expenses + data.cogs} icon={TrendingDown} tone="warning" />
            <SummaryCard label="Net Profit" value={data.net_profit} icon={TrendingUp} tone={data.net_profit >= 0 ? "success" : "destructive"} />
          </div>

          {/* P&L Statement */}
          <div className="border border-border rounded-lg p-6 max-w-2xl mx-auto">
            <h2 className="text-lg font-semibold mb-1 text-center">Profit & Loss Statement</h2>
            <p className="text-xs text-muted-foreground text-center mb-6">{startDate} to {endDate}</p>

            <Section title="Revenue">
              <Line label="Sales (Cash)" amount={data.revenue.sales_cash} />
              <Line label="Sales (Credit)" amount={data.revenue.sales_credit} />
              <Line label="Sales (Other Methods)" amount={data.revenue.sales_other} />
              <Line label="Other Income" amount={data.revenue.other_income} />
              <Line label="Total Revenue" amount={data.revenue.total} bold />
            </Section>

            <Section title="Cost of Goods Sold">
              <Line label="COGS" amount={data.cogs} />
              <Line label="Gross Profit" amount={data.gross_profit} bold positive={data.gross_profit >= 0} />
            </Section>

            <Section title="Operating Expenses">
              {data.expenses.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No expenses recorded</p>
              ) : (
                data.expenses.map((e) => <Line key={e.category} label={e.category} amount={e.amount} />)
              )}
              <Line label="Total Expenses" amount={data.total_expenses} bold />
            </Section>

            <div className="mt-6 pt-4 border-t-2 border-border">
              <div className="flex justify-between items-center">
                <span className="text-base font-bold">NET PROFIT</span>
                <span className={`text-2xl font-bold font-mono ${data.net_profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  KES {data.net_profit.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                <span>Profit Margin</span>
                <span className="font-mono">{data.margin.toFixed(2)}%</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof TrendingUp; tone: "success" | "warning" | "destructive" }) {
  const tones = {
    success: "border-green-500/50 bg-green-500/5 text-green-600",
    warning: "border-amber-500/50 bg-amber-500/5 text-amber-600",
    destructive: "border-destructive/50 bg-destructive/5 text-destructive",
  };
  return (
    <div className={`border rounded-lg p-4 ${tones[tone].split(" ").slice(0, 2).join(" ")}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${tones[tone].split(" ")[2]}`} />
      </div>
      <p className="text-2xl font-semibold mt-1 font-mono">
        <span className="text-xs text-muted-foreground mr-1">KES</span>
        {value.toFixed(0)}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Line({ label, amount, bold, positive }: { label: string; amount: number; bold?: boolean; positive?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 ${bold ? "border-t border-border font-semibold pt-2 mt-1" : ""}`}>
      <span className={bold ? "text-foreground" : "text-muted-foreground pl-4"}>{label}</span>
      <span className={`font-mono ${positive === false ? "text-red-600" : positive ? "text-green-600" : ""}`}>
        {amount.toFixed(2)}
      </span>
    </div>
  );
}
