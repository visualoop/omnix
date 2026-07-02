import { useState, useEffect } from "react";
import {
  Calendar,
  CircleNotch as Loader2,
  FileText,
  Printer as Printer,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getZReport, printZReport, type ZReport } from "@/services/z-report";
import { printXReport } from "@/services/x-report";
import { toast } from "sonner";
import { intlLocale } from "@/lib/intl";
import { AiButton } from "@/components/ai/AiButton";
import { ai } from "@/services/ai";
import { Sparkle as Sparkles } from "@phosphor-icons/react";

import { BackButton } from "@/components/ui/back-button";
export function ZReportPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<ZReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string>("");

  const load = async () => {
    setLoading(true);
    setAiSummary("");
    try {
      setReport(await getZReport(date));
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [date]);

  const runAiSummary = async () => {
    if (!report) return;
    const cash = report.by_method.find((m) => /cash/i.test(m.method))?.total ?? 0;
    const mpesa = report.by_method.find((m) => /mpesa|m-pesa/i.test(m.method))?.total ?? 0;
    const card = report.by_method.find((m) => /card/i.test(m.method))?.total ?? 0;
    const other = report.by_method
      .filter((m) => !/cash|mpesa|m-pesa|card/i.test(m.method))
      .reduce((s, m) => s + m.total, 0);
    const summary = await ai.summarizeZReport({
      date,
      total_sales: report.net_sales,
      transaction_count: report.sale_count,
      cash, mpesa, card, other,
      refunds: report.return_total,
      expected_drawer: report.cash_net,
      top_products: report.top_products.slice(0, 3).map((p) => ({ name: p.product_name, qty: p.qty })),
    });
    setAiSummary(summary);
  };

  const handlePrint = async () => {
    try {
      await printZReport(date);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handlePrintX = async () => {
    try {
      await printXReport(date);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const fmt = (n: number) => n.toLocaleString(intlLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <BackButton fallback="/reports" />
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Shift Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-medium text-foreground">X-Report</span> = live snapshot (print anytime, doesn&rsquo;t close the shift).
            {" "}<span className="font-medium text-foreground">Z-Report</span> = final end-of-day summary.
            Same numbers, different intent — cashiers print X during the day to spot-check,
            then Z at close to hand over to the owner.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="pl-8 w-[160px]"
            />
          </div>
          <Button onClick={handlePrintX} variant="outline" disabled={!report || loading}>
            <Printer className="h-4 w-4 mr-2" /> X-Report
          </Button>
          <Button onClick={handlePrint} disabled={!report || loading}>
            <Printer className="h-4 w-4 mr-2" /> Z-Report
          </Button>
        </div>
      </div>

      {report && !loading && (
        <div className="border border-border rounded-lg p-4 bg-primary/5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Shift summary
            </h3>
            {!aiSummary && (
              <AiButton label="Summarise day" onRun={runAiSummary} />
            )}
          </div>
          {aiSummary ? (
            <p className="text-sm leading-relaxed text-foreground/85">{aiSummary}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Get a plain-language end-of-day summary you can share with the team.
            </p>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading report...
        </div>
      ) : !report ? null : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Sales Summary */}
          <Section title="Sales Summary">
            <Row label="Sales count" value={String(report.sale_count)} />
            <Row label="Gross sales" value={fmt(report.gross_sales)} />
            <Row label="Discounts" value={`-${fmt(report.discount_total)}`} negative />
            <Row label="Tax (VAT)" value={fmt(report.tax_total)} />
            {report.tip_total > 0 && <Row label="Tips (paid to staff)" value={fmt(report.tip_total)} />}
            <Row label={`Returns (${report.return_count})`} value={`-${fmt(report.return_total)}`} negative />
            <Row label="Net sales (excl. tips)" value={fmt(report.net_sales)} bold />
          </Section>

          {/* Payment Methods */}
          <Section title="Payment Methods">
            {report.by_method.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sales yet</p>
            ) : (
              report.by_method.map((m) => (
                <Row key={m.method} label={`${m.method} (${m.count})`} value={fmt(m.total)} />
              ))
            )}
          </Section>

          {/* Cash Movement */}
          <Section title="Cash Movement" highlight>
            <Row label="Cash in" value={fmt(report.cash_in)} positive />
            <Row label="Cash out" value={fmt(report.cash_out)} negative />
            <Row label="Net cash" value={fmt(report.cash_net)} bold />
          </Section>

          {/* Other money */}
          <Section title="Settlement & Expenses">
            <Row label="Customer payments collected" value={fmt(report.customer_payments_total)} positive />
            <Row label="Supplier payments made" value={fmt(report.supplier_payments_total)} negative />
            <Row label="Expenses" value={fmt(report.expenses_total)} negative />
          </Section>

          {/* Pharmacy */}
          {report.prescription_count > 0 && (
            <Section title="Pharmacy">
              <Row label="Prescriptions dispensed" value={String(report.prescription_count)} />
              {report.controlled_dispensed > 0 && (
                <Row label="Controlled substances" value={String(report.controlled_dispensed)} />
              )}
            </Section>
          )}

          {/* By Cashier */}
          {report.by_user.length > 0 && (
            <Section title="By Cashier">
              {report.by_user.map((u) => (
                <Row key={u.user_name} label={`${u.user_name} (${u.sale_count})`} value={fmt(u.total)} />
              ))}
            </Section>
          )}

          {/* Top Products */}
          {report.top_products.length > 0 && (
            <div className="lg:col-span-3 border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3">Top Products</h3>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-left py-2 font-medium">Product</th>
                    <th className="text-right py-2 font-medium">Qty</th>
                    <th className="text-right py-2 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.top_products.map((p) => (
                    <tr key={p.product_name} className="border-b border-border last:border-0">
                      <td className="py-2">{p.product_name}</td>
                      <td className="py-2 text-right font-mono">{p.qty}</td>
                      <td className="py-2 text-right font-mono">{fmt(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children, highlight }: {
  title: string; children: React.ReactNode; highlight?: boolean;
}) {
  return (
    <div className={`border rounded-lg p-4 space-y-1.5 ${highlight ? "border-primary/40 bg-primary/5" : "border-border"}`}>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value, bold, positive, negative }: {
  label: string; value: string; bold?: boolean; positive?: boolean; negative?: boolean;
}) {
  return (
    <div className={`flex justify-between text-sm ${bold ? "font-semibold pt-1.5 border-t border-border" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`font-mono ${positive ? "text-emerald-700" : negative ? "text-red-700" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
