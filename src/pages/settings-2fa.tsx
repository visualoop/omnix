/**
 * /settings/2fa — enable / disable Two-Factor Authentication for the current user.
 *
 * Flow:
 *   1. If 2FA is off: click "Enable" → generate secret → show QR + manual code →
 *      user scans in Google Authenticator / Authy / MS Authenticator →
 *      user types 6-digit code to confirm → 2FA is enabled + backup codes shown.
 *   2. If 2FA is on: shows status + "Disable" button (requires current code to disable).
 *
 * The secret + backup codes live in localStorage keyed by user id. Losing that
 * key = losing 2FA (use one of the backup codes to disable then re-enrol).
 */
import { useEffect, useState } from "react";
import {
  ShieldCheck as ShieldCheckIcon,
  Warning as AlertTriangle,
  CheckCircle,
  Copy as CopyIcon,
  ArrowClockwise as RefreshCw,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";
import {
  start2FAEnrollment,
  confirm2FAEnrollment,
  is2FAEnabled,
  disable2FA,
  verify2FACode,
  type TwoFASetup,
} from "@/services/two-factor";
import { confirm, prompt } from "@/components/ui/confirm-dialog";

export function Settings2FAPage() {
  const { user } = useAuthStore();
  const [enabled, setEnabled] = useState(false);
  const [enrollment, setEnrollment] = useState<TwoFASetup | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    setEnabled(is2FAEnabled(user.id));
  }, [user?.id]);

  if (!user) {
    return <div className="p-6 text-sm text-muted-foreground">Sign in first.</div>;
  }

  const startEnrol = () => {
    const setup = start2FAEnrollment(user.id, user.username || "user");
    setEnrollment(setup);
    setCode("");
    setBackupCodes(null);
  };

  const confirmEnrol = async () => {
    if (!enrollment) return;
    if (code.length !== 6) {
      toast.error("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    try {
      const ok = await confirm2FAEnrollment(enrollment, code);
      if (!ok) {
        toast.error("Code didn't match. Double-check your app's time is in sync and try again.");
        return;
      }
      setBackupCodes(enrollment.backup_codes);
      setEnabled(true);
      setEnrollment(null);
      setCode("");
      toast.success("Two-factor authentication enabled.");
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    const ok = await confirm({
      title: "Disable two-factor authentication?",
      description: "Anyone with your password will be able to sign in. You'll need to re-enrol to re-enable.",
      confirmText: "Disable 2FA",
      variant: "destructive",
    });
    if (!ok) return;

    const disableCode = await prompt({
      title: "Confirm disable",
      description: "Enter your current 6-digit code (or a backup code) to confirm.",
      placeholder: "000000",
    });
    if (!disableCode) return;

    const valid = await verify2FACode(user.id, disableCode.replace(/\s/g, ""));
    if (!valid) {
      toast.error("Code didn't match. 2FA remains enabled.");
      return;
    }
    disable2FA(user.id);
    setEnabled(false);
    setEnrollment(null);
    setBackupCodes(null);
    toast.success("Two-factor authentication disabled.");
  };

  const copyBackup = () => {
    if (!backupCodes) return;
    void navigator.clipboard.writeText(backupCodes.join("\n"));
    toast.success("Backup codes copied to clipboard.");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <ShieldCheckIcon className="h-5 w-5 text-primary" /> Two-factor authentication
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Adds a 6-digit code from your phone on every sign-in. Even if someone gets your password,
          they still can&rsquo;t open your till without your phone.
        </p>
      </header>

      {enabled ? (
        <section className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 mt-0.5 text-emerald-600 shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium">2FA is enabled on this account</div>
              <p className="text-[13px] text-muted-foreground mt-1">
                Sign-ins from any device will now prompt for a 6-digit code.
              </p>
              <div className="mt-3">
                <Button size="sm" variant="destructive" onClick={handleDisable}>
                  Disable 2FA
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : enrollment ? (
        <section className="rounded-lg border border-border p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">1 · Scan this in your authenticator app</h3>
            <p className="text-[12px] text-muted-foreground mt-1">
              Use Google Authenticator, Microsoft Authenticator, or Authy.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <QrCode uri={enrollment.uri} />
            <div className="flex-1 space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Or type this key manually
              </div>
              <div className="font-mono text-[13px] break-all rounded bg-muted p-2">
                {enrollment.secret}
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold">2 · Enter the 6-digit code shown in your app</h3>
            <div className="flex gap-2 mt-2">
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="000000"
                className="w-32 font-mono tracking-wider text-center text-lg"
              />
              <Button onClick={confirmEnrol} disabled={code.length !== 6 || busy}>
                {busy ? "Verifying…" : "Confirm & enable"}
              </Button>
              <Button variant="ghost" onClick={() => setEnrollment(null)}>Cancel</Button>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-border p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium">2FA is off for this account</div>
              <p className="text-[13px] text-muted-foreground mt-1">
                Anyone with your password can sign in. Highly recommended for owner + manager accounts.
              </p>
              <div className="mt-3">
                <Button size="sm" onClick={startEnrol}>
                  Enable 2FA
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {backupCodes && (
        <section className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3 className="text-sm font-semibold">Save these backup codes</h3>
              <p className="text-[12px] text-muted-foreground mt-1">
                If you lose your phone, use one of these codes to sign in and reset 2FA. Each code
                works once. Store them somewhere safe — a password manager or printed and locked away.
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-3 font-mono text-[13px]">
                {backupCodes.map((c) => (
                  <div key={c} className="tracking-wider">{c}</div>
                ))}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={copyBackup}>
              <CopyIcon className="h-4 w-4 mr-1.5" /> Copy
            </Button>
          </div>
        </section>
      )}

      <section className="text-[12px] text-muted-foreground border-t border-border pt-4 space-y-2">
        <div className="flex items-start gap-2">
          <RefreshCw className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            2FA settings are per-device. If you switch machines, you&rsquo;ll be asked to re-enrol.
          </span>
        </div>
      </section>
    </div>
  );
}

/** Simple QR-code renderer using a well-known public API for the enrolment URI. */
function QrCode({ uri }: { uri: string }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(uri)}`;
  return (
    <img
      src={src}
      alt="2FA QR code"
      className="w-40 h-40 rounded border border-border bg-white"
      loading="lazy"
    />
  );
}
