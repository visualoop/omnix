import { useState, useEffect } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import {
  Building as Building2,
  Calendar,
  Check,
  CheckCircle as CheckCircle2,
  CircleNotch as Loader2,
  Copy,
  Cpu,
  Envelope as Mail,
  Key as Key,
  ShieldCheck,
  Trash as Trash2,
  Warning as AlertTriangle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  getLicenseStatus,
  deactivateLicense,
  activateLicense,
  revalidateLicense,
  type LicenseStatus,
} from "@/services/license";
import { APP_NAME } from "@/lib/brand";
import { LICENSE_PREFIX } from "@/lib/variant";
import { toast } from "sonner";
import { intlLocale } from "@/lib/intl";

import { BackButton } from "@/components/ui/back-button";
export function LicensePage() {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [copied, setCopied] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setStatus(await getLicenseStatus());
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await revalidateLicense();
      if (result === null) {
        toast.error("Couldn't reach the licensing server — check your internet.");
      } else {
        await load();
        toast.success("Licence refreshed");
      }
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCopyMachineId = async () => {
    if (!status) return;
    await navigator.clipboard.writeText(status.machine.formatted);
    setCopied(true);
    toast.success("Machine ID copied");
    setTimeout(() => setCopied(false), 2000);
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
    return <NoLicenseOrTrialView status={status} onActivated={load} />;
  }

  const license = status.license;
  const maintenanceWarning = status.maintenance_days_remaining < 30;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <BackButton fallback="/" />
          <h1 className="text-xl font-semibold tracking-tight">License</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your {APP_NAME} license details and machine binding
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="cursor-pointer">
          {refreshing ? "Checking…" : "Check for updates"}
        </Button>
      </div>

      {/* Active status */}
      <div className="border border-green-500/50 bg-green-500/5 rounded-lg p-4 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium">License Active</p>
          <p className="text-sm text-muted-foreground mt-1">
            Activated on {new Date(license.activated_at).toLocaleDateString(intlLocale(), { day: "numeric", month: "long", year: "numeric" })}
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
                  Active until <span className="font-medium">{new Date(license.maintenance_expires_at).toLocaleDateString(intlLocale(), { day: "numeric", month: "long", year: "numeric" })}</span>
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
        <DetailRow icon={Calendar} label="Issued" value={new Date(license.issued_at).toLocaleDateString(intlLocale(), { day: "numeric", month: "long", year: "numeric" })} />
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


/**
 * Renders the license page when there's no active perpetual license. Three sub-cases:
 *  - Trial running         → green "trial active" banner + days remaining + activation form
 *  - Trial expired         → amber banner + activation form
 *  - Truly no license      → amber banner + activation form
 *
 * The activation form lets users upgrade in place without restarting the app —
 * fixed the old "deactivated, restart to enter a key" deadlock for trial users
 * who had no UI surface to upgrade.
 */
function NoLicenseOrTrialView({
  status,
  onActivated,
}: {
  status: LicenseStatus;
  onActivated: () => void;
}) {
  const [key, setKey] = useState("");
  const [activating, setActivating] = useState(false);

  const trial = status.trial;
  const isTrial = !!trial?.active;
  const trialExpired = !!trial && !trial.active;

  const handleActivate = async () => {
    const cleaned = key.trim().replace(/\s+/g, "").toUpperCase();
    if (!cleaned) return;
    setActivating(true);
    try {
      const result = await activateLicense(cleaned);
      if (!result.ok) {
        toast.error(result.error ?? "Activation failed");
        return;
      }
      toast.success("License activated");
      setKey("");
      onActivated();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">License</h1>
        <p className="text-sm text-muted-foreground mt-1">Activate {APP_NAME} or manage your trial</p>
      </div>

      {/* Status banner */}
      {isTrial ? (
        <div className="border border-blue-500/50 bg-blue-500/5 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Trial active</p>
            <p className="text-sm text-muted-foreground mt-1">
              {trial!.days_remaining} day{trial!.days_remaining === 1 ? "" : "s"} remaining.
              Enter a license key below to activate {APP_NAME} permanently.
            </p>
          </div>
        </div>
      ) : (
        <div className="border border-amber-500/50 bg-amber-500/5 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{trialExpired ? "Trial expired" : "No active license"}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {trialExpired
                ? `Your trial has ended. Enter a license key to keep using ${APP_NAME}.`
                : `Enter your license key below or buy one at omnix.co.ke.`}
            </p>
          </div>
        </div>
      )}

      {/* Inline activation form */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">Activate with a license key</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Paste the license key from your purchase email (looks like{" "}
          <span className="font-mono text-foreground">{LICENSE_PREFIX}-XXXX-XXXX-…</span>).
        </p>
        <div className="flex gap-2">
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleActivate()}
            placeholder={`${LICENSE_PREFIX}-XXXX-XXXX-XXXX`}
            className="font-mono text-xs"
            disabled={activating}
            autoFocus
          />
          <Button onClick={handleActivate} disabled={activating || !key.trim()} className="cursor-pointer">
            {activating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Activate"}
          </Button>
        </div>
      </div>

      {/* Buy link */}
      <div className="text-xs text-muted-foreground">
        Don't have a key?{" "}
        <a
          href="https://omnix.co.ke/buy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Buy a license
        </a>{" "}
        — your key is emailed to you immediately after payment.
      </div>
    </div>
  );
}
