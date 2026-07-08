/**
 * Rental dialogs — Equipment DMS Phase 3.
 *
 * CreateRentalDialog: hire out serialized units to a customer for a period,
 * capturing the daily rate + meter-out per unit. ReturnRentalDialog: take a
 * machine back, recording meter-in, condition and any damage / late fees.
 */
import { useEffect, useState } from "react";
import { CircleNotch as Loader2, MagnifyingGlass as Search, Trash as Trash2, Truck } from "@phosphor-icons/react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { money as KES } from "@/lib/money";
import { listCustomers, type Customer } from "@/services/erp";
import { listRentableUnits, type EquipmentUnit } from "@/services/equipment";
import { createRentalAgreement, returnRental, getRentalAgreement, type RentalItemRow } from "@/services/operations";
import { toast } from "sonner";

interface HireLine {
  unit: EquipmentUnit;
  daily_rate: string;
  meter_out: string;
}

function today() { return new Date().toISOString().slice(0, 10); }
function plusDays(n: number) { return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10); }

export function CreateRentalDialog({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: () => void;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [starts, setStarts] = useState(today());
  const [ends, setEnds] = useState(plusDays(7));
  const [deposit, setDeposit] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<HireLine[]>([]);
  const [search, setSearch] = useState("");
  const [rentable, setRentable] = useState<EquipmentUnit[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setCustomerId(""); setStarts(today()); setEnds(plusDays(7)); setDeposit(""); setNotes("");
      setLines([]); setSearch(""); setRentable([]);
      return;
    }
    listCustomers().then(setCustomers);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!search.trim()) { setRentable([]); return; }
    let cancelled = false;
    listRentableUnits(search).then((u) => { if (!cancelled) setRentable(u); });
    return () => { cancelled = true; };
  }, [search, open]);

  const addUnit = (u: EquipmentUnit) => {
    if (lines.some((l) => l.unit.id === u.id)) return;
    setLines([...lines, { unit: u, daily_rate: "", meter_out: u.meter_value != null ? String(u.meter_value) : "" }]);
    setSearch(""); setRentable([]);
  };
  const updateLine = (idx: number, patch: Partial<HireLine>) => setLines(lines.map((l, i) => i === idx ? { ...l, ...patch } : l));
  const removeLine = (idx: number) => setLines(lines.filter((_, i) => i !== idx));

  const dailyTotal = lines.reduce((s, l) => s + (parseFloat(l.daily_rate) || 0), 0);

  const submit = async () => {
    if (!customerId) { toast.error("Choose a customer."); return; }
    if (lines.length === 0) { toast.error("Add at least one unit to hire."); return; }
    if (lines.some((l) => !(parseFloat(l.daily_rate) > 0))) { toast.error("Every unit needs a daily rate."); return; }
    setSubmitting(true);
    try {
      await createRentalAgreement({
        customer_id: customerId,
        starts_at: starts,
        ends_at: ends,
        deposit_amount: deposit ? parseFloat(deposit) : 0,
        notes: notes.trim() || undefined,
        items: lines.map((l) => ({
          product_id: l.unit.product_id,
          equipment_unit_id: l.unit.id,
          serial: l.unit.serial_number,
          quantity: 1,
          daily_rate: parseFloat(l.daily_rate),
          meter_out: l.meter_out ? parseFloat(l.meter_out) : undefined,
        })),
      });
      toast.success("Rental agreement created");
      onCreated();
      onClose();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl w-[calc(100vw-2rem)] gap-0 p-0 overflow-visible max-h-[calc(100vh-3rem)] flex flex-col">
        <DialogHeader className="border-b border-border px-5 py-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-[15px]"><Truck className="size-4 text-primary" /> New rental</DialogTitle>
          <DialogDescription className="text-[12px]">Hire out machines for a period. Each unit is marked on hire until returned.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Customer *">
              <Select value={customerId} onValueChange={(v) => setCustomerId(v as string)}>
                <SelectTrigger><SelectValue placeholder="Choose customer…" /></SelectTrigger>
                <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Deposit (KES)"><Input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="0" className="text-right tabular-nums" /></Field>
            <Field label="Start date"><Input type="date" value={starts} onChange={(e) => setStarts(e.target.value)} /></Field>
            <Field label="End date"><Input type="date" value={ends} onChange={(e) => setEnds(e.target.value)} /></Field>
          </div>

          <Field label="Add unit to hire">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search available units by serial or model…" className="pl-9" />
              {rentable.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-2 max-h-56 overflow-auto rounded-md border border-border bg-popover shadow-md">
                  {rentable.map((u) => (
                    <button key={u.id} type="button" onClick={() => addUnit(u)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-accent">
                      <span className="truncate">{u.product_name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground shrink-0">SN {u.serial_number}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>

          {lines.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-[13px] text-muted-foreground">Search and add the machines being hired.</div>
          ) : (
            <div className="space-y-2">
              {lines.map((l, idx) => (
                <div key={l.unit.id} className="rounded-md border border-border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{l.unit.product_name}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">SN {l.unit.serial_number}</div>
                    </div>
                    <Button variant="ghost" size="icon-xs" onClick={() => removeLine(idx)}><Trash2 className="size-3.5" /></Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Daily rate (KES)"><Input type="number" value={l.daily_rate} onChange={(e) => updateLine(idx, { daily_rate: e.target.value })} placeholder="0.00" className="text-right tabular-nums" /></Field>
                    <Field label="Meter out"><Input type="number" value={l.meter_out} onChange={(e) => updateLine(idx, { meter_out: e.target.value })} placeholder="0" className="text-right tabular-nums" /></Field>
                  </div>
                </div>
              ))}
              <div className="flex items-baseline justify-between rounded-md bg-muted/40 px-4 py-2.5">
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Daily total</span>
                <span className="font-mono text-[14px] tabular-nums font-medium">{KES(dailyTotal)}/day</span>
              </div>
            </div>
          )}

          <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" /></Field>
        </div>

        <DialogFooter className="border-t border-border px-5 py-4 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={submitting || lines.length === 0 || !customerId}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />} Create rental
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReturnRentalDialog({ agreementId, onClose, onReturned }: {
  agreementId: string | null; onClose: () => void; onReturned: () => void;
}) {
  const [items, setItems] = useState<RentalItemRow[]>([]);
  const [agreementNumber, setAgreementNumber] = useState("");
  const [meterIn, setMeterIn] = useState<Record<string, string>>({});
  const [condition, setCondition] = useState("");
  const [damageFee, setDamageFee] = useState("");
  const [lateFee, setLateFee] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!agreementId) { setItems([]); setMeterIn({}); setCondition(""); setDamageFee(""); setLateFee(""); return; }
    getRentalAgreement(agreementId).then((d) => {
      if (!d) return;
      setItems(d.items);
      setAgreementNumber(d.agreement.agreement_number);
      const m: Record<string, string> = {};
      for (const it of d.items) if (it.meter_out != null) m[it.id] = String(it.meter_out);
      setMeterIn(m);
    });
  }, [agreementId]);

  const submit = async () => {
    if (!agreementId) return;
    setSubmitting(true);
    try {
      const meters: Record<string, number> = {};
      for (const [k, v] of Object.entries(meterIn)) if (v) meters[k] = parseFloat(v);
      await returnRental(agreementId, {
        damageFee: damageFee ? parseFloat(damageFee) : 0,
        lateFee: lateFee ? parseFloat(lateFee) : 0,
        condition: condition.trim() || undefined,
        meterIn: meters,
      });
      toast.success("Rental returned");
      onReturned();
      onClose();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!agreementId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]"><Truck className="size-4 text-primary" /> Return rental {agreementNumber}</DialogTitle>
          <DialogDescription className="text-[12px]">Record meter readings + condition. Each machine returns to the fleet.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {items.map((it) => (
            <div key={it.id} className="rounded-md border border-border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{it.product_name}</span>
                <span className="font-mono text-[11px] text-muted-foreground">SN {it.serial ?? "—"}</span>
              </div>
              {it.equipment_unit_id ? (
                <div className="grid grid-cols-2 gap-2 items-end">
                  <Field label={`Meter in${it.meter_out != null ? ` (out: ${it.meter_out})` : ""}`}>
                    <Input type="number" value={meterIn[it.id] ?? ""} onChange={(e) => setMeterIn({ ...meterIn, [it.id]: e.target.value })} className="text-right tabular-nums" />
                  </Field>
                </div>
              ) : null}
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Damage fee (KES)"><Input type="number" value={damageFee} onChange={(e) => setDamageFee(e.target.value)} placeholder="0" className="text-right tabular-nums" /></Field>
            <Field label="Late fee (KES)"><Input type="number" value={lateFee} onChange={(e) => setLateFee(e.target.value)} placeholder="0" className="text-right tabular-nums" /></Field>
          </div>
          <Field label="Condition on return"><Textarea value={condition} onChange={(e) => setCondition(e.target.value)} rows={2} placeholder="Any damage or notes" /></Field>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={submitting}>{submitting ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />} Return</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
