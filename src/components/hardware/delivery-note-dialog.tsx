/**
 * DeliveryNoteDialog — generate a delivery note FROM an accepted quotation
 * (industry-standard hardware flow: quote → accepted → deliver goods).
 *
 * Step 1: pick a sent/accepted quotation.
 * Step 2: its line items pre-fill as delivery lines (real products +
 *         quantities). The user can reduce quantities for a partial
 *         delivery and confirm the delivery address (pre-filled from the
 *         customer on the quote). Creating the note links it back to the
 *         quote via source_quotation_id.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { MagnifyingGlass as Search, FileText, ArrowLeft } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  listDeliverableQuotations, getQuotationForDelivery, createDeliveryNoteFromQuotation,
  type DeliverableQuotation,
} from "@/services/hardware";
import { money as KES } from "@/lib/money";
import { intlLocale } from "@/lib/intl";

interface DeliverLine { product_id: string | null; name: string; uom: string; quantity: number; max: number; }

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function DeliveryNoteDialog({ open, onClose, onCreated }: Props) {
  const [quotes, setQuotes] = useState<DeliverableQuotation[]>([]);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<DeliverableQuotation | null>(null);
  const [quoteNumber, setQuoteNumber] = useState("");
  const [address, setAddress] = useState("");
  const [lines, setLines] = useState<DeliverLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPicked(null); setSearch(""); setLines([]); setAddress(""); setQuoteNumber("");
    setLoading(true);
    listDeliverableQuotations().then(setQuotes).finally(() => setLoading(false));
  }, [open]);

  const choose = async (q: DeliverableQuotation) => {
    setLoading(true);
    try {
      const detail = await getQuotationForDelivery(q.id);
      if (!detail) { toast.error("Couldn't load that quotation"); return; }
      setPicked(q);
      setQuoteNumber(detail.quotation_number);
      setAddress(detail.customer_address ?? "");
      setLines(detail.items.map((i) => ({
        product_id: i.product_id, name: i.name, uom: i.uom, quantity: i.quantity, max: i.quantity,
      })));
    } finally { setLoading(false); }
  };

  const save = async () => {
    if (!picked) return;
    const toDeliver = lines.filter((l) => l.quantity > 0);
    if (toDeliver.length === 0) { toast.error("Set a delivery quantity on at least one line"); return; }
    setSaving(true);
    try {
      await createDeliveryNoteFromQuotation({
        quotationId: picked.id,
        address: address.trim() || undefined,
        items: toDeliver.map((l) => ({ product_id: l.product_id, name: l.name, uom: l.uom, quantity: l.quantity })),
      });
      toast.success(`Delivery note created from ${quoteNumber}`);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  };

  const filtered = quotes.filter((q) =>
    !search.trim() ||
    q.quotation_number.toLowerCase().includes(search.toLowerCase()) ||
    q.customer_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {picked ? `Deliver ${quoteNumber}` : "New delivery note"}
          </DialogTitle>
          <DialogDescription>
            {picked
              ? "Confirm what's going out. Reduce a quantity for a partial delivery."
              : "Delivery notes are raised against an accepted quotation. Pick one to fulfil."}
          </DialogDescription>
        </DialogHeader>

        {!picked ? (
          <div className="space-y-3 py-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search quote # or customer…" className="pl-9" />
            </div>
            <div className="max-h-[50vh] overflow-y-auto border border-border rounded-md divide-y divide-border">
              {loading ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
              ) : filtered.length === 0 ? (
                <EmptyState icon={FileText} title="No deliverable quotations" description="Send or accept a quotation first, then raise its delivery note here." />
              ) : filtered.map((q) => (
                <button key={q.id} onClick={() => choose(q)} className="w-full text-left px-3 py-2.5 hover:bg-accent/40 transition-colors flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{q.customer_name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {q.quotation_number} · {new Date(q.created_at).toLocaleDateString(intlLocale())}
                    </div>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground shrink-0">{KES(q.total)}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-1">
            <button onClick={() => setPicked(null)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Pick a different quotation
            </button>
            <label className="block space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Delivery address</span>
              <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="Where the goods are going" />
            </label>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1.5">Lines to deliver</div>
              <div className="border border-border rounded-md divide-y divide-border max-h-[38vh] overflow-y-auto">
                {lines.map((l, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2">
                    <span className="flex-1 text-sm truncate">{l.name}</span>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      max={l.max}
                      value={l.quantity}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(l.max, Number(e.target.value) || 0));
                        setLines((prev) => prev.map((x, j) => (j === i ? { ...x, quantity: v } : x)));
                      }}
                      className="w-20 h-8 text-sm font-mono text-right"
                    />
                    <span className="text-xs text-muted-foreground w-14">{l.uom} / {l.max}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Quantities are capped at what the quote ordered.</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          {picked ? (
            <Button onClick={save} disabled={saving}>{saving ? "Creating…" : "Create delivery note"}</Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
