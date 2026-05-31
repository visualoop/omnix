import { useState, useEffect } from "react";
import { Building2, Save, Loader2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UpdateChecker } from "@/components/update-checker";
import { query, execute } from "@/lib/db";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/brand";

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
          <h2 className="text-sm font-semibold">Business Profile</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Business Name *">
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
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : <><Save className="h-4 w-4 mr-2" /> Save Changes</>}
          </Button>
        </div>
      </div>

      <UpdateChecker />
      <AutostartToggle />
    </div>
  );
}

function AutostartToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    import("@/services/autostart").then(({ getAutostartEnabled }) =>
      getAutostartEnabled().then((v) => {
        setEnabled(v);
        setLoading(false);
      }),
    );
  }, []);

  const toggle = async (next: boolean) => {
    setUpdating(true);
    try {
      const { setAutostartEnabled } = await import("@/services/autostart");
      await setAutostartEnabled(next);
      setEnabled(next);
      toast.success(next ? "Will start with Windows" : "Auto-start disabled");
    } catch (e) {
      toast.error("Failed to update auto-start: " + e);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Power className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">Start with Windows</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Recommended for the master device. {APP_NAME} will launch automatically when this PC boots,
        so the LAN server is always reachable from cashier stations.
      </p>
      {loading ? (
        <p className="text-xs text-muted-foreground">Checking...</p>
      ) : (
        <label className="flex items-center justify-between text-sm cursor-pointer">
          <span>{enabled ? "Enabled" : "Disabled"}</span>
          <input type="checkbox" checked={enabled} onChange={(e) => toggle(e.target.checked)} disabled={updating} className="rounded" />
        </label>
      )}
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
