import { MobileRouteContext } from "@/components/shared/mobile-route-context";
import { useState, useEffect } from "react";
import {
  Download,
  FileXls as FileSpreadsheet,
  Warning as AlertTriangle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/date-range-picker";
import { getVatReport } from "@/services/etims";
import { exportToCSV } from "@/lib/export";
import { renderVat3Pdf } from "@/services/reports-pdf";
import { loadBrandHeader, downloadBytes } from "@/services/pdf-brand";
import { money } from "@/lib/money";
import { taxLabel } from "@/lib/locale";
import { useCountry } from "@/stores/country";

import { BackButton } from "@/components/ui/back-button";
function VatReportPageContent() {
  const countryCode = useCountry((state) => state.code);
  const countryProfile = useCountry((state) => state.profile());
  const activeTaxLabel = taxLabel(countryCode);
  const standardRate = countryProfile?.defaultTaxRate ?? 0;
  const supportsKenyaVat3 = countryCode === "KE";
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
      taxable_sales_standard_rate: report.taxable_sales,
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <BackButton fallback="/reports" />
          <h1 className="text-xl font-semibold tracking-tight">{activeTaxLabel} Return</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {supportsKenyaVat3 ? "Output VAT summary for KRA monthly filing (VAT3 form)" : `Output ${activeTaxLabel} summary for the selected period`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {supportsKenyaVat3 && (
            <Button
              onClick={async () => {
                if (!report) return;
                const brand = await loadBrandHeader();
                const bytes = renderVat3Pdf({ brand, startDate, endDate, salesNet: report.taxable_sales, outputVat: report.output_vat, purchasesNet: 0, inputVat: 0 });
                downloadBytes(bytes, `vat3-${startDate}-to-${endDate}`);
              }}
              disabled={!report}
            >
              <Download className="h-4 w-4 mr-2" /> VAT3 PDF
            </Button>
          )}
          <Button variant="outline" onClick={handleExport} disabled={!report}>
            CSV
          </Button>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex flex-col items-stretch gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center">
        <DateRangePicker
          value={{ start: startDate, end: endDate }}
          onChange={(r) => { setStartDate(r.start); setEndDate(r.end); }}
        />
        <div className="flex flex-wrap gap-1.5 sm:ml-auto">
          <Button variant="outline" size="sm" onClick={() => setMonth(0)}>This Month</Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(-1)}>Last Month</Button>
        </div>
      </div>

      {/* Compliance warning */}
      {supportsKenyaVat3 && report && report.pending_count > 0 && (
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
          <h2 className="font-semibold">{activeTaxLabel} Return Statement</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{startDate} to {endDate}</p>
        </div>
        <div className="p-5 space-y-4">
          <Section title="Sales">
            <Row label={`Total Sales (incl. ${activeTaxLabel})`} value={report?.total_sales ?? 0} bold />
            <Row label={`Standard-rated Sales (${standardRate}% ${activeTaxLabel})`} value={report?.taxable_sales ?? 0} indent />
            <Row label="Exempt / Zero-rated Sales" value={report?.exempt_sales ?? 0} indent />
          </Section>

          <div className="border-t border-border" />

          <Section title={`Output ${activeTaxLabel}`}>
            <Row label={`Output ${activeTaxLabel} (${standardRate}%)`} value={report?.output_vat ?? 0} bold highlight />
          </Section>

          <div className="border-t border-border" />

          <Section title="Invoice Status">
            <Row label="Total Invoices Issued" value={report?.invoice_count ?? 0} count />
            <Row label={supportsKenyaVat3 ? "Signed by KRA" : "Accepted by tax service"} value={report?.signed_count ?? 0} count indent />
            <Row label="Pending / Failed" value={report?.pending_count ?? 0} count indent danger={(report?.pending_count ?? 0) > 0} />
          </Section>

          <div className="border-t border-border pt-4 mt-4">
            <div className="flex items-start gap-3 text-xs text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                {supportsKenyaVat3 ? (
                  <>File this return on <a href="https://itax.kra.go.ke" target="_blank" rel="noopener noreferrer" className="text-primary underline">iTax</a> by the 20th of the following month. Use these figures for the VAT3 general-rate section.</>
                ) : (
                  <>Use these standard-rate and output {activeTaxLabel} figures with the filing process required by your local tax authority.</>
                )}
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

export function VatReportPage() {
  return (
    <>
      <MobileRouteContext />
      <VatReportPageContent />
    </>
  );
}
