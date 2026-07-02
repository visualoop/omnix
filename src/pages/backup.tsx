import { useState, useEffect } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import { invoke } from "@tauri-apps/api/core";
import {
  Calendar,
  CheckCircle as CheckCircle2,
  CircleNotch as Loader2,
  Database,
  Download,
  HardDrive,
  Plus,
  Trash as Trash2,
  UploadSimple as Upload,
  Warning as AlertTriangle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { query, execute } from "@/lib/db";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/brand";
import { intlLocale } from "@/lib/intl";

import { BackButton } from "@/components/ui/back-button";
interface BackupInfo {
  filename: string;
  path: string;
  size_bytes: number;
  created_at: string;
}

const SCHEDULE_KEY = "backup.schedule";  // "off" | "daily" | "weekly"
const LAST_AUTO_BACKUP_KEY = "backup.last_auto_at";

export function BackupPage() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [dbSize, setDbSize] = useState(0);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [schedule, setSchedule] = useState<"off" | "daily" | "weekly">("daily");
  const [lastAutoBackup, setLastAutoBackup] = useState<string | null>(null);

  const load = async () => {
    const list = await invoke<BackupInfo[]>("list_backups");
    setBackups(list);
    const size = await invoke<number>("get_db_size");
    setDbSize(size);

    const settings = await query<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?1",
      [SCHEDULE_KEY]
    );
    if (settings[0]) setSchedule(settings[0].value as typeof schedule);

    const lastAuto = await query<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?1",
      [LAST_AUTO_BACKUP_KEY]
    );
    setLastAutoBackup(lastAuto[0]?.value || null);
  };

  useEffect(() => {
    load();
    runAutoBackupIfNeeded();
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await invoke<BackupInfo>("create_backup", { label: label.trim() || null });
      toast.success("Backup created");
      setLabel("");
      load();
    } catch (e) {
      toast.error("Backup failed: " + e);
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (filename: string) => {
    if (!(await confirm({
      title: `Restore ${filename}?`,
      description: "This will REPLACE all current data with the backup. A safety backup of the current state will be created first. The app will need to be restarted after restore.",
      variant: "destructive",
      confirmText: "Restore",
    }))) return;

    setRestoring(filename);
    try {
      await invoke<void>("restore_backup", { filename });
      toast.success(`Backup restored. Please restart ${APP_NAME} now.`, { duration: 10000 });
      load();
    } catch (e) {
      toast.error("Restore failed: " + e);
    } finally {
      setRestoring(null);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!(await confirm({ title: `Delete ${filename}?` }))) return;
    try {
      await invoke<void>("delete_backup", { filename });
      toast.success("Backup deleted");
      load();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const updateSchedule = async (newSchedule: typeof schedule) => {
    setSchedule(newSchedule);
    await execute(
      `INSERT INTO settings (key, value, category) VALUES (?1, ?2, 'backup')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [SCHEDULE_KEY, newSchedule]
    );
    toast.success(`Auto-backup set to ${newSchedule}`);
  };

  const runAutoBackupIfNeeded = async () => {
    const settings = await query<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?1",
      [SCHEDULE_KEY]
    );
    const sched = settings[0]?.value || "daily";
    if (sched === "off") return;

    const lastAuto = await query<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?1",
      [LAST_AUTO_BACKUP_KEY]
    );
    const lastAt = lastAuto[0]?.value;
    const now = new Date();
    const intervalMs = sched === "daily" ? 86400000 : 7 * 86400000;

    if (lastAt) {
      const lastDate = new Date(lastAt);
      if (now.getTime() - lastDate.getTime() < intervalMs) return;
    }

    try {
      await invoke("create_backup", { label: `auto-${sched}` });
      await execute(
        `INSERT INTO settings (key, value, category) VALUES (?1, ?2, 'backup')
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
        [LAST_AUTO_BACKUP_KEY, now.toISOString()]
      );
      console.log("Auto-backup created");
    } catch (e) {
      console.error("Auto-backup failed:", e);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatTimestamp = (ts: string) => {
    // ts format: 2026-05-25T16-08-23
    const parts = ts.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})$/);
    if (!parts) return ts;
    return new Date(`${parts[1]}T${parts[2]}:${parts[3]}:${parts[4]}Z`).toLocaleString(intlLocale(), {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const totalBackupSize = backups.reduce((s, b) => s + b.size_bytes, 0);

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <BackButton fallback="/" />
        <h1 className="text-xl font-semibold tracking-tight">Backup & Restore</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Protect your data. Backups are stored locally on this device.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Database Size" value={formatBytes(dbSize)} icon={Database} />
        <StatCard label="Backups" value={String(backups.length)} icon={HardDrive} />
        <StatCard label="Total Backup Size" value={formatBytes(totalBackupSize)} icon={HardDrive} />
      </div>

      {/* Auto-backup schedule */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Auto-Backup Schedule</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Automatic backups run when you open {APP_NAME}, if the previous backup is older than the interval.
        </p>
        <div className="flex gap-2">
          {(["off", "daily", "weekly"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => updateSchedule(opt)}
              className={`px-4 py-2 rounded-md border text-sm transition-colors capitalize ${
                schedule === opt
                  ? "border-primary bg-primary/5 font-medium"
                  : "border-border hover:bg-accent/50"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        {lastAutoBackup && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            Last auto-backup: {new Date(lastAutoBackup).toLocaleString(intlLocale())}
          </p>
        )}
      </div>

      {/* Manual backup */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold">Manual Backup</h2>
        <div className="flex gap-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Optional label (e.g., 'before-import')"
            className="flex-1"
            disabled={creating}
          />
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
            ) : (
              <><Plus className="h-4 w-4 mr-2" /> Backup Now</>
            )}
          </Button>
        </div>
      </div>

      {/* Backup list */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Backup History
        </h2>
        {backups.length === 0 ? (
          <div className="border border-border rounded-lg p-8 text-center text-muted-foreground">
            <Database className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No backups yet</p>
            <p className="text-xs mt-1">Create your first backup above</p>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-left px-3 py-2 font-medium">Created</th>
                  <th className="text-left px-3 py-2 font-medium">Filename</th>
                  <th className="text-right px-3 py-2 font-medium">Size</th>
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-right px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => {
                  const isAuto = b.filename.includes("auto-");
                  const isPreRestore = b.filename.includes("pre-restore");
                  return (
                    <tr key={b.filename} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                        {formatTimestamp(b.created_at)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">{b.filename}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{formatBytes(b.size_bytes)}</td>
                      <td className="px-3 py-2.5">
                        {isPreRestore ? (
                          <Badge variant="outline" className="border-amber-500/50 text-amber-700">Pre-restore</Badge>
                        ) : isAuto ? (
                          <Badge variant="outline">Auto</Badge>
                        ) : (
                          <Badge variant="outline" className="border-blue-500/50 text-blue-700">Manual</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRestore(b.filename)}
                            disabled={restoring === b.filename}
                            title="Restore from this backup"
                          >
                            {restoring === b.filename ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Upload className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(b.filename)}
                            title="Delete this backup"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Warning */}
      <div className="border border-amber-500/50 bg-amber-500/5 rounded-lg p-3 flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">Backups are stored locally</p>
          <p className="text-xs text-muted-foreground mt-1">
            For disaster recovery (theft, hardware failure), copy backups to an external drive
            or cloud storage regularly. Right-click a backup file to copy its location.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Download }) {
  return (
    <div className="border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="h-6 w-6 rounded-md bg-muted/30 flex items-center justify-center">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>
      <p className="text-xl font-semibold font-mono">{value}</p>
    </div>
  );
}
