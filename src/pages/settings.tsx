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
