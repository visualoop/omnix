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
  type SalonService, type SalonStaff, type SalonAppointment, type AppointmentStatus, type StaffCommissionRow,
} from "@/services/salon";

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
  const [staff, setStaff] = useState<SalonStaff[]>([]);
  const [appts, setAppts] = useState<SalonAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<{ staffId?: string; startIso?: string } | null>(null);
  const [openApptId, setOpenApptId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    const { from, to } = dayBounds(date);
    Promise.all([listStaff(), listAppointments({ from, to })])
      .then(([st, ap]) => { setStaff(st); setAppts(ap); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [date]);

  const hours = useMemo(() => {
    const out: number[] = [];
    for (let m = DAY_START_MIN; m <= DAY_END_MIN; m += 60) out.push(m);
    return out;
  }, []);

  const shiftDay = (n: number) => { const d = new Date(date); d.setDate(d.getDate() + n); setDate(d); };
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

      <div className="flex items-center gap-2 mb-3">
        <Button variant="outline" size="icon-sm" onClick={() => shiftDay(-1)}><CaretLeft className="h-4 w-4" /></Button>
        <Button variant={isToday ? "default" : "outline"} size="sm" onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setDate(d); }}>Today</Button>
        <Button variant="outline" size="icon-sm" onClick={() => shiftDay(1)}><CaretRight className="h-4 w-4" /></Button>
        <Input type="date" value={date.toISOString().slice(0, 10)} onChange={(e) => e.target.value && setDate(new Date(e.target.value + "T00:00:00"))} className="h-8 text-xs w-[150px]" />
        <span className="text-sm font-medium ml-1">{date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}</span>
      </div>

      {loading ? <ModuleSpinner /> : staff.length === 0 ? (
        <ModuleEmpty icon={Scissors} title="No staff yet" hint="Add staff on the Staff tab before booking appointments." />
      ) : (
        <div className="rounded-lg border border-border overflow-auto">
          <div className="flex min-w-[640px]">
            {/* time gutter */}
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
            {/* staff columns */}
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
  const [pickedServices, setPickedServices] = useState<string[]>([]);
  const [startIso, setStartIso] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    listServices().then(setServices);
    listStaff().then(setStaff);
    listCustomers().then(setClients);
    setStaffId(preset.staffId ?? "");
    setStartIso(preset.startIso ?? defaultStart());
    setClientId(""); setPickedServices([]); setNotes("");
  }, [open, preset.staffId, preset.startIso]);

  const totalDuration = services.filter((s) => pickedServices.includes(s.id)).reduce((s, sv) => s + sv.duration_min, 0);
  const totalPrice = services.filter((s) => pickedServices.includes(s.id)).reduce((s, sv) => s + sv.price, 0);

  const toggleService = (id: string) => setPickedServices((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const submit = async () => {
    if (!staffId) { toast.error("Choose a staff member."); return; }
    if (pickedServices.length === 0) { toast.error("Pick at least one service."); return; }
    setSubmitting(true);
    try {
      await bookAppointment({ client_id: clientId || undefined, staff_id: staffId, starts_at: new Date(startIso).toISOString(), service_ids: pickedServices, notes: notes.trim() || undefined });
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
  const [name, setName] = useState(""); const [comm, setComm] = useState("");
  const [skillsFor, setSkillsFor] = useState<SalonStaff | null>(null);
  const load = () => { setLoading(true); Promise.all([listStaff(true), listServices()]).then(([s, sv]) => { setStaff(s); setServices(sv); }).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!name.trim()) { toast.error("Name required."); return; }
    try { await createStaff({ display_name: name.trim(), commission_default_pct: parseFloat(comm) || 0 }); setName(""); setComm(""); setAdding(false); load(); }
    catch (e) { toast.error(String(e)); }
  };
  return (
    <div>
      <ModuleMasthead accent={ACCENT} eyebrow="Salon & Spa · Team" title="Staff" subtitle="Stylists & therapists, their skills and commission rates."
        actions={<Button size="sm" className={cn("cursor-pointer", BRAND_BTN)} onClick={() => setAdding((v) => !v)}><Plus className="h-3.5 w-3.5 mr-1.5" /> Add staff</Button>} />
      {adding && (
        <div className="flex items-end gap-2 mb-3 rounded-md border border-border p-3">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} className="w-48" /></Field>
          <Field label="Default commission %"><Input type="number" value={comm} onChange={(e) => setComm(e.target.value)} className="w-32 text-right tabular-nums" /></Field>
          <Button size="sm" onClick={add}>Add</Button>
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
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 30);
    commissionsByStaff(from.toISOString(), addMinutesIso(to.toISOString(), 1)).then(setRows).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  return (
    <div>
      <ModuleMasthead accent={ACCENT} eyebrow="Salon & Spa · Reports" title="Staff commissions" subtitle="Commission earned per staff member — last 30 days." />
      {loading ? <ModuleSpinner /> : rows.length === 0 ? (
        <ModuleEmpty icon={Receipt} title="No commissions yet" hint="Complete a checkout to accrue commission." />
      ) : (
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
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="text-[11px] font-medium text-muted-foreground">{label}</label>{children}</div>;
}
