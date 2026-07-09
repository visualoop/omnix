import { useState, useEffect } from "react";
import {
  Building as Building2,
  CircleNotch as Loader2,
  FloppyDisk as Save,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { query, execute } from "@/lib/db";
import { toast } from "sonner";

interface Business {
  id: string;
  name: string;
  type: string;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export function SettingsPage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);

  const load = async () => {
    const rows = await query<Business>("SELECT * FROM business LIMIT 1");
    if (rows[0]) {
      setBusiness(rows[0]);
      setForm({
        name: rows[0].name,
        address: rows[0].address || "",
        phone: rows[0].phone || "",
        email: rows[0].email || "",
      });
    }
    const lr = await query<{ value: string }>("SELECT value FROM settings WHERE key = 'business.logo_path'");
    setLogo(lr[0]?.value ?? null);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!business) return;
    setSaving(true);
    try {
      await execute(
        `UPDATE business SET name = ?1, address = ?2, phone = ?3, email = ?4 WHERE id = ?5`,
        [form.name, form.address, form.phone, form.email, business.id],
      );
      toast.success("Business profile updated");
      setDirty(false);
      load();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const saveLogo = async (dataUrl: string | null) => {
    try {
      await execute(
        `INSERT INTO settings (key, value) VALUES ('business.logo_path', ?1)
         ON CONFLICT(key) DO UPDATE SET value = ?1`,
        [dataUrl ?? ""],
      );
      setLogo(dataUrl);
      toast.success(dataUrl ? "Logo updated" : "Logo removed");
    } catch (e) { toast.error(String(e)); }
  };

  const onLogoFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Choose an image file (PNG/JPG)."); return; }
    if (file.size > 1_000_000) { toast.error("Logo must be under 1 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => saveLogo(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="border border-border rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Business profile</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Business name *">
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="0700 000 000" />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="info@business.co.ke" />
          </Field>
          <Field label="Module type">
            <Input value={business?.type || ""} disabled className="capitalize" />
          </Field>
        </div>
        <Field label="Address">
          <Input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="e.g., Moi Avenue, Nairobi" />
        </Field>

        <Field label="Business logo">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
              {logo ? <img src={logo} alt="Business logo" className="h-full w-full object-contain" /> : <Building2 className="h-6 w-6 text-muted-foreground" />}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[12px] font-medium cursor-pointer hover:bg-accent w-fit">
                {logo ? "Replace logo" : "Upload logo"}
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => onLogoFile(e.target.files?.[0])} />
              </label>
              {logo && (
                <button type="button" onClick={() => saveLogo(null)} className="text-[11px] text-destructive hover:underline w-fit">Remove logo</button>
              )}
              <span className="text-[11px] text-muted-foreground">PNG or JPG, under 1 MB. Used on receipts, invoices, the customer display and app chrome.</span>
            </div>
          </div>
        </Field>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving || !dirty || !form.name}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : <><Save className="h-4 w-4 mr-2" /> Save changes</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
