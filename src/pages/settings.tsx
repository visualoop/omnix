import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  CreditCard,
  FileCheck,
  Shield,
  Users,
  Key,
  ChevronRight,
  Save,
  Loader2,
  Database,
  Activity,
  Network,
  Boxes,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UpdateChecker } from "@/components/update-checker";
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

interface SettingsLink {
  to: string;
  label: string;
  description: string;
  icon: typeof Building2;
}

const SETTINGS_LINKS: SettingsLink[] = [
  {
    to: "/settings/payments",
    label: "Payment Methods",
    description: "Configure Paystack M-Pesa STK push",
    icon: CreditCard,
  },
  {
    to: "/settings/etims",
    label: "KRA eTIMS",
    description: "Tax invoice signing via VSCU",
    icon: FileCheck,
  },
  {
    to: "/settings/insurance",
    label: "Insurance Providers",
    description: "SHA and private insurer configuration",
    icon: Shield,
  },
  {
    to: "/settings/users",
    label: "Users & Permissions",
    description: "Manage who can sign in",
    icon: Users,
  },
  {
    to: "/settings/network",
    label: "Network",
    description: "LAN multi-device: master/client mode",
    icon: Network,
  },
  {
    to: "/settings/modules",
    label: "Modules",
    description: "Installed business modules (Core, Dawa) and roadmap",
    icon: Boxes,
  },
  {
    to: "/settings/backup",
    label: "Backup & Restore",
    description: "Protect your data with manual or scheduled backups",
    icon: Database,
  },
  {
    to: "/audit",
    label: "Audit Log",
    description: "Activity history for compliance and security",
    icon: Activity,
  },
  {
    to: "/settings/license",
    label: "License",
    description: "View license details and machine binding",
    icon: Key,
  },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const [business, setBusiness] = useState<Business | null>(null);
  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
  });
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
        [form.name, form.address, form.phone, form.email, business.id]
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
    setForm({ ...form, [field]: value });
    setDirty(true);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your business and integrations
        </p>
      </div>

      {/* Business profile */}
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
            <Input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="info@yourpharmacy.co.ke"
            />
          </Field>
          <Field label="Type">
            <Input value={business?.type || "pharmacy"} disabled className="capitalize" />
          </Field>
        </div>
        <Field label="Address">
          <Input
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            placeholder="e.g., Moi Avenue, Nairobi"
          />
        </Field>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving || !dirty || !form.name}>
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" /> Save Changes</>
            )}
          </Button>
        </div>
      </div>

      {/* Settings links */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Configuration</h2>
        <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
          {SETTINGS_LINKS.map((link) => (
            <button
              key={link.to}
              onClick={() => navigate(link.to)}
              className="w-full flex items-center gap-3 p-4 hover:bg-accent/30 transition-colors text-left"
            >
              <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <link.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{link.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{link.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Software updates */}
      <UpdateChecker />
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
