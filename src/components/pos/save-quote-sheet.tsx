/**
 * SaveQuoteSheet — right-side sheet for turning the current POS cart
 * into a hardware quotation.
 *
 * Reached from `/pos/sale?mode=quote` when the operator clicks the
 * relabeled "Save quote" button. Captures customer + validity + notes,
 * calls `createQuotation`, then routes to the newly created quote.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { toast } from "sonner";
import { useCartStore } from "@/stores/cart";
import { useAuthStore } from "@/stores/auth";
import { listCustomers, type Customer } from "@/services/erp";
import { createQuotation } from "@/services/hardware";
import { money as KES } from "@/lib/money";
import { confirm } from "@/components/ui/confirm-dialog";

interface Props {
  open: boolean;
  onClose: () => void;
}

function isoDateNDaysAhead(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function SaveQuoteSheet({ open, onClose }: Props) {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const cartCustomerId = useCartStore((s) => s.customerId);
  const grandTotal = useCartStore((s) => s.grandTotal());
  const clear = useCartStore((s) => s.clear);
  const setQuoteMode = useCartStore((s) => s.setQuoteMode);
  const userId = useAuthStore((s) => s.user?.id ?? "");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [validUntil, setValidUntil] = useState(isoDateNDaysAhead(30));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCustomerError, setShowCustomerError] = useState(false);

  useEffect(() => {
    if (!open) return;
    listCustomers().then(setCustomers).catch(() => setCustomers([]));
    setCustomerId(cartCustomerId);
    setValidUntil(isoDateNDaysAhead(30));
    setNotes("");
    setShowCustomerError(false);
  }, [open, cartCustomerId]);

  const customerName =
    customers.find((c) => c.id === customerId)?.name ?? "";

  const save = async () => {
    if (!customerId) {
      setShowCustomerError(true);
      toast.error("Pick a customer — quotes are always issued to someone.");
      return;
    }
    if (items.length === 0) {
      toast.error("Cart is empty. Add items before saving a quote.");
      return;
    }
    const ok = await confirm({
      title: "Save quote?",
      description: `Save this cart as a quote for ${customerName}. No payment will be taken.`,
      confirmText: "Save quote",
      cancelText: "Not yet",
    });
    if (!ok) return;

    setSaving(true);
    try {
      const id = await createQuotation({
        customerId,
        userId,
        validUntil: `${validUntil}T23:59:59`,
        items: items.map((it) => ({
          product_id: it.product_id,
          name: it.name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount: it.discount ?? 0,
          tax_rate: it.tax_rate ?? 0,
        })),
        notes: notes.trim() || undefined,
      });
      toast.success("Quote saved");
      clear();
      setQuoteMode(false);
      onClose();
      navigate(`/hardware/quotations/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save quote");
    } finally {
      setSaving(false);
    }
  };

  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: c.name,
    hint: c.phone ?? "",
  }));

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Save as quote</SheetTitle>
          <SheetDescription>
            Turn this cart into a hardware quotation. Nothing will be sold
            or paid.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Cart summary */}
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {items.length} item{items.length === 1 ? "" : "s"} in cart
            </div>
            <div className="font-mono font-medium text-sm">
              {KES(grandTotal)}
            </div>
          </div>

          {/* Customer */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground/85">
              Customer <span className="text-rose-600">*</span>
            </label>
            <div className={showCustomerError && !customerId ? "ring-2 ring-rose-500/50 rounded-md" : ""}>
              <Combobox
                value={customerId ?? ""}
                onChange={(v) => { setCustomerId(v || null); setShowCustomerError(false); }}
                options={customerOptions}
                placeholder="Pick a customer…"
                searchPlaceholder="Search customers"
                emptyText="No matching customer"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Quotes are always issued to someone.
            </p>
          </div>

          {/* Validity */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground/85">
              Valid until
            </label>
            <Input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="max-w-[220px] font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Default is 30 days from today.
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground/85">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Delivery timeline, payment terms, conditions…"
              rows={5}
              className="text-sm"
            />
          </div>
        </div>

        <SheetFooter className="border-t border-border pt-3">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save quote"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
