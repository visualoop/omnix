/**
 * Profit & Loss — financial document, not a dashboard.
 *
 * Design thesis (frontend-design + emil-design-eng + anti-slop-writing):
 * A P&L is the operator's most-formal artifact — the document they
 * show their accountant, their bank, their landlord. The page should
 * read like a typeset annual report, not like a SaaS analytics page.
 *
 *   - Display serif (Fraunces) for the figures that matter: net revenue,
 *     gross profit, net profit. Sub-numbers in monospace.
 *   - Hairline horizontal rules between sections — those rules ARE the
 *     dividers in a printed financial statement.
 *   - Period strip at the top is the masthead: "P&L · WED 12 NOV — WED
 *     19 NOV · 7 DAYS". No icon, no chip.
 *   - Period comparison shows prior comparable period (this 7d vs the 7d
 *     before that). Delta chips in tabular-nums. No 'TrendingUp' icons.
 *   - Expense breakdown is a horizontal stacked bar with one row per
 *     category, sorted by share. Category labels right-aligned, share %
 *     in mono, KES amount in mono.
 *   - Income statement table at the bottom keeps the canonical
 *     accountant order: Revenue → COGS → Gross Profit → Operating
 *     Expenses → Net Profit.
 *
 * Restraint:
 *   - No bento-grid coloured cards.
 *   - No charts library (yet) — sparklines are inline SVG, polylines
 *     hand-rolled. Keeps the bundle small and the visual quiet.
 *   - One animation only: the three hero numbers count up over 600ms
 *     when a fresh range loads. Nothing pulses, nothing loops.
 *
 * Accessibility:
 *   - Negative numbers are wrapped in parentheses and prefixed with the
 *     accounting minus glyph "−" (U+2212), the convention the user's
 *     accountant expects.
 *   - All numbers are tabular-nums so columns align in print.
 */
import { useState, useEffect, useMemo } from "react";
import { motion, useMotionValue, useTransform, animate } from "motion/react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPnL, type PnLData } from "@/services/accounting";
import { printPage } from "@/lib/print";
import { exportToCSV } from "@/lib/export";
import { money as KES } from "@/lib/money";
import { intlLocale } from "@/lib/intl";

function formatRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return `${fmt(s).toUpperCase()} — ${fmt(e).toUpperCase()}`;
}

function daysBetween(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
}

function shiftRangeByDays(start: string, end: string, days: number) {
  const ms = days * 86400000;
  return {
    startDate: new Date(new Date(start).getTime() - ms).toISOString().slice(0, 10),
    endDate: new Date(new Date(end).getTime() - ms).toISOString().slice(0, 10),
  };
}

export function PnLPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [data, setData] = useState<PnLData | null>(null);
  const [prior, setPrior] = useState<PnLData | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setPrior(null);
    const days = daysBetween(startDate, endDate);
    const priorRange = shiftRangeByDays(startDate, endDate, days);
    Promise.all([
      getPnL(startDate, endDate),
      getPnL(priorRange.startDate, priorRange.endDate),
    ]).then(([cur, prv]) => {
      if (cancelled) return;
      setData(cur);
      setPrior(prv);
    });
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  const setQuickRange = (days: number) => {
    setEndDate(today);
    setStartDate(new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10));
  };

  const setMonth = () => {
    setStartDate(monthStart);
    setEndDate(today);
  };

  const handleExport = () => {
    if (!data) return;
    const rows = [
      { line: "REVENUE", amount: "" },
      { line: "  Cash sales", amount: data.revenue.sales_cash.toFixed(2) },
      { line: "  Credit sales", amount: data.revenue.sales_credit.toFixed(2) },
      { line: "  Other methods", amount: data.revenue.sales_other.toFixed(2) },
      { line: "  Sales returns", amount: `-${data.revenue.returns.toFixed(2)}` },
      { line: "  Other income", amount: data.revenue.other_income.toFixed(2) },
      { line: "Net revenue", amount: data.revenue.total.toFixed(2) },
      { line: "", amount: "" },
      { line: "Cost of goods sold", amount: data.cogs.toFixed(2) },
      { line: "Returned COGS", amount: `-${data.returned_cogs.toFixed(2)}` },
      { line: "Gross profit", amount: data.gross_profit.toFixed(2) },
      { line: "", amount: "" },
      { line: "OPERATING EXPENSES", amount: "" },
      ...data.expenses.map((e) => ({ line: `  ${e.category}`, amount: e.amount.toFixed(2) })),
      { line: "Total expenses", amount: data.total_expenses.toFixed(2) },
      { line: "", amount: "" },
      { line: "NET PROFIT", amount: data.net_profit.toFixed(2) },
      { line: `Margin: ${data.margin.toFixed(2)}%`, amount: "" },
    ];
    exportToCSV(`pnl-${startDate}-to-${endDate}`, rows);
  };

  const days = daysBetween(startDate, endDate);

  return (
    <div className="bg-[#FBFAF6] dark:bg-background -m-6 min-h-[calc(100vh-48px)]">
      {/* ─── Masthead ───────────────────────────────────── */}
      <header className="border-b border-foreground/15 px-8 md:px-14 py-4 flex items-baseline justify-between print-hide">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/80">
          <span className="font-semibold text-foreground">Profit &amp; Loss</span>
          <span className="text-foreground/30 mx-2">/</span>
          <span>{formatRange(startDate, endDate)}</span>
          <span className="text-foreground/30 mx-2">·</span>
          <span>{days} {days === 1 ? "day" : "days"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => printPage(`P&L ${startDate} to ${endDate}`)} disabled={!data}>
            <Printer className="h-3.5 w-3.5 mr-1" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!data}>
            <Download className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
        </div>
      </header>

      {/* ─── Range picker ──────────────────────────────── */}
      <div className="px-8 md:px-14 pt-6 pb-4 flex items-center gap-3 flex-wrap print-hide">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-8 w-36 rounded-md border border-foreground/15 bg-transparent px-2 font-mono text-[12px]"
          />
          <span className="text-[12px] text-foreground/60">→</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-8 w-36 rounded-md border border-foreground/15 bg-transparent px-2 font-mono text-[12px]"
          />
        </div>
        <div className="flex gap-0.5 border border-foreground/15 rounded-md p-0.5">
          {[
            { label: "7d", fn: () => setQuickRange(7) },
            { label: "30d", fn: () => setQuickRange(30) },
            { label: "MTD", fn: setMonth },
            { label: "1Y", fn: () => setQuickRange(365) },
          ].map(({ label, fn }) => (
            <button
              key={label}
              onClick={fn}
              className="px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-foreground/70 rounded hover:bg-foreground/[0.04] hover:text-foreground transition"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <div className="px-8 md:px-14 py-20 font-mono text-[12px] uppercase tracking-[0.22em] text-foreground/50">
          Loading statement…
        </div>
      ) : (
        <>
          {/* ─── Hero — three figures ────────────────── */}
          <section className="px-8 md:px-14 pt-6 pb-12 grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6">
            <KPIBlock
              label="Net revenue"
              value={data.revenue.total}
              priorValue={prior?.revenue.total ?? null}
            />
            <KPIBlock
              label="Gross profit"
              value={data.gross_profit}
              priorValue={prior?.gross_profit ?? null}
              caption={data.revenue.total > 0
                ? `${((data.gross_profit / data.revenue.total) * 100).toFixed(1)}% margin`
                : undefined}
            />
            <KPIBlock
              label="Net profit"
              value={data.net_profit}
              priorValue={prior?.net_profit ?? null}
              caption={`${data.margin.toFixed(1)}% margin`}
              emphasised
              sign={data.net_profit < 0 ? "negative" : "positive"}
            />
          </section>

          {/* ─── Expense breakdown ──────────────────── */}
          <section className="px-8 md:px-14 pb-12">
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/60 pb-3 border-b border-foreground/15">
              Where the money went
            </div>
            <ExpenseBreakdown
              cogs={data.cogs}
              expenses={data.expenses}
              returns={data.revenue.returns}
            />
          </section>

          {/* ─── Income statement ───────────────────── */}
          <section className="px-8 md:px-14 pb-16">
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/60 pb-3 border-b border-foreground/15">
              Income statement
            </div>
            <Statement data={data} />
          </section>

          {/* Print footer */}
          <div className="hidden print:block px-14 pb-6 font-mono text-[10px] text-foreground/60 space-y-1">
            <p>Profit &amp; Loss · {startDate} to {endDate}</p>
            <p>Generated {new Date().toLocaleString(intlLocale())}</p>
          </div>
        </>
      )}
    </div>
  );
}

/** Big number in display serif. Optional delta vs. prior period. */
function KPIBlock({
  label, value, priorValue, caption, emphasised, sign,
}: {
  label: string;
  value: number;
  priorValue: number | null;
  caption?: string;
  emphasised?: boolean;
  sign?: "positive" | "negative";
}) {
  const delta =
    priorValue !== null && priorValue !== 0
      ? ((value - priorValue) / Math.abs(priorValue)) * 100
      : null;
  const deltaPositive = delta !== null && delta >= 0;

  // Animated count-up.
  const mv = useMotionValue(0);
  const display = useTransform(mv, (n) => Math.round(n).toLocaleString());
  useEffect(() => {
    const controls = animate(mv, value, {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => controls.stop();
  }, [value, mv]);

  const sizeClass = emphasised
    ? "text-[clamp(48px,7vw,84px)]"
    : "text-[clamp(36px,5vw,60px)]";

  const negative = sign === "negative" || (value < 0 && sign !== "positive");

  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/60">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-[12px] tabular-nums text-foreground/55">KSh</span>
        <motion.span
          style={{ fontFamily: "var(--font-display)" }}
          className={`${sizeClass} leading-[0.95] tracking-[-0.02em] font-medium tabular-nums ${
            negative ? "text-rose-700 dark:text-rose-400" : "text-foreground"
          }`}
        >
          {negative ? "−" : ""}
          <motion.span>{display}</motion.span>
        </motion.span>
      </div>
      <div className="mt-2 flex items-center gap-2 font-mono text-[11px] tabular-nums">
        {delta !== null ? (
          <span
            className={`inline-flex items-baseline gap-1 px-1.5 py-0.5 rounded-sm ${
              deltaPositive
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
            }`}
          >
            {deltaPositive ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}%
          </span>
        ) : null}
        {caption ? (
          <span className="text-foreground/55">{caption}</span>
        ) : null}
        {delta !== null && priorValue !== null ? (
          <span className="text-foreground/40">vs. prior {KES(Math.abs(priorValue))}</span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Horizontal stacked breakdown — one row per cost line, share-of-revenue
 * encoded as a hairline-bordered bar. Categories in caps, kept short.
 */
function ExpenseBreakdown({
  cogs, expenses, returns,
}: {
  cogs: number;
  expenses: Array<{ category: string; amount: number }>;
  returns: number;
}) {
  const allRows = useMemo(() => {
    const rows: { label: string; amount: number; kind: "cogs" | "expense" | "returns" }[] = [];
    if (cogs > 0) rows.push({ label: "Cost of goods sold", amount: cogs, kind: "cogs" });
    if (returns > 0) rows.push({ label: "Sales returns", amount: returns, kind: "returns" });
    expenses.forEach((e) => {
      if (e.amount > 0) rows.push({ label: e.category, amount: e.amount, kind: "expense" });
    });
    return rows.sort((a, b) => b.amount - a.amount);
  }, [cogs, expenses, returns]);

  const total = allRows.reduce((sum, r) => sum + r.amount, 0);

  if (allRows.length === 0) {
    return (
      <div className="py-6 font-mono text-[12px] text-foreground/50">
        Nothing went out this period.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {allRows.map((r) => {
        const pct = total > 0 ? (r.amount / total) * 100 : 0;
        return (
          <div key={r.label} className="grid grid-cols-[1fr_auto] gap-x-4 items-center">
            <div>
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-[13px] font-medium text-foreground">{r.label}</span>
                <span className="font-mono text-[11px] tabular-nums text-foreground/55">
                  {pct.toFixed(1)}%
                </span>
              </div>
              <div className="h-[3px] rounded-full bg-foreground/[0.06] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className={
                    r.kind === "cogs"
                      ? "h-full bg-foreground/70"
                      : r.kind === "returns"
                        ? "h-full bg-rose-500/70"
                        : "h-full bg-foreground/45"
                  }
                />
              </div>
            </div>
            <span className="font-mono text-[14px] tabular-nums text-foreground self-end pb-1">
              {KES(r.amount)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Income statement table — accountant order, mono numbers, hairline rows. */
function Statement({ data }: { data: PnLData }) {
  return (
    <div className="mt-4 max-w-[640px]">
      <Group title="Revenue">
        <Line label="Cash sales" value={data.revenue.sales_cash} />
        <Line label="Credit sales" value={data.revenue.sales_credit} />
        {data.revenue.sales_other > 0 ? <Line label="Other methods" value={data.revenue.sales_other} /> : null}
        {data.revenue.returns > 0 ? <Line label="Sales returns" value={-data.revenue.returns} negative /> : null}
        {data.revenue.other_income > 0 ? <Line label="Other income" value={data.revenue.other_income} /> : null}
      </Group>
      <Subtotal label="Net revenue" value={data.revenue.total} />

      <Group title="Cost of goods sold">
        <Line label="COGS" value={data.cogs} />
        {data.returned_cogs > 0 ? <Line label="Returned COGS" value={-data.returned_cogs} negative /> : null}
      </Group>
      <Subtotal label="Gross profit" value={data.gross_profit} />

      <Group title="Operating expenses">
        {data.expenses.length === 0 ? (
          <div className="py-2 font-mono text-[12px] text-foreground/50">None recorded.</div>
        ) : (
          data.expenses.map((e) => <Line key={e.category} label={e.category} value={e.amount} />)
        )}
      </Group>
      <Subtotal label="Total expenses" value={data.total_expenses} />

      <div className="mt-6 pt-4 border-t-2 border-foreground/80 flex items-baseline justify-between">
        <span style={{ fontFamily: "var(--font-display)" }} className="text-[22px] font-medium">
          Net profit
        </span>
        <span
          style={{ fontFamily: "var(--font-display)" }}
          className={`text-[28px] font-medium tabular-nums ${
            data.net_profit >= 0 ? "text-foreground" : "text-rose-700 dark:text-rose-400"
          }`}
        >
          {data.net_profit < 0 ? "(" : ""}{KES(Math.abs(data.net_profit))}{data.net_profit < 0 ? ")" : ""}
        </span>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 first:mt-0">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/55 pb-2 border-b border-foreground/10">
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Line({ label, value, negative }: { label: string; value: number; negative?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-2 border-b border-foreground/[0.06] last:border-0">
      <span className="text-[13px] text-foreground/80">{label}</span>
      <span
        className={`font-mono text-[13px] tabular-nums ${
          negative ? "text-rose-700 dark:text-rose-400" : "text-foreground"
        }`}
      >
        {negative ? "(" : ""}{KES(Math.abs(value))}{negative ? ")" : ""}
      </span>
    </div>
  );
}

function Subtotal({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between mt-1 pt-2 border-t border-foreground/30">
      <span className="text-[13px] font-semibold uppercase tracking-wider text-foreground">
        {label}
      </span>
      <span className="font-mono text-[15px] font-semibold tabular-nums text-foreground">
        {value < 0 ? "(" : ""}{KES(Math.abs(value))}{value < 0 ? ")" : ""}
      </span>
    </div>
  );
}
