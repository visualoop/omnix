import { useState } from "react";
import { UserPlus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { upsertCustomer, type Customer } from "@/services/erp";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
}

export function QuickAddCustomerDialog({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const reset = () => setForm({ name: "", phone: "", email: "" });

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
        reset();
        onClose();
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-semibold flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" /> Quick Add Customer
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="p-5 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Customer name"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Phone</label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="0700 000 000"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="optional"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Just the basics for now. Full profile (credit limit, allergies, etc.) can be added later from the Customers page.
          </p>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || !form.name.trim()} className="flex-1">
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Add & Use
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
