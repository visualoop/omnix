/**
 * CreateServiceJobDialog — open a workshop job against a tracked unit.
 *
 * The unit is found by serial (a customer brings a machine in), which also
 * surfaces its warranty status so the tech knows up-front whether the job is
 * chargeable.
 */
import { useState } from "react";
import { CircleNotch as Loader2, MagnifyingGlass as Search, Wrench, ShieldCheck } from "@phosphor-icons/react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { findUnitBySerial, warrantyState, specSummary, type EquipmentUnit } from "@/services/equipment";
import { createServiceJob } from "@/services/service";
import { listUsers } from "@/services/auth";
import { toast } from "sonner";

export function CreateServiceJobDialog({
  open, onClose, onCreated, unit: presetUnit,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (jobId: string) => void;
  /** Optional pre-selected unit (from the unit detail sheet). */
  unit?: EquipmentUnit | null;
}) {
  const [serial, setSerial] = useState("");
  const [unit, setUnit] = useState<EquipmentUnit | null>(presetUnit ?? null);
  const [looking, setLooking] = useState(false);
  const [fault, setFault] = useState("");
  const [meterIn, setMeterIn] = useState("");
  const [techId, setTechId] = useState<string>("");
  const [techs, setTechs] = useState<{ id: string; full_name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Load technicians lazily when the dialog opens.
  const ensureTechs = () => {
    if (techs.length === 0) listUsers().then((us) => setTechs(us.map((u) => ({ id: u.id, full_name: u.full_name })))).catch(() => {});
  };

  const lookup = async () => {
    if (!serial.trim()) return;
    setLooking(true);
    try {
      const u = await findUnitBySerial(serial.trim());
      if (!u) { toast.error("No unit with that serial."); setUnit(null); }
      else if (u.status === "written_off") { toast.error("That unit is written off."); setUnit(null); }
      else if (u.status === "in_service") { toast.error("That unit already has an open service job."); setUnit(null); }
      else { setUnit(u); if (u.meter_value != null) setMeterIn(String(u.meter_value)); }
    } finally {
      setLooking(false);
    }
  };

  const reset = () => {
    setSerial(""); setUnit(presetUnit ?? null); setFault(""); setMeterIn(""); setTechId("");
  };

  const submit = async () => {
    if (!unit) { toast.error("Find a unit by serial first."); return; }
    setSubmitting(true);
    try {
      const { id } = await createServiceJob({
        unit_id: unit.id,
        reported_fault: fault.trim() || undefined,
        technician_id: techId || undefined,
        meter_in: meterIn ? parseFloat(meterIn) : undefined,
      });
      toast.success("Service job opened");
      reset();
      onCreated(id);
      onClose();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const wState = unit ? warrantyState(unit.warranty_expiry) : "none";
  const covered = wState === "active" || wState === "expiring";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } else { ensureTechs(); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <Wrench className="size-4 text-primary" /> New service job
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            Find the machine by serial, note the fault, and assign a technician.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!presetUnit && (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && lookup()}
                  placeholder="Scan or type serial…"
                  className="pl-8 font-mono"
                  autoFocus
                />
              </div>
              <Button variant="outline" onClick={lookup} disabled={looking || !serial.trim()}>
                {looking ? <Loader2 className="size-4 animate-spin" /> : "Find"}
              </Button>
            </div>
          )}

          {unit && (
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{unit.product_name}</span>
                <Badge variant="outline" className={cn("text-[10px]", covered ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground")}>
                  <ShieldCheck className="h-3 w-3 mr-1" />{covered ? "Under warranty" : wState === "expired" ? "Warranty expired" : "No warranty"}
                </Badge>
              </div>
              <div className="font-mono text-[12px] text-muted-foreground">SN {unit.serial_number}</div>
              {specSummary(unit.specs_json) ? <div className="text-[11px] text-muted-foreground">{specSummary(unit.specs_json)}</div> : null}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Reported fault</label>
            <Textarea value={fault} onChange={(e) => setFault(e.target.value)} placeholder="What's wrong with the machine?" rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">Meter in (hours/km)</label>
              <Input type="number" value={meterIn} onChange={(e) => setMeterIn(e.target.value)} placeholder="0" className="text-right tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">Technician</label>
              <Select value={techId} onValueChange={(v) => setTechId(v as string)}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  {techs.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => { reset(); onClose(); }} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={submitting || !unit}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Wrench className="size-4" />}
            Open job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
