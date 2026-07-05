/**
 * Hardware Quotation detail — /hardware/quotations/:id
 *
 * Line items, customer info, salesperson, running total. Actions to
 * mark accepted, send for POS checkout, or cancel.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileText, PaperPlaneTilt as Send, CheckCircle, XCircle } from "@phosphor-icons/react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { query, execute } from "@/lib/db";
import { money as KES } from "@/lib/money";
import { intlLocale } from "@/lib/intl";
import { useCartStore } from "@/stores/cart";
import { prepareQuoteForPosCheckout } from "@/services/hardware";
import { confirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";

interface Quote {
  id: string;
  quotation_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  status: string;
  issue_date: string;
  valid_until: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  salesperson_id: string | null;
  salesperson_name: string | null;
  converted_sale_id: string | null;
  created_at: string;
}

interface QuoteItem {
  id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  tax_rate: number;
  discount_amount: number;
  line_total: number;
}

import { QUOTE_STATUS_STYLE as STATUS_CLASSES } from "@/lib/hardware-status";

export function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const loadSnapshot = useCartStore((s) => s.loadSnapshot);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [q, its] = await Promise.all([
        query<Quote>(
          `SELECT q.*, e.full_name AS salesperson_name
           FROM quotations q
           LEFT JOIN employees e ON e.id = q.salesperson_id
           WHERE q.id = ?1`,
          [id],
        ),
        query<QuoteItem>(
          `SELECT id, product_id, description, quantity, unit, unit_price, tax_rate, discount_amount, line_total
           FROM quotation_items WHERE quotation_id = ?1 ORDER BY sort_order`,
          [id],
        ),
      ]);
      setQuote(q[0] ?? null);
      setItems(its);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [id]);

  const setStatus = async (next: string) => {
    if (!quote) return;
    if (next === "cancelled" && !(await confirm({ title: "Cancel this quote?" }))) return;
    await execute(`UPDATE quotations SET status = ?2 WHERE id = ?1`, [quote.id, next]);
    toast.success(`Quote ${next}`);
    load();
  };

  const [printing, setPrinting] = useState(false);
  const [savingAsInvoice, setSavingAsInvoice] = useState(false);

  const handlePrint = async () => {
    if (!quote) return;
    setPrinting(true);
    try {
      const { generateQuotationPdf } = await import("@/services/invoice-pdf");
      // Adapt our DB shape into the invoicing service shape.
      const q = {
        id: quote.id,
        quotation_number: quote.quotation_number,
        customer_id: quote.customer_id,
        customer_name: quote.customer_name,
        customer_phone: quote.customer_phone,
        customer_email: null,
        customer_address: null,
        customer_tax_pin: null,
        issue_date: quote.issue_date,
        valid_until: quote.valid_until,
        status: quote.status as "draft" | "sent" | "accepted" | "declined" | "expired" | "converted",
        subtotal: quote.subtotal,
        discount_amount: quote.discount_amount,
        tax_amount: quote.tax_amount,
        total: quote.total,
        converted_to_invoice_id: null,
        notes: quote.notes,
        terms: null,
        user_id: "",
        branch_id: null,
        created_at: quote.created_at,
      };
      const documentItems = items.map((it, idx) => ({
        id: it.id,
        product_id: it.product_id,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit ?? "pcs",
        unit_price: it.unit_price,
        tax_rate: it.tax_rate,
        discount_amount: it.discount_amount,
        line_total: it.line_total,
        sort_order: idx,
      }));
      const pdf = await generateQuotationPdf(q, documentItems);
      // jsPDF's pdf.save() relies on a <a download> that silently no-ops in
      // the Tauri WebView. Route the bytes through the app's standard
      // downloadBytes (used by every other PDF export) which reliably
      // triggers the save.
      const buf = pdf.output("arraybuffer") as ArrayBuffer;
      const { downloadBytes } = await import("@/services/pdf-brand");
      downloadBytes(new Uint8Array(buf), `${quote.quotation_number}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setPrinting(false);
    }
  };

  const handleSaveAsInvoice = async () => {
    if (!quote) return;
    setSavingAsInvoice(true);
    try {
      const { convertQuotationToInvoice } = await import("@/services/invoicing");
      const { useAuthStore } = await import("@/stores/auth");
      const userId = useAuthStore.getState().user?.id ?? "";
      // Default due date = 30 days from today.
      const due = new Date();
      due.setDate(due.getDate() + 30);
      const invoiceId = await convertQuotationToInvoice(quote.id, due.toISOString().slice(0, 10), userId);
      toast.success("Invoice created — payment due in 30 days");
      navigate(`/invoices/${invoiceId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingAsInvoice(false);
    }
  };

  const handleAmend = async () => {
    if (!quote) return;
    try {
      const { duplicateQuotation } = await import("@/services/hardware");
      const newId = await duplicateQuotation(quote.id);
      toast.success("Amended quote created — edit + send when ready");
      navigate(`/hardware/quotations/${newId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const checkoutInPos = async () => {
    if (!quote) return;
    setCheckingOut(true);
    try {
      const payload = await prepareQuoteForPosCheckout(quote.id);
      const label = payload.quote.customer_name
        ? `${payload.quote.quotation_number} — ${payload.quote.customer_name}`
        : payload.quote.quotation_number;
      loadSnapshot(payload.items, payload.quote.discount, payload.quote.customer_id, {
        source: { type: "hardware_quote", id: payload.quote.id, label },
      });
      toast.success(`Quote loaded in POS`);
      navigate("/pos/sale");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setCheckingOut(false);
    }
  };

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!quote) return <p className="p-6 text-sm text-muted-foreground">Quotation not found.</p>;

  const disabled = quote.status === "converted" || quote.status === "cancelled";

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ fallback: "/hardware?tab=quotations" }}
        eyebrow="Hardware quotation"
        title={quote.quotation_number}
        description={quote.customer_name}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-xs ${STATUS_CLASSES[quote.status] || ""}`}>
              {quote.status}
            </Badge>
            {!disabled && (
              <>
                {quote.status === "draft" && (
                  <Button size="sm" variant="outline" onClick={() => setStatus("sent")}>
                    <Send className="h-3.5 w-3.5 mr-1" /> Mark sent
                  </Button>
                )}
                {(quote.status === "draft" || quote.status === "sent") && (
                  <Button size="sm" variant="outline" onClick={() => setStatus("accepted")}>
                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Mark accepted
                  </Button>
                )}
                <Button size="sm" onClick={checkoutInPos} disabled={checkingOut}>
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  {checkingOut ? "Loading…" : "Check out in POS"}
                </Button>
                <Button size="sm" variant="outline" onClick={handlePrint} disabled={printing}>
                  {printing ? "…" : "Print"}
                </Button>
                {(quote.status === "accepted" || quote.status === "sent") ? (
                  <Button size="sm" variant="outline" onClick={handleSaveAsInvoice} disabled={savingAsInvoice}>
                    {savingAsInvoice ? "…" : "Save as invoice"}
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={handleAmend}>
                  Amend
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setStatus("cancelled")} className="text-rose-600">
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Meta */}
      <div className="grid grid-cols-4 gap-3 text-sm">
        <MetaField label="Customer" value={quote.customer_name} />
        <MetaField label="Phone" value={quote.customer_phone ?? "—"} />
        <MetaField
          label="Salesperson"
          value={quote.salesperson_name ?? "—"}
        />
        <MetaField
          label="Valid until"
          value={quote.valid_until ? new Date(quote.valid_until).toLocaleDateString(intlLocale(), { dateStyle: "medium" }) : "—"}
        />
      </div>

      {/* Items */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              <th className="text-left px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Item</th>
              <th className="text-right px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Qty</th>
              <th className="text-right px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Unit</th>
              <th className="text-right px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Discount</th>
              <th className="text-right px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Line total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b border-border/60">
                <td className="px-4 py-2">{it.description}</td>
                <td className="px-4 py-2 text-right font-mono">
                  {it.quantity} {it.unit ?? "pcs"}
                </td>
                <td className="px-4 py-2 text-right font-mono">{KES(it.unit_price)}</td>
                <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                  {it.discount_amount > 0 ? `−${KES(it.discount_amount)}` : "—"}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">{KES(it.line_total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/20">
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right text-muted-foreground">Subtotal</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">{KES(quote.subtotal)}</td>
            </tr>
            {quote.discount_amount > 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-2 text-right text-muted-foreground">Discount</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">−{KES(quote.discount_amount)}</td>
              </tr>
            )}
            {quote.tax_amount > 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-2 text-right text-muted-foreground">Tax</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">{KES(quote.tax_amount)}</td>
              </tr>
            )}
            <tr className="font-semibold">
              <td colSpan={4} className="px-4 py-2 text-right">Total</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">{KES(quote.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {quote.notes && (
        <section>
          <h2 className="text-[13px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Notes</h2>
          <p className="text-sm whitespace-pre-wrap rounded-lg border border-border p-3">{quote.notes}</p>
        </section>
      )}
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
