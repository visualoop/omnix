import { useState, useEffect } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import {
  ShieldCheck,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Calendar,
  Mail,
  Building2,
  Trash2,
  Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  getLicenseStatus,
  deactivateLicense,
  activateLicense,
  type LicenseStatus,
} from "@/services/license";
import { APP_NAME } from "@/lib/brand";
import { toast } from "sonner";

export function LicensePage() {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [copied, setCopied] = useState(false);
  const [licenseKey, setLicenseKey] = useState("");
  const [activating, setActivating] = useState(false);

  const load = async () => {
    setStatus(await getLicenseStatus());
  };

  useEffect(() => { load(); }, []);

  const handleCopyMachineId = async () => {
    if (!status) return;
    await navigator.clipboard.writeText(status.machine.formatted);
    setCopied(true);
    toast.success("Machine ID copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      toast.error("Please enter a license key");
      return;
    }
    setActivating(true);
    try {
      const result = await activateLicense(licenseKey.trim());
      if (result.ok) {
        toast.success("License activated successfully");
        await load();
        setLicenseKey("");
      } else {
        toast.error(result.error || "Failed to activate license");
      }
    } catch (error) {
      toast.error("Failed to activate license");
      console.error(error);
    } finally {
      setActivating(false);
    }
  };

  const handleDeactivate = async () => {
    if (!(await confirm({ title: `Deactivate this license?\n\nYou will need to enter the key again to use ${APP_NAME} on this machine.` }))) return;
    await deactivateLicense();
    toast.success("License deactivated");
    load();
  };

  if (!status) {
    return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  }

  if (!status.activated || !status.license) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="space-y-6 max-w-md w-full">
          <div className="text-center space-y-2">
            <ShieldCheck className="h-12 w-12 mx-auto text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Activate {APP_NAME}</h1>
            <p className="text-sm text-muted-foreground">
              Enter your license key to continue
            </p>
          </div>

          <div className="border border-border rounded-lg p-5 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">License Key</label>
              <Input
                type="text"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleActivate()}
                disabled={activating}
                className="font-mono"
              />
            </div>

            <Button
              onClick={handleActivate}
              disabled={activating || !licenseKey.trim()}
              className="w-full"
            >
              {activating ? "Activating..." : "Activate License"}
            </Button>
          </div>

          <div className="border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Machine ID</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Provide this ID when purchasing or activating your license
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded font-mono text-sm tracking-wide">
                {status.machine.formatted}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopyMachineId}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Need a license? Visit <span className="font-medium">sokoos.co.ke</span>
          </p>
        </div>
      </div>
    );
  }

  const license = status.license;
  const maintenanceWarning = status.maintenance_days_remaining < 30;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">License</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your {APP_NAME} license details and machine binding
        </p>
      </div>

      {/* Active status */}
      <div className="border border-green-500/50 bg-green-500/5 rounded-lg p-4 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium">License Active</p>
          <p className="text-sm text-muted-foreground mt-1">
            Activated on {new Date(license.activated_at).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <Badge variant="default" className="bg-green-600 hover:bg-green-600">
          {license.license_type}
        </Badge>
      </div>

      {/* Maintenance status */}
      <div className={`border rounded-lg p-4 ${
        maintenanceWarning
          ? "border-amber-500/50 bg-amber-500/5"
          : "border-border"
      }`}>
        <div className="flex items-start gap-3">
          <Calendar className={`h-5 w-5 shrink-0 mt-0.5 ${
            maintenanceWarning ? "text-amber-600" : "text-primary"
          }`} />
          <div className="flex-1">
            <p className="font-medium">Maintenance & Updates</p>
            {status.maintenance_active ? (
              <>
                <p className="text-sm mt-1">
                  Active until <span className="font-medium">{new Date(license.maintenance_expires_at).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {status.maintenance_days_remaining} days remaining — receive eTIMS, SHA, and other compliance updates
                </p>
              </>
            ) : (
              <>
                <p className="text-sm mt-1 text-amber-700 font-medium">Maintenance expired</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your license still works, but you won't receive updates. Renew for KES 12,000/year.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Customer details */}
      <div className="border border-border rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">License Details</h2>

        <DetailRow icon={Building2} label="Customer" value={license.customer_name} />
        <DetailRow icon={Mail} label="Email" value={license.customer_email} />
        <DetailRow icon={Key} label="License ID" value={license.license_kid} mono />
        <DetailRow icon={Calendar} label="Issued" value={new Date(license.issued_at).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })} />
      </div>

      {/* Machine binding */}
      <div className="border border-border rounded-lg p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Machine Binding</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          This license is bound to the machine fingerprint below. To install on another machine, contact support to deactivate this binding.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-muted px-3 py-2 rounded font-mono text-sm tracking-wide">
            {status.machine.formatted}
          </code>
          <Button variant="outline" size="sm" onClick={handleCopyMachineId}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Features */}
      <div className="border border-border rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Enabled Features</h2>
        <div className="flex flex-wrap gap-2">
          {status.features.map((f) => (
            <Badge key={f} variant="outline" className="capitalize">
              <ShieldCheck className="h-3 w-3 mr-1" /> {f.replace(/_/g, " ")}
            </Badge>
          ))}
        </div>
      </div>

      {/* Danger zone */}
      <div className="border border-red-500/30 bg-red-500/5 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold text-red-700">Danger Zone</h2>
        <p className="text-xs text-muted-foreground">
          Deactivating will remove the license from this machine. You'll need to enter the key again to continue using {APP_NAME}.
        </p>
        <Button variant="destructive" onClick={handleDeactivate} size="sm">
          <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Deactivate License
        </Button>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon, label, value, mono,
}: {
  icon: typeof Building2; label: string; value: string; mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{value}</span>
    </div>
  );
}
