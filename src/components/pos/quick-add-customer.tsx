import { useEffect, useState } from "react";
import { CircleNotch as Loader2, UserPlus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { upsertCustomer, type Customer } from "@/services/erp";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { PosFormFactor } from "@/components/pos/use-pos-form-factor";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
  formFactor?: PosFormFactor;
}

export function QuickAddCustomerDialog({ open, onClose, onCreated, formFactor = "desktop" }: Props) {
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setForm({ name: "", phone: "", email: "" });
  }, [open]);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      const id = await upsertCustomer({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      });
      const { getCustomer } = await import("@/services/erp");
      const customer = await getCustomer(id);
      if (customer) {
        toast.success(`Added ${customer.name}`);
        onCreated(customer);
        onClose();
      }
    } catch (error) {
      toast.error(String(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={formFactor === "desktop"}
        className={cn(
          "flex flex-col",
          formFactor === "desktop"
            ? "max-w-md"
            : "!inset-0 !left-0 !top-0 !h-[100dvh] !max-h-none !w-full !max-w-none !translate-x-0 !translate-y-0 !rounded-none !bg-background !backdrop-blur-none p-0 motion-reduce:!duration-0 [&_button]:min-h-11 [&_input]:min-h-11 [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-ring [&_input]:focus-visible:outline-none [&_input]:focus-visible:ring-2 [&_input]:focus-visible:ring-ring",
        )}
      >
        <DialogHeader className={cn(formFactor !== "desktop" && "shrink-0 border-b border-border px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]")}>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="size-5 text-primary" /> Add customer</DialogTitle>
          <p className="text-xs text-muted-foreground">Create the essentials and attach this customer to the sale.</p>
        </DialogHeader>

        <div className={cn("space-y-4", formFactor === "desktop" ? "py-2" : "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5")}>
          <label className="block space-y-2">
            <span className="text-xs font-semibold text-muted-foreground">Name *</span>
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Customer name"
              autoComplete="name"
              enterKeyHint="next"
              autoFocus
            />
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-semibold text-muted-foreground">Phone</span>
            <Input
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder="0700 000 000"
              autoComplete="tel"
              enterKeyHint="next"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-semibold text-muted-foreground">Email</span>
            <Input
              type="email"
              inputMode="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="Optional"
              autoComplete="email"
              enterKeyHint="done"
              onKeyDown={(event) => event.key === "Enter" && handleSubmit()}
            />
          </label>
          <p className="text-xs text-muted-foreground">Credit limits, allergies, and the full profile remain available from Customers.</p>
        </div>

        <DialogFooter className={cn(formFactor !== "desktop" && "m-0 shrink-0 grid grid-cols-2 border-t border-border px-4 py-3 sm:grid-cols-2", "pb-[max(0.75rem,env(safe-area-inset-bottom))]")}>
          <Button variant="outline" className="h-12" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button className="h-12" onClick={handleSubmit} disabled={submitting || !form.name.trim()}>
            {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Add and use
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
