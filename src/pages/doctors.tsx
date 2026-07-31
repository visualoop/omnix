import { useEffect, useState } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import { Building as Building2, Pencil as Edit3, Phone, Plus, Stethoscope, UserMinus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { BackButton } from "@/components/ui/back-button";
import { PaginationBar } from "@/components/pagination-bar";
import { OperationalContext } from "@/components/shared/operational-context";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { phonePlaceholder } from "@/lib/locale";
import { hasPermission } from "@/lib/permissions";
import { listDoctors, upsertDoctor, deactivateDoctor, SPECIALTIES, type Doctor, type DoctorWithStats } from "@/services/doctors";
import { useAuthStore } from "@/stores/auth";
import { useCountry } from "@/stores/country";
import { toast } from "sonner";

export function DoctorsPage() {
  const [doctors, setDoctors] = useState<DoctorWithStats[]>([]);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DoctorWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((state) => state.user);
  const country = useCountry((state) => state.code);
  const canManage = hasPermission(user, "pharmacy.doctors.manage");
  const doctorList = useClientPagination(doctors, 12, search);

  const load = async () => {
    setLoading(true);
    try { setDoctors(await listDoctors(search)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [search]);

  const deactivate = async (doctor: DoctorWithStats) => {
    if (!(await confirm({ title: `Deactivate ${doctor.full_name}?`, description: "Past prescriptions remain linked, but this prescriber will no longer appear in pickers." }))) return;
    try { await deactivateDoctor(doctor.id); toast.success("Doctor deactivated"); await load(); }
    catch (error) { toast.error(String(error)); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><BackButton fallback="/pharmacy" /><h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><Stethoscope className="h-5 w-5 text-primary" /> Prescribers</h1><p className="mt-1 text-sm text-muted-foreground">Doctor and prescriber directory for prescription tracking.</p></div>
        {canManage && <Button className="min-h-11" onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" /> Add doctor</Button>}
      </div>
      <OperationalContext compact />
      <Input aria-label="Search prescribers" className="h-11 max-w-sm" placeholder="Search name, license, hospital…" value={search} onChange={(event) => setSearch(event.target.value)} />

      {loading ? <div className="overflow-hidden rounded-lg border border-border"><table className="w-full text-sm"><tbody><TableRowSkeleton cells={6} rows={4} /></tbody></table></div> : doctors.length === 0 ? (
        <EmptyState icon={Stethoscope} title={search ? "No matching prescribers" : "No prescribers yet"} description={search ? "Try a different name, license, hospital, or specialty." : "Add prescribers to link them to prescriptions and compliance reports."} cta={!search && canManage ? { label: "Add doctor", onClick: () => setCreating(true), icon: Plus } : undefined} />
      ) : <>
        <div className="space-y-2 lg:hidden" aria-label="Prescriber cards">{doctorList.pageRows.map((doctor) => <article key={doctor.id} className="rounded-md border border-border p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{doctor.full_name}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Building2 className="h-3.5 w-3.5" />{doctor.hospital || "No facility recorded"}</p></div>{doctor.specialty && <Badge variant="secondary">{doctor.specialty}</Badge>}</div><div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs"><div><p className="text-muted-foreground">License</p><p className="mt-1 font-mono">{doctor.license_number || "—"}</p></div><div><p className="text-muted-foreground">Prescriptions</p><p className="mt-1 font-mono">{doctor.prescription_count}</p></div></div>{doctor.phone && <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3.5 w-3.5" />{doctor.phone}</p>}{canManage && <div className="mt-3 flex gap-2"><Button variant="outline" className="min-h-11 flex-1" onClick={() => setEditing(doctor)}><Edit3 className="mr-1.5 h-3.5 w-3.5" /> Edit</Button>{doctor.active === 1 && <Button variant="ghost" className="min-h-11 text-destructive" onClick={() => void deactivate(doctor)}><UserMinus className="mr-1.5 h-3.5 w-3.5" /> Deactivate</Button>}</div>}</article>)}</div>
        <div className="hidden overflow-hidden rounded-lg border border-border lg:block"><table className="w-full text-sm"><thead className="border-b border-border bg-muted/30"><tr className="text-xs text-muted-foreground"><th className="px-3 py-2 text-left font-medium">Name</th><th className="px-3 py-2 text-left font-medium">Specialty</th><th className="px-3 py-2 text-left font-medium">Hospital</th><th className="px-3 py-2 text-left font-medium">License</th><th className="px-3 py-2 text-right font-medium">Prescriptions</th><th className="px-3 py-2" /></tr></thead><tbody>{doctorList.pageRows.map((doctor) => <tr key={doctor.id} className="border-b border-border last:border-0 hover:bg-muted/30"><td className="px-3 py-2.5"><div className="font-medium">{doctor.full_name}</div>{doctor.phone && <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" /> {doctor.phone}</div>}</td><td className="px-3 py-2.5">{doctor.specialty ? <Badge variant="secondary">{doctor.specialty}</Badge> : "—"}</td><td className="px-3 py-2.5 text-muted-foreground">{doctor.hospital || "—"}</td><td className="px-3 py-2.5 font-mono text-xs">{doctor.license_number || "—"}</td><td className="px-3 py-2.5 text-right font-mono">{doctor.prescription_count}</td><td className="px-3 py-2.5 text-right">{canManage && <div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => setEditing(doctor)} aria-label={`Edit ${doctor.full_name}`}><Edit3 className="h-3.5 w-3.5" /></Button>{doctor.active === 1 && <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => void deactivate(doctor)} aria-label={`Deactivate ${doctor.full_name}`}><UserMinus className="h-3.5 w-3.5" /></Button>}</div>}</td></tr>)}</tbody></table></div>
        <PaginationBar list={doctorList.pagination} />
      </>}

      <DoctorForm open={creating || !!editing} doctor={editing} country={country} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); void load(); }} />
    </div>
  );
}

function DoctorForm({ open, doctor, country, onClose, onSaved }: { open: boolean; doctor: Doctor | null; country: ReturnType<typeof useCountry.getState>["code"]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Doctor>>({});
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { setForm(doctor ?? {}); }, [doctor, open]);
  const save = async () => { if (!form.full_name) { toast.error("Name is required"); return; } setSubmitting(true); try { await upsertDoctor({ ...form, full_name: form.full_name }); toast.success(doctor ? "Updated" : "Created"); onSaved(); } catch (error) { toast.error(String(error)); } finally { setSubmitting(false); } };
  return <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}><SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[460px]"><SheetHeader><SheetTitle>{doctor ? doctor.full_name : "New doctor"}</SheetTitle></SheetHeader><div className="mt-4 space-y-4"><Field label="Full name"><Input aria-label="Full name" value={form.full_name || ""} onChange={(event) => setForm({ ...form, full_name: event.target.value })} autoFocus /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="License number"><Input aria-label="License number" value={form.license_number || ""} onChange={(event) => setForm({ ...form, license_number: event.target.value })} placeholder="Professional license" /></Field><Field label="Specialty"><Select value={form.specialty || ""} onValueChange={(value) => setForm({ ...form, specialty: String(value ?? "") })}><SelectTrigger aria-label="Specialty"><SelectValue placeholder="Pick a specialty…" /></SelectTrigger><SelectContent>{SPECIALTIES.map((specialty) => <SelectItem key={specialty} value={specialty}>{specialty}</SelectItem>)}</SelectContent></Select></Field></div><Field label="Hospital / clinic"><Input aria-label="Hospital or clinic" value={form.hospital || ""} onChange={(event) => setForm({ ...form, hospital: event.target.value })} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Phone"><Input aria-label="Phone" value={form.phone || ""} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder={phonePlaceholder(country)} /></Field><Field label="Email"><Input aria-label="Email" type="email" value={form.email || ""} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field></div><Field label="Notes"><Textarea aria-label="Notes" value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field><div className="flex flex-col gap-2 pt-2 sm:flex-row"><Button variant="outline" onClick={onClose} className="min-h-11 flex-1" disabled={submitting}>Cancel</Button><Button onClick={() => void save()} className="min-h-11 flex-1" disabled={submitting}>{submitting ? "Saving…" : "Save"}</Button></div></div></SheetContent></Sheet>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><p className="text-xs font-medium text-muted-foreground">{label}</p>{children}</div>;
}
