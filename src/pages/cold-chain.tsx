import { useEffect, useState } from "react";
import {
  Check,
  CircleNotch as Loader2,
  Pencil as PencilSimple,
  Plus,
  Snowflake,
  Thermometer,
  Warning as AlertTriangle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/require-role";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import {
  listUnits, upsertUnit, recordTemperature, listLogs, wasRecordedToday,
  type ColdChainUnit, type ColdChainLog,
} from "@/services/cold-chain";
import type { ColdChainAnalysis } from "@/services/cold-chain-rca";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { intlLocale } from "@/lib/intl";

import { BackButton } from "@/components/ui/back-button";
export function ColdChainPage() {
  const userId = useAuthStore((s) => s.user?.id);
  const [units, setUnits] = useState<ColdChainUnit[]>([]);
  const [recordedToday, setRecordedToday] = useState<Map<string, boolean>>(new Map());
  const [logs, setLogs] = useState<Array<ColdChainLog & { unit_name: string; user_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState<ColdChainUnit | null>(null);
  const [editingUnit, setEditingUnit] = useState<ColdChainUnit | null>(null);
  const [creatingUnit, setCreatingUnit] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const us = await listUnits(true);
      setUnits(us);
      const recordsMap = new Map<string, boolean>();
      for (const u of us) {
        recordsMap.set(u.id, await wasRecordedToday(u.id));
      }
      setRecordedToday(recordsMap);
      setLogs(await listLogs(undefined, { limit: 50 }));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const overdueCount = units.filter((u) => !recordedToday.get(u.id)).length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <BackButton fallback="/pharmacy" />
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Snowflake className="h-5 w-5 text-cyan-600" /> Cold Chain Monitoring
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Daily temperature logs for vaccine and refrigerated drug storage. Required for PPB compliance and WHO PQS.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCreatingUnit(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Unit
          </Button>
        </div>
      </div>

      {overdueCount > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-700" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">
                {overdueCount} unit{overdueCount !== 1 ? "s" : ""} need temperature recording today
              </p>
              <p className="text-xs text-amber-800">Record morning + evening readings as per cold-chain SOP</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unit cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {loading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-32 bg-muted/30 rounded-md animate-pulse" />)
        ) : units.length === 0 ? (
          <Card className="col-span-full">
            <CardContent>
              <EmptyState
                icon={Snowflake}
                title="No cold storage units"
                description="Add a fridge, freezer, or cold room to start logging temperatures."
                cta={{ label: "Add Unit", onClick: () => setCreatingUnit(true), icon: Plus }}
              />
            </CardContent>
          </Card>
        ) : (
          units.map((u) => {
            const isToday = recordedToday.get(u.id);
            const lastRange = u.last_temp_c !== null
              ? u.last_temp_c >= u.target_min_c && u.last_temp_c <= u.target_max_c
              : null;
            return (
              <Card key={u.id} className={`${
                lastRange === false ? "border-rose-300 bg-rose-50" :
                !isToday ? "border-amber-300" : ""
              }`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{u.name}</h3>
                      {u.location && <p className="text-[11px] text-muted-foreground">{u.location}</p>}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Target: {u.target_min_c}–{u.target_max_c}°C
                      </p>
                    </div>
                    <Can permission="inventory.edit">
                      <Button variant="ghost" size="icon-xs" onClick={() => setEditingUnit(u)} title="Edit unit">
                        <PencilSimple className="h-3 w-3" />
                      </Button>
                    </Can>
                  </div>

                  {u.last_temp_c !== null ? (
                    <div className={`text-3xl font-bold font-mono ${
                      lastRange === false ? "text-rose-700" : "text-cyan-700"
                    }`}>
                      {u.last_temp_c.toFixed(1)}°C
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic">No readings yet</div>
                  )}

                  <div className="flex items-center justify-between">
                    {u.last_recorded_at && (
                      <span className="text-[10px] text-muted-foreground">
                        Last: {new Date(u.last_recorded_at).toLocaleString(intlLocale(), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    {isToday ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[9px]">
                        <Check className="h-2.5 w-2.5 mr-0.5" /> Today
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-700 text-[9px]">Due</Badge>
                    )}
                  </div>

                  <Button onClick={() => setRecording(u)} className="w-full bg-cyan-600 hover:bg-cyan-700">
                    <Thermometer className="h-3.5 w-3.5 mr-1.5" /> Record Reading
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Recent logs */}
      <Card>
        <CardContent className="p-4">
          <h2 className="font-semibold text-sm mb-3">Recent Temperature Logs</h2>
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Time</th>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Unit</th>
                  <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Temp</th>
                  <th className="text-center px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Action / Notes</th>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">By</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableRowSkeleton cells={6} rows={3} />
                ) : logs.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">No logs yet</td></tr>
                ) : (
                  logs.map((l) => (
                    <tr key={l.id} className={`border-b border-border/60 ${l.in_range === 0 ? "bg-rose-50" : ""}`}>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">
                        {new Date(l.reading_at).toLocaleString(intlLocale(), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-3 py-1.5 text-xs">{l.unit_name}</td>
                      <td className={`px-3 py-1.5 text-right text-xs font-mono font-semibold ${l.in_range === 0 ? "text-rose-700" : ""}`}>
                        {l.temperature_c.toFixed(1)}°C
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {l.in_range === 1 ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[9px]">In Range</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[9px]">Out of Range</Badge>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">
                        {l.action_taken || l.notes || "—"}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">{l.user_name}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ExcursionAnalyses userId={userId} />

      <RecordDialog
        unit={recording}
        userId={userId}
        onClose={() => setRecording(null)}
        onSaved={() => { setRecording(null); load(); }}
      />
      <UnitForm
        open={creatingUnit || !!editingUnit}
        unit={editingUnit}
        onClose={() => { setCreatingUnit(false); setEditingUnit(null); }}
        onSaved={() => { setCreatingUnit(false); setEditingUnit(null); load(); }}
      />
    </div>
  );
}

function RecordDialog({ unit, userId, onClose, onSaved }: {
  unit: ColdChainUnit | null;
  userId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [temperature, setTemperature] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (unit) { setTemperature(""); setActionTaken(""); setNotes(""); }
  }, [unit?.id]);

  if (!unit) return null;
  const t = parseFloat(temperature);
  const inRange = !isNaN(t) && t >= unit.target_min_c && t <= unit.target_max_c;
  const showAction = !isNaN(t) && !inRange;

  const save = async () => {
    if (!userId) return;
    if (isNaN(t)) { toast.error("Enter a valid temperature"); return; }
    if (showAction && !actionTaken.trim()) {
      toast.error("Out-of-range temp requires action description");
      return;
    }
    setSubmitting(true);
    try {
      await recordTemperature({
        unit_id: unit.id,
        temperature_c: t,
        action_taken: actionTaken || undefined,
        notes: notes || undefined,
        user_id: userId,
      });
      toast.success("Recorded");
      onSaved();
    } catch (e) { toast.error(String(e)); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={!!unit} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Temperature — {unit.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="text-xs bg-muted/30 rounded p-2">
            Target range: <b>{unit.target_min_c}°C to {unit.target_max_c}°C</b>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Current Temperature (°C) *</label>
            <Input
              type="number"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              placeholder="e.g., 4.5"
              autoFocus
              className={!isNaN(t) ? (inRange ? "border-emerald-500" : "border-rose-500") : ""}
            />
            {!isNaN(t) && (
              <p className={`text-xs ${inRange ? "text-emerald-700" : "text-rose-700"}`}>
                {inRange ? "✓ In range" : "⚠ Out of range — action required"}
              </p>
            )}
          </div>

          {showAction && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-rose-700">Action Taken *</label>
              <Textarea
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
                className="w-full min-h-[60px] rounded-md border border-rose-300 bg-rose-50 px-2 py-1.5 text-[13px]"
                placeholder="e.g., Adjusted thermostat, moved stock to backup fridge, called technician..."
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Notes</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
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

function UnitForm({ open, unit, onClose, onSaved }: {
  open: boolean;
  unit: ColdChainUnit | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<ColdChainUnit>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(unit || { name: "", target_min_c: 2, target_max_c: 8, active: 1 });
    }
  }, [unit, open]);

  const save = async () => {
    if (!form.name) { toast.error("Name required"); return; }
    setSubmitting(true);
    try {
      await upsertUnit({ ...form, name: form.name });
      toast.success(unit ? "Updated" : "Added");
      onSaved();
    } catch (e) { toast.error(String(e)); }
    finally { setSubmitting(false); }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px]">
        <SheetHeader>
          <SheetTitle>{unit ? unit.name : "New Cold Storage Unit"}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Name *</label>
            <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Location</label>
            <Input value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder='e.g., "Pharmacy back room"' />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Min °C</label>
              <Input type="number" step="0.1" value={form.target_min_c ?? 2} onChange={(e) => setForm({ ...form, target_min_c: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Max °C</label>
              <Input type="number" step="0.1" value={form.target_max_c ?? 8} onChange={(e) => setForm({ ...form, target_max_c: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground bg-muted/30 rounded p-2 leading-relaxed">
            <b>Common ranges:</b> 2-8°C for most refrigerated drugs and vaccines (WHO).
            -25°C to -15°C for OPV, varicella vaccines.
            15-25°C for room-temperature storage.
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={submitting}>
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ExcursionAnalyses({ userId }: { userId?: string }) {
  const [analyses, setAnalyses] = useState<ColdChainAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { listAnalyses } = await import("@/services/cold-chain-rca");
      setAnalyses(await listAnalyses());
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading) return null;
  if (analyses.length === 0) return null;

  const ROOT_CAUSE_LABEL: Record<string, string> = {
    power_outage: "Power outage",
    unit_failure: "Unit failure",
    door_left_open: "Door left open",
    overload: "Overload / warm restock",
    sensor_error: "Sensor error",
    unknown: "Unknown",
  };

  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Excursion root-cause analyses
        </h2>
        <div className="space-y-2">
          {analyses.map((a) => (
            <div
              key={a.id}
              className={`border rounded-md p-3 ${a.reviewed_at ? "border-border" : "border-amber-300 bg-amber-50 dark:bg-amber-950/20"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {ROOT_CAUSE_LABEL[a.root_cause] || a.root_cause}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(a.confidence * 100)}% confidence · peak {a.peak_temperature_c.toFixed(1)}°C
                      {a.duration_minutes ? ` · ${a.duration_minutes} min` : ""}
                    </span>
                  </div>
                  {a.suggested_actions && (
                    <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground list-disc pl-4">
                      {a.suggested_actions.split("\n").map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  )}
                  {a.affected_products && (
                    <p className="text-[10px] text-muted-foreground mt-1">Affected: {a.affected_products}</p>
                  )}
                </div>
                {!a.reviewed_at && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs shrink-0"
                    onClick={async () => {
                      if (!userId) return;
                      const { reviewAnalysis } = await import("@/services/cold-chain-rca");
                      await reviewAnalysis(a.id, userId, "Reviewed + actioned");
                      toast.success("Marked reviewed");
                      load();
                    }}
                  >
                    <Check className="h-3 w-3 mr-1" /> Reviewed
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
