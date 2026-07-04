import { useEffect, useState } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import {
  Certificate,
  Pencil as PencilSimple,
  Plus,
  Trash as Trash2,
  Warning as AlertTriangle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BackButton } from "@/components/ui/back-button";
import {
  listLicenses,
  upsertLicense,
  removeLicense,
  LICENSE_TYPE_LABELS,
  type PharmacyLicense,
  type LicenseType,
} from "@/services/pharmacy-licenses";
import { intlLocale } from "@/lib/intl";
import { toast } from "sonner";

export function SettingsPharmacyLicensesPage() {
  const [rows, setRows] = useState<PharmacyLicense[]>([]);
  const [editing, setEditing] = useState<Partial<PharmacyLicense> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listLicenses());
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const expiredCount = rows.filter((r) => r.computed_status === "expired").length;
  const expiringSoonCount = rows.filter((r) => r.computed_status === "expiring_soon").length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <BackButton fallback="/settings" />
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Certificate className="h-5 w-5 text-teal-600" /> Pharmacy licenses
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track premises + pharmacist practicing + PPB compliance expiry.
            Amber within 90 days, red once expired.
          </p>
        </div>
        <Button onClick={() => setEditing({ license_type: "premises" as LicenseType })}>
          <Plus className="h-4 w-4 mr-1.5" /> Add license
        </Button>
      </div>

      {(expiredCount > 0 || expiringSoonCount > 0) && (
        <Card className={expiredCount > 0 ? "border-destructive/50 bg-destructive/5" : "border-amber-500/50 bg-amber-500/5"}>
          <CardContent className="p-3 flex items-center gap-3">
            <AlertTriangle className={`h-5 w-5 ${expiredCount > 0 ? "text-destructive" : "text-amber-700"}`} />
            <div className="flex-1 text-sm">
              {expiredCount > 0 && <span className="font-semibold text-destructive">{expiredCount} expired · </span>}
              {expiringSoonCount > 0 && <span className="font-semibold text-amber-700">{expiringSoonCount} expiring within 90 days</span>}
              {expiringSoonCount === 0 && expiredCount > 0 && "Renew immediately to avoid PPB inspection findings."}
              {expiringSoonCount > 0 && " — start the renewal packet now."}
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Certificate}
          title="No licenses tracked yet"
          description="Add every statutory license required by PPB (premises, pharmacist practicing, controlled-substances permit)."
          cta={{ label: "Add license", onClick: () => setEditing({ license_type: "premises" as LicenseType }), icon: Plus }}
        />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-left px-3 py-2 font-medium">Number</th>
                <th className="text-left px-3 py-2 font-medium">Holder</th>
                <th className="text-left px-3 py-2 font-medium">Expires</th>
                <th className="text-center px-3 py-2 font-medium">Status</th>
                <th className="text-right px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2.5 text-xs">{LICENSE_TYPE_LABELS[r.license_type]}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{r.license_number}</td>
                  <td className="px-3 py-2.5 text-xs">{r.holder_name || "—"}</td>
                  <td className="px-3 py-2.5 text-xs">
                    {new Date(r.expires_at).toLocaleDateString(intlLocale(), { day: "2-digit", month: "short", year: "numeric" })}
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {r.days_to_expiry < 0
                        ? `Expired ${Math.abs(r.days_to_expiry)}d ago`
                        : `${r.days_to_expiry}d left`}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <StatusBadge status={r.computed_status} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>
                        <PencilSimple className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={async () => {
                          if (!(await confirm({ title: "Delete this license?" }))) return;
                          await removeLicense(r.id);
                          toast.success("Removed");
                          load();
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LicenseForm
        open={!!editing}
        license={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: PharmacyLicense["computed_status"] }) {
  if (status === "expired") return <Badge variant="destructive" className="text-[10px]">Expired</Badge>;
  if (status === "expiring_soon") return <Badge variant="outline" className="text-amber-700 border-amber-500 text-[10px]">Expiring</Badge>;
  if (status === "renewed") return <Badge variant="secondary" className="text-[10px]">Renewed</Badge>;
  return <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">Active</Badge>;
}

function LicenseForm({
  open, license, onClose, onSaved,
}: {
  open: boolean; license: Partial<PharmacyLicense> | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<PharmacyLicense>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (license) setForm(license);
    else setForm({});
  }, [license, open]);

  const save = async () => {
    if (!form.license_type || !form.license_number || !form.expires_at) {
      toast.error("Type, number, and expiry date are required");
      return;
    }
    setSaving(true);
    try {
      await upsertLicense({
        ...form,
        license_type: form.license_type as LicenseType,
        license_number: form.license_number,
        expires_at: form.expires_at,
      });
      toast.success(license?.id ? "Updated" : "Added");
      onSaved();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[460px] sm:max-w-[460px]">
        <SheetHeader>
          <SheetTitle>{license?.id ? "Edit license" : "Add license"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 mt-4">
          <Field label="Type">
            <Select
              value={form.license_type || ""}
              onValueChange={(v) => setForm({ ...form, license_type: v as LicenseType })}
            >
              <SelectTrigger><SelectValue placeholder="Pick a type…" /></SelectTrigger>
              <SelectContent>
                {(Object.keys(LICENSE_TYPE_LABELS) as LicenseType[]).map((k) => (
                  <SelectItem key={k} value={k}>{LICENSE_TYPE_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="License number *">
            <Input value={form.license_number || ""} onChange={(e) => setForm({ ...form, license_number: e.target.value })} />
          </Field>
          <Field label="Holder name">
            <Input value={form.holder_name || ""} onChange={(e) => setForm({ ...form, holder_name: e.target.value })} placeholder="Pharmacist / premises name" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Issued">
              <Input type="date" value={form.issued_at || ""} onChange={(e) => setForm({ ...form, issued_at: e.target.value })} />
            </Field>
            <Field label="Expires *">
              <Input type="date" value={form.expires_at || ""} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
            </Field>
          </div>
          <Field label="Status">
            <Select
              value={form.status || "active"}
              onValueChange={(v) => setForm({ ...form, status: v as PharmacyLicense["status"] })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="renewed">Renewed</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Notes">
            <Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Renewal deadline notes, filing status…" />
          </Field>
          <div className="pt-3 flex gap-2">
            <Button onClick={save} disabled={saving} className="flex-1">
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}
