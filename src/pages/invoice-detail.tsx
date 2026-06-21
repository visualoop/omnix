import { useEffect, useState } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowsClockwise as RefreshCw,
  Check,
  CircleNotch as Loader2,
  CurrencyDollar as DollarSign,
  Download,
  Eye,
  FileText,
  PaperPlaneTilt as Send,
  Printer as Printer,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { printPage } from "@/lib/print";
import {
  getInvoice, getQuotation, markInvoiceSent, recordInvoicePayment, cancelInvoice,
  updateQuotationStatus, convertQuotationToInvoice,
  type Invoice, type Quotation, type DocumentItem, type InvoiceStatus, type QuotationStatus,
} from "@/services/invoicing";
import {
  downloadInvoicePdf, downloadQuotationPdf, previewInvoicePdf, previewQuotationPdf,
} from "@/services/invoice-pdf";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { money as KES } from "@/lib/money";
import { intlLocale } from "@/lib/intl";

const formatDate = (s: string) => new Date(s).toLocaleDateString(intlLocale(), { day: "2-digit", month: "long", year: "numeric" });

interface Props { type: "invoice" | "quotation" }

export function DocumentDetailPage({ type }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);
  const [data, setData] = useState<{
    invoice?: Invoice;
    quotation?: Quotation;
    items: DocumentItem[];
    payments?: any[];
  } | null>(null);
  const [working, setWorking] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showConvert, setShowConvert] = useState(false);

  const load = async () => {
    if (!id) return;
    if (type === "invoice") {
      const result = await getInvoice(id);
      if (result) setData({ invoice: result.invoice, items: result.items, payments: result.payments });
    } else {
      const result = await getQuotation(id);
      if (result) setData({ quotation: result.quotation, items: result.items });
    }
  };
  useEffect(() => { load(); }, [id]);

  if (!data) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const doc = data.invoice || data.quotation!;
  const isInvoice = !!data.invoice;
  const number = isInvoice ? data.invoice!.invoice_number : data.quotation!.quotation_number;

  const send = async () => {
    if (!doc) return;
    setWorking(true);
    try {
      if (isInvoice) await markInvoiceSent(doc.id);
      else await updateQuotationStatus(doc.id, "sent");
      toast.success("Marked as sent");
      load();
    } catch (e) { toast.error(String(e)); }
    finally { setWorking(false); }
  };

  const updateQt = async (status: QuotationStatus) => {
    if (!data.quotation) return;
    setWorking(true);
    try {
      await updateQuotationStatus(data.quotation.id, status);
      toast.success("Status updated");
      load();
    } finally { setWorking(false); }
  };

  const cancelInv = async () => {
    if (!data.invoice) return;
    if (!(await confirm({
      title: "Cancel this invoice?",
      description: "This is generally for invoicing errors. The invoice will be marked as cancelled but will remain on record.",
      variant: "destructive",
      confirmText: "Cancel Invoice",
      cancelText: "Keep",
    }))) return;
    setWorking(true);
    try {
      await cancelInvoice(data.invoice.id);
      toast.success("Cancelled");
      load();
    } finally { setWorking(false); }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/invoicing")} className="mb-2 -ml-2">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Invoicing
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> {number}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Created {formatDate(doc.created_at.slice(0, 10))}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {isInvoice && <InvoiceBadge status={data.invoice!.status} />}
            {!isInvoice && <QuotationBadge status={data.quotation!.status} />}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex gap-2 flex-wrap">
        {isInvoice ? (
          <>
            {data.invoice!.status === "draft" && (
              <Button variant="outline" onClick={send} disabled={working}>
                <Send className="h-3.5 w-3.5 mr-1.5" /> Mark as Sent
              </Button>
            )}
            {(data.invoice!.status === "sent" || data.invoice!.status === "partial" || data.invoice!.status === "overdue") && (
              <Button onClick={() => setShowPayment(true)}>
                <DollarSign className="h-3.5 w-3.5 mr-1.5" /> Record Payment
              </Button>
            )}
            {data.invoice!.status !== "cancelled" && data.invoice!.status !== "paid" && (
              <Button variant="ghost" onClick={cancelInv} disabled={working}>
                <X className="h-3.5 w-3.5 mr-1.5" /> Cancel Invoice
              </Button>
            )}
          </>
        ) : (
          <>
            {data.quotation!.status === "draft" && (
              <Button variant="outline" onClick={send}><Send className="h-3.5 w-3.5 mr-1.5" /> Mark as Sent</Button>
            )}
            {data.quotation!.status === "sent" && (
              <>
                <Button variant="outline" onClick={() => updateQt("accepted")}>
                  <Check className="h-3.5 w-3.5 mr-1.5" /> Accept
                </Button>
                <Button variant="ghost" onClick={() => updateQt("declined")}>
                  <X className="h-3.5 w-3.5 mr-1.5" /> Decline
                </Button>
              </>
            )}
            {data.quotation!.status === "accepted" && !data.quotation!.converted_to_invoice_id && (
              <Button onClick={() => setShowConvert(true)}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Convert to Invoice
              </Button>
            )}
            {data.quotation!.converted_to_invoice_id && (
              <Button variant="outline" onClick={() => navigate(`/invoicing/invoice/${data.quotation!.converted_to_invoice_id}`)}>
                View Linked Invoice →
              </Button>
            )}
          </>
        )}
        <Button variant="outline" onClick={async () => {
          if (isInvoice) await previewInvoicePdf(data.invoice!, data.items, data.payments);
          else await previewQuotationPdf(data.quotation!, data.items);
        }}>
          <Eye className="h-3.5 w-3.5 mr-1.5" /> Preview PDF
        </Button>
        <Button variant="outline" onClick={async () => {
          if (isInvoice) await downloadInvoicePdf(data.invoice!, data.items, data.payments);
          else await downloadQuotationPdf(data.quotation!, data.items);
        }}>
          <Download className="h-3.5 w-3.5 mr-1.5" /> Download PDF
        </Button>
        <Button variant="outline" onClick={() => printPage(`${isInvoice ? "Invoice" : "Quotation"} ${number}`)}>
          <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
        </Button>
      </div>

      {/* Document body */}
      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-6 space-y-5">
          {/* Header */}
          <div className="flex justify-between border-b border-border pb-4">
            <div>
              <h2 className="text-2xl font-semibold uppercase tracking-tight">
                {isInvoice ? "INVOICE" : "QUOTATION"}
              </h2>
              <div className="font-mono text-sm mt-1">{number}</div>
            </div>
            <div className="text-right text-xs">
              <div className="text-muted-foreground uppercase tracking-wider text-[10px]">Issue Date</div>
              <div className="font-medium">{formatDate(doc.issue_date)}</div>
              <div className="text-muted-foreground uppercase tracking-wider text-[10px] mt-2">
                {isInvoice ? "Due Date" : "Valid Until"}
              </div>
              <div className="font-medium">
                {formatDate(isInvoice ? data.invoice!.due_date : data.quotation!.valid_until)}
              </div>
            </div>
          </div>

          {/* Bill to */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              {isInvoice ? "Bill To" : "Quotation For"}
            </div>
            <div className="font-medium">{doc.customer_name}</div>
            {doc.customer_address && <div className="text-xs whitespace-pre-line">{doc.customer_address}</div>}
            {doc.customer_phone && <div className="text-xs">{doc.customer_phone}</div>}
            {doc.customer_email && <div className="text-xs">{doc.customer_email}</div>}
            {isInvoice && data.invoice!.customer_tax_pin && (
              <div className="text-xs font-mono">KRA PIN: {data.invoice!.customer_tax_pin}</div>
            )}
          </div>

          {/* Line items */}
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b-2 border-foreground">
              <tr>
                <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider">Description</th>
                <th className="text-right px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider w-16">Qty</th>
                <th className="text-right px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider w-20">Unit</th>
                <th className="text-right px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider w-24">Rate</th>
                <th className="text-right px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider w-16">Tax</th>
                <th className="text-right px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider w-28">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it) => (
                <tr key={it.id} className="border-b border-border/60">
                  <td className="px-2 py-1.5 text-xs">{it.description}</td>
                  <td className="px-2 py-1.5 text-right text-xs tabular-nums font-mono">{it.quantity}</td>
                  <td className="px-2 py-1.5 text-right text-xs text-muted-foreground">{it.unit}</td>
                  <td className="px-2 py-1.5 text-right text-xs tabular-nums font-mono">{it.unit_price.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right text-xs tabular-nums">{it.tax_rate}%</td>
                  <td className="px-2 py-1.5 text-right text-xs tabular-nums font-mono">{it.line_total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-72 text-sm space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono tabular-nums">{doc.subtotal.toFixed(2)}</span>
              </div>
              {doc.tax_amount > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-mono tabular-nums">{doc.tax_amount.toFixed(2)}</span>
                </div>
              )}
              {doc.discount_amount > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-mono tabular-nums">-{doc.discount_amount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold border-t-2 border-foreground pt-1.5">
                <span>TOTAL</span>
                <span className="font-mono tabular-nums">{KES(doc.total)}</span>
              </div>
              {isInvoice && data.invoice!.amount_paid > 0 && (
                <>
                  <div className="flex justify-between text-xs text-emerald-700">
                    <span>Paid</span>
                    <span className="font-mono tabular-nums">{KES(data.invoice!.amount_paid)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Balance Due</span>
                    <span className="font-mono tabular-nums">{KES(data.invoice!.total - data.invoice!.amount_paid)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes & terms */}
          {(doc.notes || doc.terms) && (
            <div className="border-t border-border pt-4 space-y-3 text-xs">
              {doc.notes && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Notes</div>
                  <div className="whitespace-pre-line">{doc.notes}</div>
                </div>
              )}
              {doc.terms && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Terms & Conditions</div>
                  <div className="whitespace-pre-line">{doc.terms}</div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment history */}
      {isInvoice && data.payments && data.payments.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-3">Payment History</h3>
            <table className="w-full text-xs">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left px-1 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="text-left px-1 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Method</th>
                  <th className="text-left px-1 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Reference</th>
                  <th className="text-right px-1 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="px-1 py-1.5">{formatDate(p.payment_date)}</td>
                    <td className="px-1 py-1.5 capitalize">{p.payment_method}</td>
                    <td className="px-1 py-1.5 font-mono">{p.reference || "—"}</td>
                    <td className="px-1 py-1.5 text-right font-mono tabular-nums">{KES(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <PaymentDialog
        open={showPayment}
        onClose={() => setShowPayment(false)}
        onSaved={() => { setShowPayment(false); load(); }}
        invoice={data.invoice}
        userId={userId}
      />

      <ConvertDialog
        open={showConvert}
        onClose={() => setShowConvert(false)}
        onConverted={(invId) => navigate(`/invoicing/invoice/${invId}`)}
        quotation={data.quotation}
        userId={userId}
      />
    </div>
  );
}

function PaymentDialog({ open, onClose, onSaved, invoice, userId }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  invoice?: Invoice;
  userId?: string;
}) {
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && invoice) {
      setAmount(invoice.total - invoice.amount_paid);
      setMethod("cash");
      setReference("");
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [open, invoice]);

  if (!invoice || !userId) return null;
  const balance = invoice.total - invoice.amount_paid;

  const save = async () => {
    if (amount <= 0 || amount > balance + 0.01) {
      toast.error(`Amount must be between 0.01 and ${balance.toFixed(2)}`);
      return;
    }
    setSubmitting(true);
    try {
      await recordInvoicePayment({
        invoice_id: invoice.id,
        amount,
        payment_method: method,
        reference: reference || undefined,
        payment_date: date,
        user_id: userId,
      });
      toast.success("Payment recorded");
      onSaved();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="text-xs bg-muted/30 rounded p-2">
            Outstanding balance: <b className="font-mono">{KES(balance)}</b>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Amount *</label>
            <Input type="number" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Method *</label>
              <Select value={method} onValueChange={(v) => setMethod(v as string)}>
                <SelectTrigger className="w-full h-8 text-[13px]">
                  <SelectValue placeholder="Pick a method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Reference</label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="M-Pesa code, cheque #, transfer ID..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={submitting}>
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConvertDialog({ open, onClose, onConverted, quotation, userId }: {
  open: boolean;
  onClose: () => void;
  onConverted: (invoiceId: string) => void;
  quotation?: Quotation;
  userId?: string;
}) {
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [submitting, setSubmitting] = useState(false);

  if (!quotation || !userId) return null;

  const convert = async () => {
    setSubmitting(true);
    try {
      const invId = await convertQuotationToInvoice(quotation.id, dueDate, userId);
      toast.success("Converted to invoice");
      onConverted(invId);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert to Invoice</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-xs text-muted-foreground">
            All line items, customer details, and totals from this quotation will be copied to a new invoice.
          </p>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Invoice Due Date</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={convert} disabled={submitting}>
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Convert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceBadge({ status }: { status: InvoiceStatus }) {
  switch (status) {
    case "draft": return <Badge variant="outline">Draft</Badge>;
    case "sent": return <Badge className="bg-blue-600 hover:bg-blue-600">Sent</Badge>;
    case "partial": return <Badge className="bg-amber-500 hover:bg-amber-500">Partial</Badge>;
    case "paid": return <Badge className="bg-emerald-600 hover:bg-emerald-600">Paid</Badge>;
    case "overdue": return <Badge variant="destructive">Overdue</Badge>;
    case "cancelled": return <Badge variant="outline" className="opacity-60">Cancelled</Badge>;
  }
}

function QuotationBadge({ status }: { status: QuotationStatus }) {
  switch (status) {
    case "draft": return <Badge variant="outline">Draft</Badge>;
    case "sent": return <Badge className="bg-blue-600 hover:bg-blue-600">Sent</Badge>;
    case "accepted": return <Badge className="bg-emerald-600 hover:bg-emerald-600">Accepted</Badge>;
    case "declined": return <Badge variant="destructive">Declined</Badge>;
    case "expired": return <Badge variant="outline" className="opacity-60">Expired</Badge>;
    case "converted": return <Badge className="bg-purple-600 hover:bg-purple-600">Converted</Badge>;
  }
}
