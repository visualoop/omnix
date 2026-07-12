/**
 * Salon / Spa module pages — calendar, booking, checkout, services, staff,
 * clients, reports. Appointment-first workflow on top of Core.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Plus, CircleNotch as Loader2, CaretLeft, CaretRight,
  CheckCircle, Receipt, Scissors, ArrowSquareOut, UsersThree, House,
} from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { money as KES } from "@/lib/money";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { listCustomers, type Customer } from "@/services/erp";
import {
  moduleAccent, ModuleMasthead, ModuleTable, ModuleTHead, ModuleEmpty, ModuleSpinner,
} from "@/components/shared/module-kit";
import {
  listServices, createService, updateService, listStaff, setStaffSkills, listStaffSkills,
  listAppointments, getAppointment, bookAppointment, updateAppointmentStatus, prepareAppointmentForPos,
  commissionsByStaff, addMinutesIso,
  getServiceProducts, setServiceProducts, servicePopularity,
  getClientProfile, upsertClientProfile, listClientVisits,
  listPackages, createPackage, updatePackage, preparePackageForPos, listClientPackages,
  listResources, createResource, updateResource,
  listEnrollableStaff, enrolStaff, updateStaff,
  type SalonService, type SalonStaff, type SalonAppointment, type AppointmentStatus, type StaffCommissionRow,
  type ServicePopularityRow, type SalonPackage, type ClientPackage, type SalonResource, type EnrollablePerson,
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
  const [clientPkgs, setClientPkgs] = useState<ClientPackage[]>([]);

  useEffect(() => {
    if (!clientId) { setClientPkgs([]); return; }
    listClientPackages(clientId, true).then(setClientPkgs).catch(() => setClientPkgs([]));
  }, [clientId]);

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

  // Walk-in: book the appointment for now + send straight to POS to take
  // payment. Reuses the appointment→POS path so commissions + package
  // coverage still run on completion — no separate "instant sale" code path.
  const bookNavigate = useNavigate();
  const submitAndPay = async () => {
    if (!staffId) { toast.error("Choose a staff member."); return; }
    if (pickedServices.length === 0) { toast.error("Pick at least one service."); return; }
    setSubmitting(true);
    try {
      const { id } = await bookAppointment({ client_id: clientId || undefined, staff_id: staffId, starts_at: new Date(startIso).toISOString(), service_ids: pickedServices, resource_id: resourceId || undefined, notes: notes.trim() || undefined });
      const payload = await prepareAppointmentForPos(id);
      useCartStore.getState().loadSnapshot(payload.items, 0, payload.customerId, {
        tipEmployeeId: payload.tipEmployeeId,
        source: { type: "salon_appointment", id, label: payload.label },
      });
      toast.success("Booked — take payment in POS");
      onBooked();
      bookNavigate("/pos/sale");
    } catch (e) { toast.error(String(e)); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]"><Scissors className="size-4 text-primary" /> New appointment</DialogTitle>
          <DialogDescription className="text-[12px]">Book a client with a staff member. End time is set from the services' duration.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Client">
              <Combobox
                value={clientId}
                onChange={setClientId}
                options={clients.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Walk-in"
                searchPlaceholder="Search clients…"
                emptyText="No clients match"
              />
              {clientPkgs.length > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Has {clientPkgs.length} active package{clientPkgs.length === 1 ? "" : "s"} — a matching service is auto-covered at checkout.
                </p>
              )}
            </Field>
            <Field label="Staff *">
              <Combobox
                value={staffId}
                onChange={setStaffId}
                options={staff.map((s) => ({ value: s.id, label: s.display_name }))}
                placeholder="Choose staff…"
                searchPlaceholder="Search staff…"
                emptyText="No staff match"
              />
            </Field>
          </div>
          <Field label="Start">
            <Input type="datetime-local" value={startIso.slice(0, 16)} onChange={(e) => setStartIso(e.target.value)} />
          </Field>
          {resources.length > 0 && (
            <Field label="Room / resource (optional)">
              <Combobox
                value={resourceId}
                onChange={setResourceId}
                options={resources.map((r) => ({ value: r.id, label: r.name, hint: r.type }))}
                placeholder="None"
                searchPlaceholder="Search rooms…"
              />
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
          <Button variant="outline" size="sm" onClick={submit} disabled={submitting || !staffId || pickedServices.length === 0}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Scissors className="size-4" />} Book
          </Button>
          <Button size="sm" className={cn(BRAND_BTN)} onClick={submitAndPay} disabled={submitting || !staffId || pickedServices.length === 0} title="Book now and take payment in POS (walk-in)">
            <Receipt className="size-4 mr-1" /> Book &amp; pay in POS
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
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof prepareAppointmentForPos>>["items"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    if (!apptId) return;
    setLoading(true);
    getAppointment(apptId).then((d) => {
      setDetail(d);
      // Preview the exact lines POS will charge (current prices + package
      // coverage) so the sheet total matches POS — no side effects.
      if (d && !d.appointment.sale_id && d.services.length > 0) {
        prepareAppointmentForPos(apptId).then((p) => setPreview(p.items)).catch(() => setPreview(null));
      } else setPreview(null);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { if (apptId) load(); else { setDetail(null); setPreview(null); } /* eslint-disable-next-line */ }, [apptId]);

  if (!apptId) return null;
  const appt = detail?.appointment;
  const services = detail?.services ?? [];
  // Total to charge = preview (reflects current price + package coverage) when
  // available, else the booking snapshot.
  const total = preview ? preview.reduce((s, x) => s + x.total, 0) : services.reduce((s, x) => s + x.price, 0);

  const setStatus = async (to: AppointmentStatus) => {
    if (!appt) return;
    setBusy(true);
    try { await updateAppointmentStatus(appt.id, to); load(); onChanged(); }
    catch (e) { toast.error(String(e)); } finally { setBusy(false); }
  };

  // Send the appointment to POS for completion — same pattern as hardware
  // quotes. The service lines (with package coverage) load into the cart; the
  // sale completes through the standard payment modal, which finalizes the
  // appointment (commissions, back-bar, package redemption, mark checked out).
  const sendToPos = async () => {
    if (!appt) return;
    setBusy(true);
    try {
      const payload = await prepareAppointmentForPos(appt.id);
      useCartStore.getState().loadSnapshot(payload.items, 0, payload.customerId, {
        tipEmployeeId: payload.tipEmployeeId,
        source: { type: "salon_appointment", id: appt.id, label: payload.label },
      });
      toast.success("Loaded in POS — take payment to complete the sale");
      onClose();
      navigate("/pos/sale");
    } catch (e) { toast.error(String(e)); } finally { setBusy(false); }
  };

  return (
    <Sheet open={!!apptId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:w-[440px] sm:max-w-[440px]">
        <SheetHeader><SheetTitle className="flex items-center gap-2"><Scissors className="h-4 w-4 text-primary" /><span className="font-mono">{appt?.appt_number ?? "…"}</span></SheetTitle></SheetHeader>
        {loading || !appt ? <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin" /></div> : (
          <div className="flex-1 overflow-auto px-1 py-3 space-y-4 text-[13px]">
            <Badge variant="outline" className={cn("text-[10px] capitalize", STATUS_STYLE[appt.status])}>{appt.status.replace("_", " ")}</Badge>
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{appt.client_name ?? "Walk-in"}</div>
                {appt.client_phone && <a href={`tel:${appt.client_phone}`} className="font-mono text-[12px] text-muted-foreground hover:text-foreground">{appt.client_phone}</a>}
              </div>
              <div className="text-[12px] text-muted-foreground">
                {new Date(appt.starts_at).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })} · {fmtTime(appt.starts_at)}–{fmtTime(appt.ends_at)}
              </div>
              <div className="text-[12px] text-muted-foreground">with {appt.staff_name}{appt.resource_name ? ` · ${appt.resource_name}` : ""}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Services</div>
              <div className="rounded-md border border-border divide-y divide-border">
                {services.map((s, i) => {
                  const pv = preview?.[i];
                  const covered = pv ? pv.total === 0 && /\(package\)/.test(pv.name) : false;
                  const charge = pv ? pv.total : s.price;
                  return (
                    <div key={s.id} className="flex items-center justify-between px-3 py-1.5">
                      <span>{s.name} <span className="text-muted-foreground">· {s.duration_min}m</span></span>
                      {covered
                        ? <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Covered by package</span>
                        : <span className="font-mono tabular-nums">{KES(charge)}</span>}
                    </div>
                  );
                })}
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

            {/* Checkout — POS is the single place a sale is completed. */}
            {!appt.sale_id && ["checked_in", "in_service", "confirmed", "booked"].includes(appt.status) && (
              <div className="rounded-md border border-border p-3 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Checkout</div>
                <p className="text-[12px] text-muted-foreground">Complete this appointment in POS — add any retail products, then take payment (cash, M-Pesa, split).</p>
                <Button size="sm" className={cn("w-full", BRAND_BTN)} disabled={busy} onClick={sendToPos}>
                  <Receipt className="size-4 mr-1.5" /> Complete in POS · {KES(total)}
                </Button>
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
  const [pickedKey, setPickedKey] = useState(""); const [comm, setComm] = useState("");
  const [employees, setEmployees] = useState<Array<{ id: string; full_name: string; job_title: string; phone: string | null }>>([]);
  const [enrollable, setEnrollable] = useState<EnrollablePerson[]>([]);
  const [detailStaff, setDetailStaff] = useState<SalonStaff | null>(null);
  const navigate = useNavigate();
  const load = () => {
    setLoading(true);
    Promise.all([listStaff(true), listServices(), listEnrollableStaff(), listEmployees({ active: true })])
      .then(([s, sv, enr, emp]) => {
        setStaff(s); setServices(sv); setEnrollable(enr);
        setEmployees(emp.map((e) => ({ id: e.id, full_name: e.full_name, job_title: e.job_title, phone: e.phone })));
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  // People available to enrol: employees not already enrolled, plus any login
  // user without an employee record (they materialize one on enrol).
  const enrolledEmpIds = new Set(staff.map((s) => s.employee_id).filter(Boolean));
  const available = enrollable.filter((p) => (p.kind === "user" ? true : !enrolledEmpIds.has(p.id)));
  const add = async () => {
    const person = available.find((p) => `${p.kind}:${p.id}` === pickedKey);
    if (!person) { toast.error("Pick a team member."); return; }
    try { await enrolStaff(person, parseFloat(comm) || 0); setPickedKey(""); setComm(""); setAdding(false); load(); }
    catch (e) { toast.error(String(e)); }
  };
  return (
    <div className="space-y-8">
      <ModuleMasthead accent={ACCENT} eyebrow="Salon & Spa · Team" title="Staff"
        subtitle="Your stylists & therapists are Staff (HR) records — enrol them here to set skills & commission."
        actions={<Button size="sm" className={cn("cursor-pointer", BRAND_BTN)} onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5 mr-1.5" /> Enrol staff</Button>} />

      {/* ── Team ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-center gap-2">
            <UsersThree className="h-4 w-4 text-muted-foreground" weight="fill" />
            <div>
              <h3 className="text-[13px] font-semibold leading-tight">Team</h3>
              <p className="text-[11.5px] text-muted-foreground">Enrolled from Staff (HR). Add or edit people in Staff.</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/hr/employees")}
            className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            Open Staff <ArrowSquareOut className="h-3.5 w-3.5" />
          </button>
        </div>

        {loading ? <ModuleSpinner /> : staff.length === 0 ? (
          <ModuleEmpty icon={Scissors} title="No staff enrolled" hint="Click “Enrol staff” to add a stylist or therapist from your Staff (HR) list." />
        ) : (
          <ModuleTable>
            <ModuleTHead><tr>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Role</th>
              <th className="text-left px-3 py-2">Phone</th>
              <th className="text-right px-3 py-2">Commission</th>
              <th className="text-right px-3 py-2">Status</th>
              <th className="text-right px-3 py-2 w-8"></th>
            </tr></ModuleTHead>
            <tbody>
              {staff.map((s) => {
                const emp = employees.find((e) => e.id === s.employee_id);
                return (
                  <tr key={s.id} onClick={() => setDetailStaff(s)} className="border-t border-border hover:bg-accent/30 cursor-pointer">
                    <td className="px-3 py-2 font-medium">{s.display_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{emp?.job_title || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground font-mono text-[12px]">{emp?.phone || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.commission_default_pct}%</td>
                    <td className="px-3 py-2 text-right">
                      {s.active
                        ? <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">Active</Badge>
                        : <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground"><CaretRight className="h-3.5 w-3.5 inline" /></td>
                  </tr>
                );
              })}
            </tbody>
          </ModuleTable>
        )}
      </section>

      {/* ── Rooms & resources ────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <House className="h-4 w-4 text-muted-foreground" weight="fill" />
          <div>
            <h3 className="text-[13px] font-semibold leading-tight">Rooms & resources</h3>
            <p className="text-[11.5px] text-muted-foreground">Bookable spaces & stations — assign an appointment to a room, chair, bed or station.</p>
          </div>
        </div>
        <ResourcesManager />
      </section>

      {/* ── Enrol dialog ─────────────────────────────────────── */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Enrol a team member</DialogTitle>
            <DialogDescription>Pick anyone you've added — from Staff (HR) or Settings → Users — and set their default commission. Everyone keeps one record across the app.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {enrollable.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center space-y-3">
                <UsersThree className="h-7 w-7 mx-auto text-muted-foreground" weight="fill" />
                <div className="space-y-1">
                  <p className="text-[13px] font-medium">No people to enrol yet</p>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">Add a team member first — then come back to enrol them as a stylist or therapist.</p>
                </div>
                <Button size="sm" className={cn(BRAND_BTN)} onClick={() => { setAdding(false); navigate("/hr/employees"); }}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Create staff
                </Button>
              </div>
            ) : (
              <>
                <Field label="Team member">
                  <Combobox
                    value={pickedKey}
                    onChange={setPickedKey}
                    options={available.map((p) => ({
                      value: `${p.kind}:${p.id}`,
                      label: `${p.full_name}${p.subtitle ? ` · ${p.subtitle}` : ""}`,
                      hint: p.kind === "user" ? "login" : undefined,
                    }))}
                    placeholder={available.length ? "Choose a person…" : "Everyone is enrolled"}
                    searchPlaceholder="Search people…"
                    emptyText="No matches"
                  />
                  {available.length === 0 && (
                    <p className="text-[11.5px] text-muted-foreground">Everyone you've added is already enrolled. Add more people in <button onClick={() => { setAdding(false); navigate("/hr/employees"); }} className="underline hover:text-foreground">Staff</button>.</p>
                  )}
                </Field>
                <Field label="Default commission %"><Input type="number" value={comm} onChange={(e) => setComm(e.target.value)} className="text-right tabular-nums" placeholder="0" /></Field>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
            {enrollable.length > 0 && <Button size="sm" className={cn(BRAND_BTN)} onClick={add} disabled={!pickedKey}>Enrol</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StaffDetailSheet
        staff={detailStaff}
        services={services}
        emp={employees.find((e) => e.id === detailStaff?.employee_id)}
        onClose={() => setDetailStaff(null)}
        onChanged={load}
        onOpenHr={() => navigate("/hr/employees")}
      />
    </div>
  );
}

function ResourcesManager() {
  const [resources, setResources] = useState<SalonResource[]>([]);
  const [target, setTarget] = useState<SalonResource | "new" | null>(null);
  const load = () => listResources(true).then(setResources);
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setTarget("new")}><Plus className="h-3.5 w-3.5 mr-1" /> Add resource</Button>
      </div>
      {resources.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
          <House className="h-6 w-6 mx-auto mb-2 text-muted-foreground" weight="fill" />
          <p className="text-[12px] text-muted-foreground">No rooms or resources yet — add your first bookable space.</p>
        </div>
      ) : (
        <ModuleTable>
          <ModuleTHead><tr>
            <th className="text-left px-3 py-2">Name</th>
            <th className="text-left px-3 py-2">Type</th>
            <th className="text-right px-3 py-2">Status</th>
            <th className="text-right px-3 py-2 w-8"></th>
          </tr></ModuleTHead>
          <tbody>
            {resources.map((r) => (
              <tr key={r.id} onClick={() => setTarget(r)} className="border-t border-border hover:bg-accent/30 cursor-pointer">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2 text-muted-foreground capitalize">{r.type}</td>
                <td className="px-3 py-2 text-right">
                  {r.active
                    ? <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">Active</Badge>
                    : <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground"><CaretRight className="h-3.5 w-3.5 inline" /></td>
              </tr>
            ))}
          </tbody>
        </ModuleTable>
      )}
      <ResourceDialog target={target} onClose={() => setTarget(null)} onSaved={() => { setTarget(null); load(); }} />
    </div>
  );
}

function ResourceDialog({ target, onClose, onSaved }: { target: SalonResource | "new" | null; onClose: () => void; onSaved: () => void }) {
  const isNew = target === "new";
  const res = target && target !== "new" ? target : null;
  const [name, setName] = useState(""); const [type, setType] = useState("room"); const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (res) { setName(res.name); setType(res.type); setActive(res.active === 1); }
    else if (isNew) { setName(""); setType("room"); setActive(true); }
  }, [target]); // eslint-disable-line
  const save = async () => {
    if (!name.trim()) { toast.error("Name is required."); return; }
    setBusy(true);
    try {
      if (res) await updateResource(res.id, { name: name.trim(), type, active });
      else await createResource(name.trim(), type);
      toast.success(res ? "Resource updated" : "Resource added"); onSaved();
    } catch (e) { toast.error(String(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-[15px]">{res ? "Edit resource" : "Add resource"}</DialogTitle>
          <DialogDescription>A bookable space or station — a room, chair, bed or station appointments can be assigned to.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Room 1" autoFocus /></Field>
          <Field label="Type">
            <Select value={type} onValueChange={(v) => setType(v as string)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["room", "chair", "bed", "station"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {res && (
            <label className="flex items-center gap-2 text-[13px] cursor-pointer">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-primary" /> Active (bookable)
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" className={cn(BRAND_BTN)} onClick={save} disabled={busy}>{res ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StaffDetailSheet({ staff, services, emp, onClose, onChanged, onOpenHr }: {
  staff: SalonStaff | null; services: SalonService[];
  emp?: { id: string; full_name: string; job_title: string; phone: string | null };
  onClose: () => void; onChanged: () => void; onOpenHr: () => void;
}) {
  const [name, setName] = useState("");
  const [comm, setComm] = useState("");
  const [active, setActive] = useState(true);
  const [skills, setSkills] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (staff) {
      setName(staff.display_name);
      setComm(String(staff.commission_default_pct));
      setActive(staff.active === 1);
      listStaffSkills(staff.id).then(setSkills);
    }
  }, [staff]);
  if (!staff) return null;
  const toggle = (id: string) => setSkills((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const save = async () => {
    if (!name.trim()) { toast.error("Name is required."); return; }
    setBusy(true);
    try {
      await updateStaff(staff.id, { display_name: name.trim(), commission_default_pct: parseFloat(comm) || 0, active });
      await setStaffSkills(staff.id, skills);
      toast.success("Staff updated");
      onChanged(); onClose();
    } catch (e) { toast.error(String(e)); } finally { setBusy(false); }
  };
  return (
    <Sheet open={!!staff} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:w-[440px] sm:max-w-[440px] overflow-y-auto">
        <SheetHeader><SheetTitle className="flex items-center gap-2"><Scissors className="h-4 w-4 text-primary" /> {staff.display_name}</SheetTitle></SheetHeader>
        <div className="space-y-5 py-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-[12px] space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium">Staff (HR) record</span>
              <button onClick={onOpenHr} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">Open <ArrowSquareOut className="h-3 w-3" /></button>
            </div>
            <div className="text-muted-foreground">{emp?.job_title || "—"} · {emp?.phone || "no phone"}</div>
          </div>

          <Field label="Display name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Default commission %"><Input type="number" value={comm} onChange={(e) => setComm(e.target.value)} className="text-right tabular-nums" /></Field>
          <label className="flex items-center gap-2 text-[13px] cursor-pointer">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-primary" /> Active (bookable)
          </label>

          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Skills — services this person can perform</div>
            <div className="max-h-64 overflow-auto rounded-md border border-border divide-y divide-border">
              {services.length === 0 ? <p className="p-3 text-[12px] text-muted-foreground">No services yet — add them on the Services tab.</p> :
                services.map((sv) => (
                  <button key={sv.id} type="button" onClick={() => toggle(sv.id)} className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-accent", skills.includes(sv.id) && "bg-accent")}>
                    <span className={cn("grid place-items-center size-4 rounded border text-[10px]", skills.includes(sv.id) ? "bg-primary border-primary text-primary-foreground" : "border-border")}>{skills.includes(sv.id) ? "✓" : ""}</span>
                    {sv.name}
                  </button>
                ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" className={cn(BRAND_BTN)} onClick={save} disabled={busy}>Save</Button>
        </div>
      </SheetContent>
    </Sheet>
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
  const [editing, setEditing] = useState<SalonPackage | "new" | null>(null);
  const load = () => { setLoading(true); Promise.all([listPackages(true), listServices()]).then(([p, s]) => { setPackages(p); setServices(s); }).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  return (
    <div>
      <ModuleMasthead accent={ACCENT} eyebrow="Salon & Spa · Memberships" title="Packages" subtitle="Prepaid session bundles — sold to clients, redeemed at checkout."
        actions={<Button size="sm" className={cn("cursor-pointer", BRAND_BTN)} onClick={() => setEditing("new")}><Plus className="h-3.5 w-3.5 mr-1.5" /> New package</Button>} />
      <PackageDialog target={editing} services={services} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      {loading ? <ModuleSpinner /> : packages.length === 0 ? (
        <ModuleEmpty icon={Scissors} title="No packages yet" hint="Create a prepaid bundle (e.g. 10 sessions) to sell to clients." />
      ) : (
        <ModuleTable>
          <ModuleTHead><tr><th className="text-left px-3 py-2">Package</th><th className="text-left px-3 py-2">Service</th><th className="text-right px-3 py-2">Sessions</th><th className="text-right px-3 py-2">Price</th><th className="text-right px-3 py-2">Validity</th></tr></ModuleTHead>
          <tbody>
            {packages.map((p) => (
              <tr key={p.id} onClick={() => setEditing(p)} className="border-t border-border hover:bg-accent/30 cursor-pointer">
                <td className="px-3 py-2">{p.name}{p.active ? "" : <span className="text-muted-foreground text-[11px]"> · inactive</span>}</td>
                <td className="px-3 py-2 text-muted-foreground">{p.service_name ?? "—"}</td>
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

function PackageDialog({ target, services, onClose, onSaved }: { target: SalonPackage | "new" | null; services: SalonService[]; onClose: () => void; onSaved: () => void }) {
  const isNew = target === "new";
  const pkg = target && target !== "new" ? target : null;
  const [name, setName] = useState(""); const [serviceId, setServiceId] = useState(""); const [sessions, setSessions] = useState("5");
  const [price, setPrice] = useState(""); const [validity, setValidity] = useState(""); const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (pkg) { setName(pkg.name); setServiceId(pkg.service_id ?? ""); setSessions(String(pkg.sessions)); setPrice(String(pkg.price)); setValidity(pkg.validity_days != null ? String(pkg.validity_days) : ""); setActive(pkg.active === 1); }
    else if (isNew) { setName(""); setServiceId(""); setSessions("5"); setPrice(""); setValidity(""); setActive(true); }
  }, [target]); // eslint-disable-line
  const save = async () => {
    if (!name.trim() || !serviceId) { toast.error("Name and service are required."); return; }
    setBusy(true);
    try {
      const payload = { name: name.trim(), service_id: serviceId, sessions: parseInt(sessions) || 1, price: parseFloat(price) || 0, validity_days: validity ? parseInt(validity) : null };
      if (pkg) await updatePackage(pkg.id, { ...payload, active });
      else await createPackage(payload);
      toast.success(pkg ? "Package updated" : "Package created"); onSaved();
    } catch (e) { toast.error(String(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[15px]">{pkg ? "Edit package" : "New package"}</DialogTitle>
          <DialogDescription>A prepaid bundle of sessions for one service. Clients buy it once and redeem sessions at checkout.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <Field label="Name *"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 10 massages" autoFocus /></Field>
          <Field label="Service *"><Combobox value={serviceId} onChange={setServiceId} options={services.map((s) => ({ value: s.id, label: s.name }))} placeholder="Choose a service…" searchPlaceholder="Search services…" /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Sessions"><Input type="number" value={sessions} onChange={(e) => setSessions(e.target.value)} className="text-right tabular-nums" /></Field>
            <Field label="Price (KES)"><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="text-right tabular-nums" /></Field>
            <Field label="Valid (days)"><Input type="number" value={validity} onChange={(e) => setValidity(e.target.value)} className="text-right tabular-nums" placeholder="∞" /></Field>
          </div>
          {pkg && (
            <label className="flex items-center gap-2 text-[13px] cursor-pointer">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-primary" />
              Active (available to sell)
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" className={cn(BRAND_BTN)} onClick={save} disabled={busy}>{pkg ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        <ModuleEmpty icon={Scissors} title="No clients" hint="Clients are your Core customers — add them from the customer list or at booking." />
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
  const [sellPkgId, setSellPkgId] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const reloadPkgs = (id: string) => listClientPackages(id).then(setClientPkgs);
  useEffect(() => {
    if (!client) return;
    getClientProfile(client.id).then((p) => { setPrefs(p?.preferences ?? ""); setAllergies(p?.allergies ?? ""); setFormulas(p?.formulas ?? ""); });
    listClientVisits(client.id).then(setVisits);
    reloadPkgs(client.id);
    listPackages().then((p) => { setAllPkgs(p); setSellPkgId(p[0]?.id ?? ""); });
  }, [client]);
  if (!client) return null;
  const save = async () => {
    setBusy(true);
    try { await upsertClientProfile({ client_id: client.id, preferences: prefs, allergies, formulas, notes: null }); toast.success("Profile saved"); }
    catch (e) { toast.error(String(e)); } finally { setBusy(false); }
  };
  const sellViaPos = async () => {
    if (!sellPkgId) { toast.error("Pick a package."); return; }
    setBusy(true);
    try {
      const { item, label } = await preparePackageForPos(sellPkgId);
      useCartStore.getState().loadSnapshot([item], 0, client.id, {
        source: { type: "salon_package", id: sellPkgId, label: `Package · ${label}` },
      });
      toast.success("Loaded in POS — take payment to complete the sale");
      onClose();
      navigate("/pos/sale");
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
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                <div className="text-[11px] font-medium">Sell a package</div>
                <Field label="Package">
                  <Combobox value={sellPkgId} onChange={setSellPkgId} options={allPkgs.map((p) => ({ value: p.id, label: `${p.name} · ${KES(p.price)}` }))} placeholder="Choose package…" searchPlaceholder="Search packages…" className="w-full" />
                </Field>
                <Button size="sm" className={cn("w-full", BRAND_BTN)} onClick={sellViaPos} disabled={busy || !sellPkgId}>
                  <Receipt className="h-3.5 w-3.5 mr-1.5" /> Sell in POS
                </Button>
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
