/**
 * Salon / Spa module pages — calendar, booking, checkout, services, staff,
 * clients, reports. Appointment-first workflow on top of Core.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Plus, CircleNotch as Loader2, CaretLeft, CaretRight, Sparkle,
  CheckCircle, Receipt, Scissors,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { money as KES } from "@/lib/money";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";
import { listCustomers, type Customer } from "@/services/erp";
import { getPaymentMethods, type PaymentMethod } from "@/services/sales";
import {
  moduleAccent, ModuleMasthead, ModuleTable, ModuleTHead, ModuleEmpty, ModuleSpinner,
} from "@/components/shared/module-kit";
import {
  listServices, createService, updateService, listStaff, createStaff, setStaffSkills, listStaffSkills,
  listAppointments, getAppointment, bookAppointment, updateAppointmentStatus, checkoutAppointment,
  commissionsByStaff, addMinutesIso,
  getServiceProducts, setServiceProducts, servicePopularity,
  getClientProfile, upsertClientProfile, listClientVisits,
  listPackages, createPackage, sellPackage, listClientPackages,
  listResources, createResource,
  type SalonService, type SalonStaff, type SalonAppointment, type AppointmentStatus, type StaffCommissionRow,
  type ServicePopularityRow, type SalonPackage, type ClientPackage, type SalonResource,
} from "@/services/salon";
import { getProducts, type Product } from "@/services/inventory";
import { listEmployees } from "@/services/employees";

const ACCENT = moduleAccent("salon");
const BRAND_BTN = `${ACCENT.solid} ${ACCENT.solidHover}`;

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  booked: "bg-slate-500/10 text-slate-600",
  confirmed: "bg-blue-500/10 text-blue-600",
  checked_in: "bg-amber-500/10 text-amber-600",
  in_service: "bg-violet-500/10 text-violet-600",
  completed: "bg-emerald-500/10 text-emerald-600",
  no_show: "bg-red-500/10 text-red-600",
  cancelled: "bg-red-500/10 text-red-600",
};

const DAY_START_MIN = 8 * 60;
const DAY_END_MIN = 20 * 60;
const PX_PER_MIN = 1.1;

function dayBounds(d: Date) {
  const start = new Date(d); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}
function minutesOfDay(iso: string) { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }

// ─── Calendar (day view) ──────────────────────────────────────────────────────

export function SalonCalendarPage() {
  const [date, setDate] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [view, setView] = useState<"day" | "week">("day");
  const [staff, setStaff] = useState<SalonStaff[]>([]);
  const [appts, setAppts] = useState<SalonAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<{ staffId?: string; startIso?: string } | null>(null);
  const [openApptId, setOpenApptId] = useState<string | null>(null);

  const weekDays = useMemo(() => {
    const start = new Date(date); start.setDate(start.getDate() - start.getDay()); // Sunday
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [date]);

  const load = () => {
    setLoading(true);
    let from: string, to: string;
    if (view === "week") { from = weekDays[0].toISOString(); const end = new Date(weekDays[6]); end.setDate(end.getDate() + 1); to = end.toISOString(); }
    else { const b = dayBounds(date); from = b.from; to = b.to; }
    Promise.all([listStaff(), listAppointments({ from, to })])
      .then(([st, ap]) => { setStaff(st); setAppts(ap); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [date, view]);

  const hours = useMemo(() => { const out: number[] = []; for (let m = DAY_START_MIN; m <= DAY_END_MIN; m += 60) out.push(m); return out; }, []);
  const shiftDay = (n: number) => { const d = new Date(date); d.setDate(d.getDate() + (view === "week" ? n * 7 : n)); setDate(d); };
  const isToday = date.toDateString() === new Date().toDateString();

  return (
    <div>
      <ModuleMasthead
        accent={ACCENT}
        eyebrow="Salon & Spa · Diary"
        title="Appointments"
        subtitle="The day's bookings by staff member. Tap a slot to book, an appointment to check out."
        actions={
          <Button size="sm" className={cn("cursor-pointer", BRAND_BTN)} onClick={() => setBooking({})}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New appointment
          </Button>
        }
      />

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Button variant="outline" size="icon-sm" onClick={() => shiftDay(-1)}><CaretLeft className="h-4 w-4" /></Button>
        <Button variant={isToday && view === "day" ? "default" : "outline"} size="sm" onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setDate(d); }}>Today</Button>
        <Button variant="outline" size="icon-sm" onClick={() => shiftDay(1)}><CaretRight className="h-4 w-4" /></Button>
        <Input type="date" value={date.toISOString().slice(0, 10)} onChange={(e) => e.target.value && setDate(new Date(e.target.value + "T00:00:00"))} className="h-8 text-xs w-[150px]" />
        <div className="ml-auto flex items-center gap-1 rounded-md border border-border p-0.5">
          <Button variant={view === "day" ? "default" : "ghost"} size="sm" className="h-7" onClick={() => setView("day")}>Day</Button>
          <Button variant={view === "week" ? "default" : "ghost"} size="sm" className="h-7" onClick={() => setView("week")}>Week</Button>
        </div>
      </div>

      {loading ? <ModuleSpinner /> : view === "week" ? (
        <div className="rounded-lg border border-border overflow-auto">
          <div className="grid grid-cols-7 min-w-[840px]">
            {weekDays.map((d) => {
              const dayAppts = appts.filter((a) => new Date(a.starts_at).toDateString() === d.toDateString());
              const dToday = d.toDateString() === new Date().toDateString();
              return (
                <div key={d.toISOString()} className="border-r border-border last:border-r-0 min-h-[220px]">
                  <div className={cn("border-b border-border px-2 py-1.5 text-[11px] font-medium text-center", dToday && "bg-accent")}>{d.toLocaleDateString([], { weekday: "short", day: "numeric" })}</div>
                  <div className="p-1.5 space-y-1">
                    {dayAppts.length === 0 ? <div className="text-[10px] text-muted-foreground text-center py-2">—</div> :
                      dayAppts.map((a) => (
                        <button key={a.id} onClick={() => setOpenApptId(a.id)} className={cn("block w-full rounded px-1.5 py-1 text-left text-[10px] leading-tight border border-current/20", STATUS_STYLE[a.status])}>
                          <div className="font-medium truncate">{fmtTime(a.starts_at)} {a.client_name ?? "Walk-in"}</div>
                          <div className="truncate opacity-80">{a.staff_name}</div>
                        </button>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : staff.length === 0 ? (
        <ModuleEmpty icon={Scissors} title="No staff yet" hint="Add staff on the Staff tab before booking appointments." />
      ) : (
        <div className="rounded-lg border border-border overflow-auto">
          <div className="flex min-w-[640px]">
            <div className="w-14 shrink-0 border-r border-border">
              <div className="h-9 border-b border-border" />
              <div className="relative" style={{ height: (DAY_END_MIN - DAY_START_MIN) * PX_PER_MIN }}>
                {hours.map((m) => (
                  <div key={m} className="absolute left-0 right-0 text-[10px] text-muted-foreground px-1 -translate-y-1/2" style={{ top: (m - DAY_START_MIN) * PX_PER_MIN }}>
                    {String(Math.floor(m / 60)).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
            </div>
            {staff.map((st) => {
              const col = appts.filter((a) => a.staff_id === st.id);
              return (
                <div key={st.id} className="flex-1 min-w-[140px] border-r border-border last:border-r-0">
                  <div className="h-9 border-b border-border flex items-center justify-center text-[12px] font-medium truncate px-2">{st.display_name}</div>
                  <div className="relative" style={{ height: (DAY_END_MIN - DAY_START_MIN) * PX_PER_MIN }}
                       onClick={(e) => {
                         const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                         const min = DAY_START_MIN + Math.round(((e.clientY - rect.top) / PX_PER_MIN) / 15) * 15;
                         const d = new Date(date); d.setHours(Math.floor(min / 60), min % 60, 0, 0);
                         setBooking({ staffId: st.id, startIso: d.toISOString() });
                       }}>
                    {hours.map((m) => <div key={m} className="absolute left-0 right-0 border-t border-border/50" style={{ top: (m - DAY_START_MIN) * PX_PER_MIN }} />)}
                    {col.map((a) => {
                      const top = (minutesOfDay(a.starts_at) - DAY_START_MIN) * PX_PER_MIN;
                      const height = Math.max(18, (minutesOfDay(a.ends_at) - minutesOfDay(a.starts_at)) * PX_PER_MIN);
                      return (
                        <button key={a.id} onClick={(e) => { e.stopPropagation(); setOpenApptId(a.id); }}
                          className={cn("absolute left-1 right-1 rounded-md border px-1.5 py-0.5 text-left overflow-hidden text-[11px] leading-tight", STATUS_STYLE[a.status], "border-current/20 hover:brightness-95")}
                          style={{ top, height }}>
                          <div className="font-medium truncate">{a.client_name ?? "Walk-in"}</div>
                          <div className="truncate opacity-80">{fmtTime(a.starts_at)}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <BookingDialog open={!!booking} preset={booking ?? {}} onClose={() => setBooking(null)} onBooked={() => { setBooking(null); load(); }} />
      <AppointmentSheet apptId={openApptId} onClose={() => setOpenApptId(null)} onChanged={load} />
    </div>
  );
}

// ─── Booking dialog ─────────────────────────────────────────────────────────

function BookingDialog({ open, preset, onClose, onBooked }: {
  open: boolean; preset: { staffId?: string; startIso?: string }; onClose: () => void; onBooked: () => void;
}) {
  const [services, setServices] = useState<SalonService[]>([]);
  const [staff, setStaff] = useState<SalonStaff[]>([]);
  const [clients, setClients] = useState<Customer[]>([]);
  const [clientId, setClientId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [resources, setResources] = useState<SalonResource[]>([]);
  const [resourceId, setResourceId] = useState("");
  const [pickedServices, setPickedServices] = useState<string[]>([]);
  const [startIso, setStartIso] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    listServices().then(setServices);
    listStaff().then(setStaff);
    listCustomers().then(setClients);
    listResources().then(setResources);
    setStaffId(preset.staffId ?? "");
    setStartIso(preset.startIso ?? defaultStart());
    setClientId(""); setPickedServices([]); setNotes(""); setResourceId("");
  }, [open, preset.staffId, preset.startIso]);

  const totalDuration = services.filter((s) => pickedServices.includes(s.id)).reduce((s, sv) => s + sv.duration_min, 0);
  const totalPrice = services.filter((s) => pickedServices.includes(s.id)).reduce((s, sv) => s + sv.price, 0);

  const toggleService = (id: string) => setPickedServices((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const submit = async () => {
    if (!staffId) { toast.error("Choose a staff member."); return; }
    if (pickedServices.length === 0) { toast.error("Pick at least one service."); return; }
    setSubmitting(true);
    try {
      await bookAppointment({ client_id: clientId || undefined, staff_id: staffId, starts_at: new Date(startIso).toISOString(), service_ids: pickedServices, resource_id: resourceId || undefined, notes: notes.trim() || undefined });
      toast.success("Appointment booked");
      onBooked();
    } catch (e) { toast.error(String(e)); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]"><Sparkle className="size-4 text-primary" /> New appointment</DialogTitle>
          <DialogDescription className="text-[12px]">Book a client with a staff member. End time is set from the services' duration.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Client">
              <Select value={clientId} onValueChange={(v) => setClientId(v as string)}>
                <SelectTrigger><SelectValue placeholder="Walk-in" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Staff *">
              <Select value={staffId} onValueChange={(v) => setStaffId(v as string)}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.display_name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Start">
            <Input type="datetime-local" value={startIso.slice(0, 16)} onChange={(e) => setStartIso(e.target.value)} />
          </Field>
          {resources.length > 0 && (
            <Field label="Room / resource (optional)">
              <Select value={resourceId} onValueChange={(v) => setResourceId(v as string)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>{resources.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          )}
          <Field label={`Services${totalDuration ? ` · ${totalDuration} min · ${KES(totalPrice)}` : ""}`}>
            <div className="max-h-44 overflow-auto rounded-md border border-border divide-y divide-border">
              {services.length === 0 ? <p className="p-3 text-[12px] text-muted-foreground">No services yet — add them on the Services tab.</p> :
                services.map((s) => (
                  <button key={s.id} type="button" onClick={() => toggleService(s.id)}
                    className={cn("flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-accent", pickedServices.includes(s.id) && "bg-accent")}>
                    <span>{pickedServices.includes(s.id) ? "✓ " : ""}{s.name} <span className="text-muted-foreground">· {s.duration_min}m</span></span>
                    <span className="font-mono tabular-nums text-[12px]">{KES(s.price)}</span>
                  </button>
                ))}
            </div>
          </Field>
          <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={submitting || !staffId || pickedServices.length === 0}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Sparkle className="size-4" />} Book
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function defaultStart(): string {
  const d = new Date(); d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d.toISOString();
}

// ─── Appointment sheet (status + checkout) ────────────────────────────────────

function AppointmentSheet({ apptId, onClose, onChanged }: { apptId: string | null; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getAppointment>>>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [methodId, setMethodId] = useState("");
  const [tip, setTip] = useState("");
  const user = useAuthStore((s) => s.user);

  const load = () => {
    if (!apptId) return;
    setLoading(true);
    getAppointment(apptId).then(setDetail).finally(() => setLoading(false));
  };
  useEffect(() => { if (apptId) { load(); getPaymentMethods().then((m) => { setMethods(m); setMethodId(m[0]?.id ?? ""); }); } else setDetail(null); /* eslint-disable-next-line */ }, [apptId]);

  if (!apptId) return null;
  const appt = detail?.appointment;
  const services = detail?.services ?? [];
  const total = services.reduce((s, x) => s + x.price, 0);

  const setStatus = async (to: AppointmentStatus) => {
    if (!appt) return;
    setBusy(true);
    try { await updateAppointmentStatus(appt.id, to); load(); onChanged(); }
    catch (e) { toast.error(String(e)); } finally { setBusy(false); }
  };

  const checkout = async () => {
    if (!appt || !user || !methodId) { toast.error("Pick a payment method."); return; }
    const method = methods.find((m) => m.id === methodId)!;
    setBusy(true);
    try {
      const tipN = parseFloat(tip) || 0;
      await checkoutAppointment({
        appointment_id: appt.id, userId: user.id,
        payments: [{ method_id: method.id, method_name: method.name, amount: total + tipN }],
        tip: tipN,
      });
      toast.success("Checked out");
      load(); onChanged();
    } catch (e) { toast.error(String(e)); } finally { setBusy(false); }
  };

  return (
    <Sheet open={!!apptId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:w-[440px] sm:max-w-[440px]">
        <SheetHeader><SheetTitle className="flex items-center gap-2"><Sparkle className="h-4 w-4 text-primary" /><span className="font-mono">{appt?.appt_number ?? "…"}</span></SheetTitle></SheetHeader>
        {loading || !appt ? <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin" /></div> : (
          <div className="flex-1 overflow-auto px-1 py-3 space-y-4 text-[13px]">
            <Badge variant="outline" className={cn("text-[10px] capitalize", STATUS_STYLE[appt.status])}>{appt.status.replace("_", " ")}</Badge>
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-0.5">
              <div className="font-medium">{appt.client_name ?? "Walk-in"}</div>
              <div className="text-[12px] text-muted-foreground">{appt.staff_name} · {fmtTime(appt.starts_at)}–{fmtTime(appt.ends_at)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Services</div>
              <div className="rounded-md border border-border divide-y divide-border">
                {services.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-1.5">
                    <span>{s.name} <span className="text-muted-foreground">· {s.duration_min}m</span></span>
                    <span className="font-mono tabular-nums">{KES(s.price)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2 font-medium bg-muted/40">
                  <span>Total</span><span className="font-mono tabular-nums">{KES(total)}</span>
                </div>
              </div>
            </div>

            {appt.notes ? <p className="text-muted-foreground">{appt.notes}</p> : null}

            {/* Status flow */}
            {!appt.sale_id && (
              <div className="flex flex-wrap gap-2">
                {appt.status === "booked" && <Button variant="outline" size="sm" disabled={busy} onClick={() => setStatus("confirmed")}>Confirm</Button>}
                {["booked", "confirmed"].includes(appt.status) && <Button variant="outline" size="sm" disabled={busy} onClick={() => setStatus("checked_in")}>Check in</Button>}
                {appt.status === "checked_in" && <Button variant="outline" size="sm" disabled={busy} onClick={() => setStatus("in_service")}>Start service</Button>}
                {["booked", "confirmed", "checked_in"].includes(appt.status) && <Button variant="outline" size="sm" disabled={busy} onClick={() => setStatus("no_show")}>No-show</Button>}
                {appt.status !== "cancelled" && <Button variant="outline" size="sm" disabled={busy} onClick={() => setStatus("cancelled")}>Cancel</Button>}
              </div>
            )}

            {/* Checkout */}
            {!appt.sale_id && ["checked_in", "in_service", "confirmed", "booked"].includes(appt.status) && (
              <div className="rounded-md border border-border p-3 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Checkout</div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Payment">
                    <Select value={methodId} onValueChange={(v) => setMethodId(v as string)}>
                      <SelectTrigger><SelectValue placeholder="Method" /></SelectTrigger>
                      <SelectContent>{methods.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Tip"><Input type="number" value={tip} onChange={(e) => setTip(e.target.value)} placeholder="0" className="text-right tabular-nums" /></Field>
                </div>
                <Button size="sm" className="w-full" disabled={busy} onClick={checkout}><Receipt className="size-4" /> Take payment · {KES(total + (parseFloat(tip) || 0))}</Button>
              </div>
            )}
            {appt.sale_id && <div className="flex items-center gap-2 text-emerald-600 text-[13px]"><CheckCircle className="size-4" /> Checked out</div>}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Services catalog page ────────────────────────────────────────────────────

export function SalonServicesPage() {
  const [services, setServices] = useState<SalonService[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SalonService | "new" | null>(null);
  const user = useAuthStore((s) => s.user);
  const load = () => { setLoading(true); listServices(true).then(setServices).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  void user;
  return (
    <div>
      <ModuleMasthead accent={ACCENT} eyebrow="Salon & Spa · Menu" title="Services" subtitle="Your treatment menu — duration, price and commission."
        actions={<Button size="sm" className={cn("cursor-pointer", BRAND_BTN)} onClick={() => setEditing("new")}><Plus className="h-3.5 w-3.5 mr-1.5" /> New service</Button>} />
      <ServiceDialog target={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      {loading ? <ModuleSpinner /> : services.length === 0 ? (
        <ModuleEmpty icon={Scissors} title="No services yet" hint="Add your first treatment to start booking." />
      ) : (
        <ModuleTable>
          <ModuleTHead><tr><th className="text-left px-3 py-2">Service</th><th className="text-left px-3 py-2">Category</th><th className="text-right px-3 py-2">Duration</th><th className="text-right px-3 py-2">Price</th><th className="text-right px-3 py-2">Commission</th></tr></ModuleTHead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} onClick={() => setEditing(s)} className="border-t border-border hover:bg-accent/30 cursor-pointer">
                <td className="px-3 py-2">{s.name}{s.active ? "" : <span className="text-muted-foreground text-[11px]"> · inactive</span>}</td>
                <td className="px-3 py-2 text-muted-foreground capitalize">{s.category ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.duration_min}m</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{KES(s.price)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.commission_pct != null ? `${s.commission_pct}%` : "default"}</td>
              </tr>
            ))}
          </tbody>
        </ModuleTable>
      )}
    </div>
  );
}

function ServiceDialog({ target, onClose, onSaved }: { target: SalonService | "new" | null; onClose: () => void; onSaved: () => void }) {
  const isNew = target === "new";
  const svc = target && target !== "new" ? target : null;
  const [name, setName] = useState(""); const [category, setCategory] = useState(""); const [duration, setDuration] = useState("30");
  const [price, setPrice] = useState(""); const [commission, setCommission] = useState(""); const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (svc) { setName(svc.name); setCategory(svc.category ?? ""); setDuration(String(svc.duration_min)); setPrice(String(svc.price)); setCommission(svc.commission_pct != null ? String(svc.commission_pct) : ""); setActive(svc.active === 1); }
    else if (isNew) { setName(""); setCategory(""); setDuration("30"); setPrice(""); setCommission(""); setActive(true); }
  }, [target]); // eslint-disable-line
  const save = async () => {
    if (!name.trim()) { toast.error("Name is required."); return; }
    setBusy(true);
    try {
      const payload = { name: name.trim(), category: category.trim() || undefined, duration_min: parseInt(duration) || 30, price: parseFloat(price) || 0, commission_pct: commission ? parseFloat(commission) : null };
      if (svc) await updateService(svc.id, { ...payload, active });
      else await createService(payload);
      toast.success(svc ? "Service updated" : "Service created"); onSaved();
    } catch (e) { toast.error(String(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="text-[15px]">{svc ? "Edit service" : "New service"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Name *"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ladies' cut & blow-dry" autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category"><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="hair / nails / spa" /></Field>
            <Field label="Duration (min)"><Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></Field>
            <Field label="Price (KES)"><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="text-right tabular-nums" /></Field>
            <Field label="Commission % (blank = staff default)"><Input type="number" value={commission} onChange={(e) => setCommission(e.target.value)} className="text-right tabular-nums" /></Field>
          </div>
          {svc && <BackBarEditor serviceId={svc.id} />}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : null} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Staff page ───────────────────────────────────────────────────────────────

export function SalonStaffPage() {
  const [staff, setStaff] = useState<SalonStaff[]>([]);
  const [services, setServices] = useState<SalonService[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [empId, setEmpId] = useState(""); const [comm, setComm] = useState("");
  const [employees, setEmployees] = useState<Array<{ id: string; full_name: string }>>([]);
  const [skillsFor, setSkillsFor] = useState<SalonStaff | null>(null);
  const load = () => {
    setLoading(true);
    Promise.all([listStaff(true), listServices(), listEmployees({ active: true })])
      .then(([s, sv, emp]) => { setStaff(s); setServices(sv); setEmployees(emp.map((e) => ({ id: e.id, full_name: e.full_name }))); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  // Employees not already enrolled as salon staff.
  const enrolledEmpIds = new Set(staff.map((s) => s.employee_id).filter(Boolean));
  const availableEmployees = employees.filter((e) => !enrolledEmpIds.has(e.id));
  const add = async () => {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) { toast.error("Pick a team member from Staff."); return; }
    try { await createStaff({ display_name: emp.full_name, employee_id: emp.id, commission_default_pct: parseFloat(comm) || 0 }); setEmpId(""); setComm(""); setAdding(false); load(); }
    catch (e) { toast.error(String(e)); }
  };
  return (
    <div>
      <ModuleMasthead accent={ACCENT} eyebrow="Salon & Spa · Team" title="Staff" subtitle="Enrol team members (from Staff / HR) as stylists — set their skills & commission."
        actions={<Button size="sm" className={cn("cursor-pointer", BRAND_BTN)} onClick={() => setAdding((v) => !v)}><Plus className="h-3.5 w-3.5 mr-1.5" /> Enrol staff</Button>} />
      {adding && (
        <div className="flex items-end gap-2 mb-3 rounded-md border border-border p-3">
          <Field label="Team member">
            <Select value={empId} onValueChange={(v) => setEmpId(v as string)}>
              <SelectTrigger className="w-56"><SelectValue placeholder={availableEmployees.length ? "Choose from Staff…" : "All staff enrolled"} /></SelectTrigger>
              <SelectContent>{availableEmployees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Default commission %"><Input type="number" value={comm} onChange={(e) => setComm(e.target.value)} className="w-32 text-right tabular-nums" /></Field>
          <Button size="sm" onClick={add} disabled={!empId}>Enrol</Button>
        </div>
      )}
      <SkillsDialog staff={skillsFor} services={services} onClose={() => setSkillsFor(null)} />
      {loading ? <ModuleSpinner /> : staff.length === 0 ? (
        <ModuleEmpty icon={Scissors} title="No staff yet" hint="Add your stylists and therapists here." />
      ) : (
        <ModuleTable>
          <ModuleTHead><tr><th className="text-left px-3 py-2">Name</th><th className="text-right px-3 py-2">Default commission</th><th className="text-right px-3 py-2">Skills</th></tr></ModuleTHead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-t border-border hover:bg-accent/30">
                <td className="px-3 py-2">{s.display_name}{s.active ? "" : <span className="text-muted-foreground text-[11px]"> · inactive</span>}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.commission_default_pct}%</td>
                <td className="px-3 py-2 text-right"><Button variant="outline" size="sm" onClick={() => setSkillsFor(s)}>Skills</Button></td>
              </tr>
            ))}
          </tbody>
        </ModuleTable>
      )}
      <ResourcesManager />
    </div>
  );
}

function ResourcesManager() {
  const [resources, setResources] = useState<SalonResource[]>([]);
  const [name, setName] = useState(""); const [type, setType] = useState("room");
  const load = () => listResources(true).then(setResources);
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!name.trim()) { toast.error("Name required."); return; }
    try { await createResource(name.trim(), type); setName(""); load(); } catch (e) { toast.error(String(e)); }
  };
  return (
    <div className="mt-6">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Rooms & resources</div>
      <div className="flex items-end gap-2 mb-2">
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} className="w-40" placeholder="e.g. Room 1" /></Field>
        <Field label="Type">
          <Select value={type} onValueChange={(v) => setType(v as string)}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{["room", "chair", "bed", "station"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Button size="sm" onClick={add}>Add</Button>
      </div>
      {resources.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {resources.map((r) => <Badge key={r.id} variant="outline" className="capitalize">{r.name} · {r.type}</Badge>)}
        </div>
      )}
    </div>
  );
}

function SkillsDialog({ staff, services, onClose }: { staff: SalonStaff | null; services: SalonService[]; onClose: () => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (staff) listStaffSkills(staff.id).then(setPicked); }, [staff]);
  if (!staff) return null;
  const toggle = (id: string) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const save = async () => { setBusy(true); try { await setStaffSkills(staff.id, picked); toast.success("Skills saved"); onClose(); } catch (e) { toast.error(String(e)); } finally { setBusy(false); } };
  return (
    <Dialog open={!!staff} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="text-[15px]">{staff.display_name} — services</DialogTitle></DialogHeader>
        <div className="max-h-72 overflow-auto rounded-md border border-border divide-y divide-border">
          {services.map((s) => (
            <button key={s.id} type="button" onClick={() => toggle(s.id)} className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-accent", picked.includes(s.id) && "bg-accent")}>
              {picked.includes(s.id) ? "✓" : "○"} {s.name}
            </button>
          ))}
        </div>
        <DialogFooter><Button variant="outline" size="sm" onClick={onClose} disabled={busy}>Cancel</Button><Button size="sm" onClick={save} disabled={busy}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reports (staff commissions) ──────────────────────────────────────────────

export function SalonReportsPage() {
  const [rows, setRows] = useState<StaffCommissionRow[]>([]);
  const [pop, setPop] = useState<ServicePopularityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 30);
    const toIso = addMinutesIso(to.toISOString(), 1);
    Promise.all([commissionsByStaff(from.toISOString(), toIso), servicePopularity(from.toISOString(), toIso)])
      .then(([c, p]) => { setRows(c); setPop(p); }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  return (
    <div>
      <ModuleMasthead accent={ACCENT} eyebrow="Salon & Spa · Reports" title="Reports" subtitle="Staff commissions + service popularity — last 30 days." />
      {loading ? <ModuleSpinner /> : (
        <div className="space-y-6">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Staff commissions</div>
            {rows.length === 0 ? <p className="text-[13px] text-muted-foreground">No commissions yet.</p> : (
              <ModuleTable>
                <ModuleTHead><tr><th className="text-left px-3 py-2">Staff</th><th className="text-right px-3 py-2">Jobs</th><th className="text-right px-3 py-2">Commission</th></tr></ModuleTHead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.staff_id} className="border-t border-border"><td className="px-3 py-2">{r.display_name}</td><td className="px-3 py-2 text-right tabular-nums">{r.jobs}</td><td className="px-3 py-2 text-right font-mono tabular-nums">{KES(r.total)}</td></tr>
                  ))}
                </tbody>
              </ModuleTable>
            )}
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Most popular services</div>
            {pop.length === 0 ? <p className="text-[13px] text-muted-foreground">No completed services yet.</p> : (
              <ModuleTable>
                <ModuleTHead><tr><th className="text-left px-3 py-2">Service</th><th className="text-right px-3 py-2">Booked</th><th className="text-right px-3 py-2">Revenue</th></tr></ModuleTHead>
                <tbody>
                  {pop.map((r) => (
                    <tr key={r.service_id} className="border-t border-border"><td className="px-3 py-2">{r.name}</td><td className="px-3 py-2 text-right tabular-nums">{r.count}</td><td className="px-3 py-2 text-right font-mono tabular-nums">{KES(r.revenue)}</td></tr>
                  ))}
                </tbody>
              </ModuleTable>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="text-[11px] font-medium text-muted-foreground">{label}</label>{children}</div>;
}

// ─── Packages / memberships page ──────────────────────────────────────────────

export function SalonPackagesPage() {
  const [packages, setPackages] = useState<SalonPackage[]>([]);
  const [services, setServices] = useState<SalonService[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(""); const [serviceId, setServiceId] = useState(""); const [sessions, setSessions] = useState("5"); const [price, setPrice] = useState(""); const [validity, setValidity] = useState("");
  const load = () => { setLoading(true); Promise.all([listPackages(true), listServices()]).then(([p, s]) => { setPackages(p); setServices(s); }).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!name.trim() || !serviceId) { toast.error("Name + service required."); return; }
    try { await createPackage({ name: name.trim(), service_id: serviceId, sessions: parseInt(sessions) || 1, price: parseFloat(price) || 0, validity_days: validity ? parseInt(validity) : null }); setName(""); setServiceId(""); setSessions("5"); setPrice(""); setValidity(""); setAdding(false); load(); }
    catch (e) { toast.error(String(e)); }
  };
  return (
    <div>
      <ModuleMasthead accent={ACCENT} eyebrow="Salon & Spa · Memberships" title="Packages" subtitle="Prepaid session bundles — sold to clients, redeemed at checkout."
        actions={<Button size="sm" className={cn("cursor-pointer", BRAND_BTN)} onClick={() => setAdding((v) => !v)}><Plus className="h-3.5 w-3.5 mr-1.5" /> New package</Button>} />
      {adding && (
        <div className="flex flex-wrap items-end gap-2 mb-3 rounded-md border border-border p-3">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} className="w-44" placeholder="e.g. 10 massages" /></Field>
          <Field label="Service"><Select value={serviceId} onValueChange={(v) => setServiceId(v as string)}><SelectTrigger className="w-40"><SelectValue placeholder="Choose…" /></SelectTrigger><SelectContent>{services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Sessions"><Input type="number" value={sessions} onChange={(e) => setSessions(e.target.value)} className="w-20 text-right tabular-nums" /></Field>
          <Field label="Price"><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-24 text-right tabular-nums" /></Field>
          <Field label="Valid (days)"><Input type="number" value={validity} onChange={(e) => setValidity(e.target.value)} className="w-24 text-right tabular-nums" placeholder="∞" /></Field>
          <Button size="sm" onClick={add}>Add</Button>
        </div>
      )}
      {loading ? <ModuleSpinner /> : packages.length === 0 ? (
        <ModuleEmpty icon={Sparkle} title="No packages yet" hint="Create a prepaid bundle (e.g. 10 sessions) to sell to clients." />
      ) : (
        <ModuleTable>
          <ModuleTHead><tr><th className="text-left px-3 py-2">Package</th><th className="text-left px-3 py-2">Service</th><th className="text-right px-3 py-2">Sessions</th><th className="text-right px-3 py-2">Price</th><th className="text-right px-3 py-2">Validity</th></tr></ModuleTHead>
          <tbody>
            {packages.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-2">{p.name}</td><td className="px-3 py-2 text-muted-foreground">{p.service_name ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.sessions}</td><td className="px-3 py-2 text-right font-mono tabular-nums">{KES(p.price)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.validity_days ? `${p.validity_days}d` : "∞"}</td>
              </tr>
            ))}
          </tbody>
        </ModuleTable>
      )}
    </div>
  );
}

// ─── Back-bar editor (products a service consumes) ────────────────────────────

function BackBarEditor({ serviceId }: { serviceId: string }) {
  const [items, setItems] = useState<Array<{ product_id: string; product_name?: string; quantity: number }>>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const load = () => getServiceProducts(serviceId).then((rows) => setItems(rows.map((r) => ({ product_id: r.product_id, product_name: r.product_name, quantity: r.quantity }))));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [serviceId]);
  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    let c = false; getProducts(search).then((p) => { if (!c) setResults(p.slice(0, 6)); }); return () => { c = true; };
  }, [search]);

  const persist = async (next: typeof items) => {
    setItems(next);
    try { await setServiceProducts(serviceId, next.map((i) => ({ product_id: i.product_id, quantity: i.quantity }))); }
    catch (e) { toast.error(String(e)); }
  };
  const add = (p: Product) => { if (items.some((i) => i.product_id === p.id)) return; persist([...items, { product_id: p.id, product_name: p.name, quantity: 1 }]); setSearch(""); setResults([]); };
  const setQty = (id: string, q: number) => persist(items.map((i) => i.product_id === id ? { ...i, quantity: q } : i));
  const remove = (id: string) => persist(items.filter((i) => i.product_id !== id));

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Back-bar products consumed</div>
      {items.map((i) => (
        <div key={i.product_id} className="flex items-center justify-between gap-2">
          <span className="text-[13px] truncate">{i.product_name}</span>
          <div className="flex items-center gap-2 shrink-0">
            <Input type="number" value={i.quantity} onChange={(e) => setQty(i.product_id, parseFloat(e.target.value) || 0)} className="h-7 w-16 text-right tabular-nums" />
            <Button variant="ghost" size="icon-xs" onClick={() => remove(i.product_id)}>×</Button>
          </div>
        </div>
      ))}
      <div className="relative">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Add a product used in this service…" className="h-8 text-xs" />
        {results.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 max-h-40 overflow-auto rounded-md border border-border bg-popover shadow-md">
            {results.map((p) => <button key={p.id} type="button" onClick={() => add(p)} className="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-accent">{p.name}</button>)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Clients page ─────────────────────────────────────────────────────────────

export function SalonClientsPage() {
  const [clients, setClients] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [openClient, setOpenClient] = useState<Customer | null>(null);
  const load = () => { setLoading(true); listCustomers(search.trim() || undefined).then(setClients).finally(() => setLoading(false)); };
  useEffect(() => { const t = setTimeout(load, search ? 200 : 0); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [search]);
  return (
    <div>
      <ModuleMasthead accent={ACCENT} eyebrow="Salon & Spa · Clients" title="Clients" subtitle="Client profiles, preferences and visit history." />
      <div className="mb-3 max-w-[280px]"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients…" className="h-8 text-xs" /></div>
      <ClientSheet client={openClient} onClose={() => setOpenClient(null)} />
      {loading ? <ModuleSpinner /> : clients.length === 0 ? (
        <ModuleEmpty icon={Sparkle} title="No clients" hint="Clients are your Core customers — add them from the customer list or at booking." />
      ) : (
        <ModuleTable>
          <ModuleTHead><tr><th className="text-left px-3 py-2">Name</th><th className="text-left px-3 py-2">Phone</th></tr></ModuleTHead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} onClick={() => setOpenClient(c)} className="border-t border-border hover:bg-accent/30 cursor-pointer">
                <td className="px-3 py-2">{c.name}</td><td className="px-3 py-2 text-muted-foreground">{c.phone ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </ModuleTable>
      )}
    </div>
  );
}

function ClientSheet({ client, onClose }: { client: Customer | null; onClose: () => void }) {
  const [prefs, setPrefs] = useState(""); const [allergies, setAllergies] = useState(""); const [formulas, setFormulas] = useState("");
  const [visits, setVisits] = useState<SalonAppointment[]>([]);
  const [clientPkgs, setClientPkgs] = useState<ClientPackage[]>([]);
  const [allPkgs, setAllPkgs] = useState<SalonPackage[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [sellPkgId, setSellPkgId] = useState(""); const [sellMethodId, setSellMethodId] = useState("");
  const [busy, setBusy] = useState(false);
  const user = useAuthStore((s) => s.user);
  const reloadPkgs = (id: string) => listClientPackages(id).then(setClientPkgs);
  useEffect(() => {
    if (!client) return;
    getClientProfile(client.id).then((p) => { setPrefs(p?.preferences ?? ""); setAllergies(p?.allergies ?? ""); setFormulas(p?.formulas ?? ""); });
    listClientVisits(client.id).then(setVisits);
    reloadPkgs(client.id);
    listPackages().then((p) => { setAllPkgs(p); setSellPkgId(p[0]?.id ?? ""); });
    getPaymentMethods().then((m) => { setMethods(m); setSellMethodId(m[0]?.id ?? ""); });
  }, [client]);
  if (!client) return null;
  const save = async () => {
    setBusy(true);
    try { await upsertClientProfile({ client_id: client.id, preferences: prefs, allergies, formulas, notes: null }); toast.success("Profile saved"); }
    catch (e) { toast.error(String(e)); } finally { setBusy(false); }
  };
  const sell = async () => {
    if (!user || !sellPkgId || !sellMethodId) { toast.error("Pick a package + payment."); return; }
    const pkg = allPkgs.find((p) => p.id === sellPkgId)!; const method = methods.find((m) => m.id === sellMethodId)!;
    setBusy(true);
    try {
      await sellPackage({ client_id: client.id, package_id: sellPkgId, userId: user.id, payments: [{ method_id: method.id, method_name: method.name, amount: pkg.price }] });
      toast.success("Package sold"); reloadPkgs(client.id);
    } catch (e) { toast.error(String(e)); } finally { setBusy(false); }
  };
  return (
    <Sheet open={!!client} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:w-[440px] sm:max-w-[440px]">
        <SheetHeader><SheetTitle>{client.name}</SheetTitle></SheetHeader>
        <div className="flex-1 overflow-auto px-1 py-3 space-y-3 text-[13px]">
          <Field label="Preferences"><Textarea value={prefs} onChange={(e) => setPrefs(e.target.value)} rows={2} /></Field>
          <Field label="Allergies / sensitivities"><Textarea value={allergies} onChange={(e) => setAllergies(e.target.value)} rows={2} /></Field>
          <Field label="Formulas (colour, etc.)"><Textarea value={formulas} onChange={(e) => setFormulas(e.target.value)} rows={2} /></Field>
          <Button size="sm" onClick={save} disabled={busy}>Save profile</Button>

          {/* Packages */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 mt-2">Packages</div>
            {clientPkgs.length === 0 ? <p className="text-[12px] text-muted-foreground">No packages.</p> : (
              <div className="rounded-md border border-border divide-y divide-border mb-2">
                {clientPkgs.map((cp) => (
                  <div key={cp.id} className="flex items-center justify-between px-3 py-1.5">
                    <span>{cp.package_name}</span>
                    <span className={cn("font-mono tabular-nums text-[12px]", cp.sessions_remaining > 0 ? "text-emerald-600" : "text-muted-foreground")}>{cp.sessions_remaining}/{cp.sessions_total} left</span>
                  </div>
                ))}
              </div>
            )}
            {allPkgs.length > 0 && (
              <div className="flex items-end gap-2">
                <Field label="Sell package"><Select value={sellPkgId} onValueChange={(v) => setSellPkgId(v as string)}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>{allPkgs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {KES(p.price)}</SelectItem>)}</SelectContent></Select></Field>
                <Select value={sellMethodId} onValueChange={(v) => setSellMethodId(v as string)}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent>{methods.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select>
                <Button size="sm" onClick={sell} disabled={busy}>Sell</Button>
              </div>
            )}
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 mt-2">Visit history</div>
            {visits.length === 0 ? <p className="text-[12px] text-muted-foreground">No completed visits yet.</p> : (
              <div className="rounded-md border border-border divide-y divide-border">
                {visits.map((v) => (
                  <div key={v.id} className="flex items-center justify-between px-3 py-1.5">
                    <span>{new Date(v.starts_at).toLocaleDateString()} · {v.staff_name}</span>
                    <span className="font-mono tabular-nums">{KES(v.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
