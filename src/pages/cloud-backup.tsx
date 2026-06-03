/**
 * Cloud Backup settings page.
 *
 * Wraps the three Tauri cloud_backup_* commands with a UI:
 *   - Manual "Back up now" with password prompt
 *   - List of remote backups for this licence
 *   - Restore from any backup with password prompt
 *
 * The customer's "backup password" is NEVER persisted. We prompt every time.
 * The encryption key derives from password + machineId, so the same password
 * that was used to upload must be used to restore.
 */
import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Cloud, CloudUpload, CloudDownload, Loader2, Lock, AlertTriangle,
  Calendar, HardDrive, CheckCircle2, RefreshCw, Clock, Power,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { confirm, prompt } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { getScheduleConfig, setScheduleConfig, nextRunAt } from "@/hooks/use-auto-cloud-backup";
import { getMachineAuthToken } from "@/services/license";

interface CloudBackupRow {
  id: string;
  objectKey: string;
  machineId?: string | null;
  desktopVersion?: string | null;
  sizeBytes?: number | null;
  sha256?: string | null;
  createdAt?: string | null;
  finalizedAt?: string | null;
  pruneAfter?: string | null;
  clientKeyHint?: string | null;
}

interface UploadResult {
  object_key: string;
  size_bytes: number;
  sha256: string;
}

const API_BASE = "https://omnix.co.ke";

function formatBytes(n?: number | null): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-KE", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export function CloudBackupPage() {
  const [authToken, setAuthToken] = useState<string>("");
  const [backups, setBackups] = useState<CloudBackupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Pull the machine auth token from the local license store on mount.
  useEffect(() => {
    (async () => {
      try {
        const token = (await getMachineAuthToken()) ?? "";
        setAuthToken(token);
      } catch {
        setAuthToken("");
      }
    })();
  }, []);

  const refresh = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const list = await invoke<CloudBackupRow[]>("cloud_backup_list", {
        apiBase: API_BASE,
        authToken,
      });
      setBackups(list);
    } catch (e) {
      toast.error(`Could not list backups: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleUploadNow = async () => {
    if (!authToken) {
      toast.error("Activate your licence first — cloud backup needs a machine token.");
      return;
    }
    const password = await prompt({
      title: "Backup password",
      description:
        "This password encrypts your backup. You'll need it again to restore. We do not store it.",
      placeholder: "Enter a strong password",
    });
    if (!password || password.length < 8) {
      if (password !== null) toast.error("Use at least 8 characters.");
      return;
    }

    setUploading(true);
    try {
      const result = await invoke<UploadResult>("cloud_backup_upload", {
        apiBase: API_BASE,
        authToken,
        password,
        desktopVersion: __APP_VERSION__,
      });
      toast.success(
        `Backup uploaded · ${formatBytes(result.size_bytes)}`,
        { description: `Key: ${result.object_key.slice(0, 30)}…` },
      );
      await refresh();
    } catch (e) {
      const msg = String(e);
      if (msg.includes("402")) toast.error("Cloud backup not active on your licence. Buy or renew to enable.");
      else if (msg.includes("403")) toast.error("Cloud backup is disabled site-wide right now.");
      else toast.error(`Upload failed: ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  const handleRestore = async (row: CloudBackupRow) => {
    const ok = await confirm({
      title: "Restore from this backup?",
      description:
        "This replaces the current database with the backup. The app will close and you'll relaunch.",
      confirmText: "Restore",
      variant: "destructive",
    });
    if (!ok) return;

    const password = await prompt({
      title: "Backup password",
      description: "Enter the password used when this backup was created.",
      placeholder: "Password",
    });
    if (!password) return;

    try {
      const stagingFile = await invoke<string>("cloud_backup_restore", {
        apiBase: API_BASE,
        authToken,
        backupId: row.id,
        password,
      });
      // Apply the staged file over the live DB (with safety snapshot).
      const safetyPath = await invoke<string>("apply_cloud_restore", {
        stagingPath: stagingFile,
      });
      toast.success("Restore applied. Restart Omnix to load the restored database.", {
        description: `Safety snapshot: ${safetyPath.split("/").pop()}`,
        duration: 12_000,
      });
    } catch (e) {
      const msg = String(e);
      if (msg.includes("decrypt") || msg.includes("wrong password")) {
        toast.error("Wrong password — that backup was encrypted with a different one.");
      } else {
        toast.error(`Restore failed: ${msg}`);
      }
    }
  };

  if (!authToken) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 p-5 flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div className="text-sm">
          <div className="font-medium">Cloud backup needs an activated licence</div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Activate Omnix from <span className="font-mono">/settings/license</span> first. Cloud backup
            uses your machine auth token to upload to media.omnix.co.ke.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hero card */}
      <div className="glass rounded-glass-lg p-5 flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-500/30 to-blue-500/5 ring-1 ring-inset ring-blue-500/15">
          <Cloud className="h-5 w-5 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight">Cloud backup</div>
          <p className="text-[11.5px] text-muted-foreground leading-snug mt-0.5">
            Encrypted offsite copies of your database. AES-256-GCM with a password-derived key — we cannot decrypt your data.
          </p>
        </div>
        <Button
          onClick={handleUploadNow}
          disabled={uploading}
          className="rounded-xl shadow-native cursor-pointer"
        >
          {uploading ? (
            <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Uploading…</>
          ) : (
            <><CloudUpload className="h-4 w-4 mr-1.5" /> Back up now</>
          )}
        </Button>
      </div>

      <AutoScheduleCard />

      {/* Backup list */}
      <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              Backups
            </span>
            {backups.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">{backups.length}</Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="h-7 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {loading && backups.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading backups…
          </div>
        ) : backups.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Cloud className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No cloud backups yet.</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Click <strong>Back up now</strong> to create your first.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border/40">
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Size</th>
                <th className="px-4 py-2">Version</th>
                <th className="px-4 py-2">Key hint</th>
                <th className="px-4 py-2 text-right">—</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id} className="border-b border-border/30 last:border-0 hover:bg-foreground/[0.02]">
                  <td className="px-4 py-3 text-[12.5px]">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatDate(b.finalizedAt ?? b.createdAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12.5px] font-mono tabular-nums">
                    <div className="flex items-center gap-1.5">
                      <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatBytes(b.sizeBytes)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-muted-foreground">{b.desktopVersion ?? "—"}</td>
                  <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground">
                    {b.clientKeyHint ? (
                      <span className="inline-flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        {b.clientKeyHint}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(b)}
                      className="rounded-lg cursor-pointer"
                    >
                      <CloudDownload className="h-3.5 w-3.5 mr-1" /> Restore
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footnote */}
      <div className="rounded-xl glass-thin px-4 py-3 flex items-start gap-2.5">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
        <div className="text-[11.5px] text-muted-foreground leading-relaxed">
          Backups are encrypted on this device before they leave. The password never reaches our
          servers. If you lose the password, the backup cannot be recovered — keep it somewhere safe.
        </div>
      </div>
    </div>
  );
}

// Vite injects this. Falls back to "dev" when the constant isn't defined.
declare const __APP_VERSION__: string | undefined;

function AutoScheduleCard() {
  const [enabled, setEnabled] = useState(false);
  const [intervalHours, setIntervalHoursLocal] = useState(24);
  const [lastRun, setLastRun] = useState(0);
  const [hasKey, setHasKey] = useState(false);

  const refresh = useCallback(async () => {
    const cfg = await getScheduleConfig();
    setEnabled(cfg.enabled);
    setIntervalHoursLocal(cfg.intervalHours);
    setLastRun(cfg.lastRun);
    try {
      setHasKey(await invoke<boolean>("cloud_backup_has_session_key"));
    } catch {
      setHasKey(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onToggle = async (next: boolean) => {
    setEnabled(next);
    await setScheduleConfig({ enabled: next });
    if (next && !hasKey) {
      toast.warning("Auto-backup needs your sign-in password.", {
        description: "Sign out and back in so the key is loaded into memory.",
        duration: 8000,
      });
    } else if (next) {
      toast.success("Auto-backup enabled.");
    }
  };

  const onIntervalChange = async (n: number) => {
    setIntervalHoursLocal(n);
    await setScheduleConfig({ intervalHours: n });
  };

  const next = nextRunAt({ enabled, intervalHours, lastRun });
  const formatDelta = (ms: number) => {
    if (ms <= 0) return "due now";
    const m = Math.round(ms / 60_000);
    if (m < 60) return `in ${m} min`;
    const h = Math.round(m / 60);
    if (h < 48) return `in ${h} h`;
    return `in ${Math.round(h / 24)} d`;
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500/30 to-violet-500/5 ring-1 ring-inset ring-violet-500/15">
          <Clock className="h-4 w-4 text-violet-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight">Daily auto-backup</div>
          <p className="text-[11.5px] text-muted-foreground leading-snug mt-0.5">
            Runs in the background while you're signed in. Uses the password from your sign-in — no extra prompts.
          </p>
        </div>
        <div className="flex items-center gap-2 pt-0.5">
          <Switch checked={enabled} onCheckedChange={onToggle} />
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px]">
        <div className="rounded-xl border border-border/40 bg-foreground/[0.02] px-3 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Interval</div>
          <select
            value={intervalHours}
            onChange={(e) => onIntervalChange(parseInt(e.target.value, 10))}
            disabled={!enabled}
            className="w-full bg-transparent text-[13px] font-medium focus:outline-none disabled:opacity-50 cursor-pointer"
          >
            <option value={1}>Every hour</option>
            <option value={6}>Every 6 hours</option>
            <option value={12}>Every 12 hours</option>
            <option value={24}>Every 24 hours</option>
            <option value={168}>Every 7 days</option>
          </select>
        </div>
        <div className="rounded-xl border border-border/40 bg-foreground/[0.02] px-3 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Last run</div>
          <div className="text-[13px] font-medium">
            {lastRun ? new Date(lastRun).toLocaleString("en-KE", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }) : "Never"}
          </div>
        </div>
        <div className="rounded-xl border border-border/40 bg-foreground/[0.02] px-3 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Next run</div>
          <div className="text-[13px] font-medium">
            {enabled ? formatDelta(next - Date.now()) : "Off"}
          </div>
        </div>
      </div>

      {/* Key status */}
      {!hasKey && enabled && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 px-3 py-2 flex items-center gap-2 text-[12px]">
          <Power className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          <span>
            Encryption key not loaded — sign out and back in so backups can run unattended.
          </span>
        </div>
      )}
    </div>
  );
}

