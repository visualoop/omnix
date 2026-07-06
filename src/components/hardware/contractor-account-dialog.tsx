/**
 * ContractorAccountDialog — CRUD credit limit / terms / on-hold flag
 * for a customer's account. Opens from the Accounts list ("New account"
 * button or "Edit" per row) and from the contractor detail page.
 */
import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { toast } from "sonner";
import { setCreditLimit, setAccountHold, getAccount, type CustomerAccount } from "@/services/hardware";
import { listCustomers, type Customer } from "@/services/erp";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** When set, edits that customer. Otherwise picks a customer inline. */
  customerId?: string;
}

export function ContractorAccountDialog({ open, onClose, onSaved, customerId }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>(customerId ?? "");
  const [creditLimit, setCreditLimitState] = useState("0");
  const [termsDays, setTermsDays] = useState("30");
  const [onHold, setOnHold] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    listCustomers().then(setCustomers);
    if (customerId) {
      setSelectedCustomer(customerId);
      getAccount(customerId).then((acc: CustomerAccount) => {
        setCreditLimitState(String(acc.credit_limit));
        setTermsDays(String(acc.terms_days));
        setOnHold(acc.on_hold === 1);
      });
    } else {
      setSelectedCustomer("");
      setCreditLimitState("0");
      setTermsDays("30");
      setOnHold(false);
    }
  }, [open, customerId]);

  const save = async () => {
    if (!selectedCustomer) {
      toast.error("Pick a contractor");
      return;
    }
    setSaving(true);
    try {
      await setCreditLimit(selectedCustomer, Number(creditLimit) || 0, Number(termsDays) || 30);
      await setAccountHold(selectedCustomer, onHold);
      toast.success(customerId ? "Account updated" : "Account created");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const customerOptions: ComboboxOption[] = customers.map((c) => ({
    value: c.id,
    label: c.name,
    hint: c.phone ?? "",
  }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{customerId ? "Edit account" : "New contractor account"}</DialogTitle>
          <DialogDescription>
            Set the credit limit + payment terms. On-hold accounts can't take on new charges.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {!customerId ? (
            <Field label="Contractor">
              <Combobox
                value={selectedCustomer}
                onChange={setSelectedCustomer}
                options={customerOptions}
                placeholder="Pick a contractor…"
              />
            </Field>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Credit limit (KES)">
              <Input
                type="number"
                step="1"
                value={creditLimit}
                onChange={(e) => setCreditLimitState(e.target.value)}
                className="font-mono"
              />
            </Field>
            <Field label="Terms (days)">
              <Input
                type="number"
                value={termsDays}
                onChange={(e) => setTermsDays(e.target.value)}
                className="font-mono"
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={onHold}
              onCheckedChange={(v) => setOnHold(v === true)}
            />
            <span>Put account on hold (block new charges)</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</span>
      {children}
    </label>
  );
}
