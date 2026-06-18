import { useState, useEffect } from "react";
import { Download, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getVatReport } from "@/services/etims";
import { exportToCSV } from "@/lib/export";
import { money } from "@/lib/money";

export function VatReportPage() {
  // Default to current month
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(monthEnd);
  const [report, setReport] = useState<{
    total_sales: number;
    taxable_sales: number;
    exempt_sales: number;
    output_vat: number;
    invoice_count: number;
    signed_count: number;
    pending_count: number;
  } | null>(null);

  const load = async () => {
    const data = await getVatReport(startDate, endDate);
    setReport(data);
  };

  useEffect(() => { load(); }, [startDate, endDate]);

  const handleExport = () => {
    if (!report) return;
    exportToCSV(`vat-report-${startDate}-to-${endDate}`, [{
      period_start: startDate,
      period_end: endDate,
      total_sales: report.total_sales,
      taxable_sales_16pct: report.taxable_sales,
      exempt_sales: report.exempt_sales,
      output_vat: report.output_vat,
      invoices_signed: report.signed_count,
      invoices_pending: report.pending_count,
    }]);
  };

  const setMonth = (offset: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + offset);
    setStartDate(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10));
    setEndDate(new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10));
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">VAT Return</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Output VAT summary for KRA monthly filing (VAT3 form)
          </p>
        </div>
        <Button onClick={handleExport} disabled={!report}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      {/* Period selector */}
      <div className="flex items-end gap-3 border border-border rounded-lg p-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </div>
        <div className="flex gap-1.5 ml-auto">
          <Button variant="outline" size="sm" onClick={() => setMonth(0)}>This Month</Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(-1)}>Last Month</Button>
        </div>
      </div>

      {/* Compliance warning */}
      {report && report.pending_count > 0 && (
        <div className="border border-amber-500/50 bg-amber-500/5 rounded-lg p-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">{report.pending_count} invoice(s) not yet signed by KRA</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Visit <a href="/etims" className="text-primary underline">eTIMS Submissions</a> to retry pending invoices before filing.
            </p>
          </div>
        </div>
      )}

      {/* VAT Statement */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="bg-muted/30 border-b border-border px-5 py-3">
          <h2 className="font-semibold">VAT Return Statement</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{startDate} to {endDate}</p>
        </div>
        <div className="p-5 space-y-4">
          <Section title="Sales">
            <Row label="Total Sales (incl. VAT)" value={report?.total_sales ?? 0} bold />
            <Row label="Standard-rated Sales (16% VAT)" value={report?.taxable_sales ?? 0} indent />
            <Row label="Exempt / Zero-rated Sales" value={report?.exempt_sales ?? 0} indent />
          </Section>

          <div className="border-t border-border" />

          <Section title="Output VAT">
            <Row label="Output VAT (16%)" value={report?.output_vat ?? 0} bold highlight />
          </Section>

          <div className="border-t border-border" />

          <Section title="Invoice Status">
            <Row label="Total Invoices Issued" value={report?.invoice_count ?? 0} count />
            <Row label="Signed by KRA" value={report?.signed_count ?? 0} count indent />
            <Row label="Pending / Failed" value={report?.pending_count ?? 0} count indent danger={(report?.pending_count ?? 0) > 0} />
          </Section>

          <div className="border-t border-border pt-4 mt-4">
            <div className="flex items-start gap-3 text-xs text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                File this return on <a href="https://itax.kra.go.ke" target="_blank" rel="noopener noreferrer" className="text-primary underline">iTax</a> by the 20th of the following month.
                Use these figures to populate VAT3 form: General Rate (16%) sales and Output VAT.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({
  label, value, bold = false, indent = false, highlight = false, count = false, danger = false,
}: {
  label: string; value: number; bold?: boolean; indent?: boolean; highlight?: boolean; count?: boolean; danger?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center ${indent ? "pl-4" : ""}`}>
      <span className={`text-sm ${bold ? "font-medium" : ""} ${danger ? "text-amber-700" : ""}`}>{label}</span>
      <span className={`font-mono ${bold ? "text-base font-semibold" : "text-sm"} ${highlight ? "text-primary" : ""} ${danger ? "text-amber-700" : ""}`}>
        {count ? value.toLocaleString() : money(value)}
      </span>
    </div>
  );
}
