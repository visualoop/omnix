import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Plus, Search, AlertCircle, DollarSign, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsPanel } from "@/components/ui/tabs";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import {
  listInvoices, listQuotations, getAgedReceivables,
  type Invoice, type Quotation, type InvoiceStatus, type QuotationStatus,
  type AgedReceivable,
} from "@/services/invoicing";
import { useActiveBranch } from "@/stores/active-branch";
import { money as KES } from "@/lib/money";


export function InvoicingPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"invoices" | "quotations" | "aged">("invoices");
  const branchId = useActiveBranch((s) => s.active?.id);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Invoicing
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quotations, B2B invoices, and aged receivables.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/invoicing/recurring")}>
            <Repeat className="h-4 w-4 mr-1.5" /> Recurring
          </Button>
          <Button variant="outline" onClick={() => navigate("/invoicing/quotation/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> New Quotation
          </Button>
          <Button onClick={() => navigate("/invoicing/invoice/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> New Invoice
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="quotations">Quotations</TabsTrigger>
          <TabsTrigger value="aged">Aged Receivables</TabsTrigger>
        </TabsList>

        <TabsPanel value="invoices" className="mt-3">
          <InvoiceList branchId={branchId} />
        </TabsPanel>

        <TabsPanel value="quotations" className="mt-3">
          <QuotationList />
        </TabsPanel>

        <TabsPanel value="aged" className="mt-3">
          <AgedReceivablesView />
        </TabsPanel>
      </Tabs>
    </div>
  );
}

function InvoiceList({ branchId }: { branchId?: string }) {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "">("");

  const load = async () => {
    setLoading(true);
    try {
      setInvoices(await listInvoices({ status: statusFilter || undefined, branchId }));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [statusFilter, branchId]);

  const filtered = invoices.filter((i) =>
    !search ||
    i.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    i.customer_name.toLowerCase().includes(search.toLowerCase()),
  );

  const totalUnpaid = invoices.filter((i) => i.status !== "paid" && i.status !== "cancelled")
    .reduce((s, i) => s + (i.total - i.amount_paid), 0);
  const totalPaid = invoices.filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amount_paid, 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total invoiced" value={KES(invoices.reduce((s, i) => s + i.total, 0))} />
        <Stat label="Outstanding" value={KES(totalUnpaid)} color="text-amber-600" />
        <Stat label="Collected" value={KES(totalPaid)} color="text-emerald-600" />
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice or customer..." className="pl-8" />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | "")}
          className="h-8 rounded-md border border-input bg-background px-2 text-[13px]"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Number</th>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Customer</th>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Issued</th>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Due</th>
              <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
              <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Outstanding</th>
              <th className="text-center px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableRowSkeleton cells={7} rows={3} />
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-0">
                <EmptyState
                  icon={FileText}
                  title="No invoices yet"
                  description="Create an invoice for B2B sales or recurring billing."
                  cta={{ label: "New Invoice", onClick: () => navigate("/invoicing/invoice/new"), icon: Plus }}
                />
              </td></tr>
            ) : (
              filtered.map((i) => (
                <tr key={i.id} className="border-b border-border/60 hover:bg-accent/30 cursor-pointer"
                  onClick={() => navigate(`/invoicing/invoice/${i.id}`)}
                >
                  <td className="px-3 py-2 font-mono text-xs">{i.invoice_number}</td>
                  <td className="px-3 py-2 text-xs">{i.customer_name}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(i.issue_date)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatDate(i.due_date)}
                    {i.status === "overdue" && <Badge variant="destructive" className="ml-1 text-[9px]">Overdue</Badge>}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-mono tabular-nums">{KES(i.total)}</td>
                  <td className="px-3 py-2 text-right text-xs font-mono tabular-nums">
                    {i.total - i.amount_paid > 0 ? KES(i.total - i.amount_paid) : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <InvoiceStatusBadge status={i.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuotationList() {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setQuotations(await listQuotations()); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 border-b border-border">
          <tr>
            <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Number</th>
            <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Customer</th>
            <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Issued</th>
            <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Valid Until</th>
            <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
            <th className="text-center px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <TableRowSkeleton cells={6} rows={3} />
          ) : quotations.length === 0 ? (
            <tr><td colSpan={6} className="p-0">
              <EmptyState
                icon={FileText}
                title="No quotations yet"
                description="Send quotations to potential customers; convert accepted ones to invoices."
                cta={{ label: "New Quotation", onClick: () => navigate("/invoicing/quotation/new"), icon: Plus }}
              />
            </td></tr>
          ) : (
            quotations.map((q) => (
              <tr key={q.id} className="border-b border-border/60 hover:bg-accent/30 cursor-pointer"
                onClick={() => navigate(`/invoicing/quotation/${q.id}`)}
              >
                <td className="px-3 py-2 font-mono text-xs">{q.quotation_number}</td>
                <td className="px-3 py-2 text-xs">{q.customer_name}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(q.issue_date)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(q.valid_until)}</td>
                <td className="px-3 py-2 text-right text-xs font-mono tabular-nums">{KES(q.total)}</td>
                <td className="px-3 py-2 text-center">
                  <QuotationStatusBadge status={q.status} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function AgedReceivablesView() {
  const [data, setData] = useState<AgedReceivable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAgedReceivables().then(setData).finally(() => setLoading(false));
  }, []);

  const totals = data.reduce((acc, r) => ({
    current: acc.current + r.current,
    days_30: acc.days_30 + r.days_30,
    days_60: acc.days_60 + r.days_60,
    days_90: acc.days_90 + r.days_90,
    total: acc.total + r.total,
  }), { current: 0, days_30: 0, days_60: 0, days_90: 0, total: 0 });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-2">
        <Stat label="Current" value={KES(totals.current)} color="text-emerald-600" />
        <Stat label="31-60 days" value={KES(totals.days_30)} color="text-amber-600" />
        <Stat label="61-90 days" value={KES(totals.days_60)} color="text-orange-600" />
        <Stat label="90+ days" value={KES(totals.days_90)} color="text-red-600" />
        <Stat label="Total Outstanding" value={KES(totals.total)} highlight />
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Customer</th>
              <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Current</th>
              <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">31-60</th>
              <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">61-90</th>
              <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">90+</th>
              <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableRowSkeleton cells={6} rows={3} />
            ) : data.length === 0 ? (
              <tr><td colSpan={6} className="p-0">
                <EmptyState
                  icon={DollarSign}
                  title="No outstanding receivables"
                  description="All your invoices are paid up. Nice work."
                />
              </td></tr>
            ) : (
              data.map((r) => (
                <tr key={r.customer_id || r.customer_name} className="border-b border-border/60">
                  <td className="px-3 py-2 text-xs font-medium">{r.customer_name}</td>
                  <td className="px-3 py-2 text-right text-xs font-mono tabular-nums">{r.current > 0 ? KES(r.current) : "—"}</td>
                  <td className="px-3 py-2 text-right text-xs font-mono tabular-nums text-amber-600">{r.days_30 > 0 ? KES(r.days_30) : "—"}</td>
                  <td className="px-3 py-2 text-right text-xs font-mono tabular-nums text-orange-600">{r.days_60 > 0 ? KES(r.days_60) : "—"}</td>
                  <td className="px-3 py-2 text-right text-xs font-mono tabular-nums text-red-600">{r.days_90 > 0 ? KES(r.days_90) : "—"}</td>
                  <td className="px-3 py-2 text-right text-xs font-mono tabular-nums font-semibold">{KES(r.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totals.days_90 > 0 && (
        <div className="text-xs text-red-600 flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5" />
          {KES(totals.days_90)} is over 90 days overdue. Consider follow-up or write-off.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color, highlight }: { label: string; value: string; color?: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary" : ""}>
      <CardContent className="p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-base font-semibold font-mono mt-1 ${color || ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  switch (status) {
    case "draft": return <Badge variant="outline">Draft</Badge>;
    case "sent": return <Badge className="bg-blue-600 hover:bg-blue-600">Sent</Badge>;
    case "partial": return <Badge className="bg-amber-500 hover:bg-amber-500">Partial</Badge>;
    case "paid": return <Badge className="bg-emerald-600 hover:bg-emerald-600">Paid</Badge>;
    case "overdue": return <Badge variant="destructive">Overdue</Badge>;
    case "cancelled": return <Badge variant="outline" className="opacity-60">Cancelled</Badge>;
  }
}

function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  switch (status) {
    case "draft": return <Badge variant="outline">Draft</Badge>;
    case "sent": return <Badge className="bg-blue-600 hover:bg-blue-600">Sent</Badge>;
    case "accepted": return <Badge className="bg-emerald-600 hover:bg-emerald-600">Accepted</Badge>;
    case "declined": return <Badge variant="destructive">Declined</Badge>;
    case "expired": return <Badge variant="outline" className="opacity-60">Expired</Badge>;
    case "converted": return <Badge className="bg-purple-600 hover:bg-purple-600">→ Invoice</Badge>;
  }
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
}
