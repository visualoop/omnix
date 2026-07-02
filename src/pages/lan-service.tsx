/**
 * /settings/lan-service — Windows service management for the LAN server.
 *
 * Lets an admin turn the LAN server from a Tauri-app-bound process into a
 * proper Windows service that survives:
 *   - closing the app window (already covered by tray, but redundant safety)
 *   - user logout
 *   - PC reboot
 *   - Windows Update restarts
 *
 * The service runs the standalone `omnix-lan-service.exe` binary that ships
 * alongside `omnix.exe`. Install / uninstall require admin — the UAC prompt
 * fires automatically when sc.exe is invoked.
 */
import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Gear, Play, Stop, CheckCircle, Warning } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { toast } from "sonner";
import { confirm } from "@/components/ui/confirm-dialog";

interface ServiceInfo {
  installed: boolean;
  running: boolean;
  status: string;
}

export function LanServicePage() {
  const [info, setInfo] = useState<ServiceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await invoke<ServiceInfo>("windows_service_status");
      setInfo(s);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleInstall = async () => {
    const ok = await confirm({
      title: "Install Windows service?",
      description:
        "Windows will pop up an admin prompt (UAC). Say Yes. This registers 'Omnix LAN Server' as an auto-starting service so it survives reboots + user logout. Uses port from your current network settings.",
      confirmText: "Install now",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const msg = await invoke<string>("install_windows_service");
      toast.success(msg);
      await load();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleUninstall = async () => {
    const ok = await confirm({
      title: "Uninstall Windows service?",
      description:
        "Stops + removes the OmnixLAN service. Clients will lose the master when Omnix isn't open. UAC prompt will appear.",
      confirmText: "Uninstall",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const msg = await invoke<string>("uninstall_windows_service");
      toast.success(msg);
      await load();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        eyebrow="System"
        title="LAN as Windows Service"
        description="Register the LAN server as a proper Windows service. Then it starts on boot, survives user logout, and auto-restarts on crash — no need to keep the Omnix app open on the master PC."
        back={{ fallback: "/settings" }}
      />

      {loading ? (
        <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          Checking service status…
        </div>
      ) : !info ? (
        <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          Could not read service status.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Status banner */}
          <div
            className={`rounded-lg border p-4 flex items-center gap-3 ${
              info.installed
                ? info.running
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-amber-500/40 bg-amber-500/5"
                : "border-border"
            }`}
          >
            {info.installed && info.running ? (
              <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : info.installed ? (
              <Warning className="h-5 w-5 text-amber-600 shrink-0" />
            ) : (
              <Gear className="h-5 w-5 text-muted-foreground shrink-0" />
            )}
            <div className="flex-1">
              <div className="text-[13.5px] font-medium">
                {info.installed
                  ? info.running
                    ? "Service is installed and running"
                    : "Service is installed but stopped"
                  : "Service is not installed"}
              </div>
              <div className="text-[11.5px] text-muted-foreground mt-0.5">
                Status: <span className="font-mono">{info.status}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <section className="rounded-lg border border-border p-4 space-y-3">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider">Actions</h3>
            {info.installed ? (
              <div className="flex items-center gap-2">
                <Button variant="destructive" onClick={handleUninstall} disabled={busy}>
                  <Stop className="h-4 w-4 mr-1.5" /> Uninstall service
                </Button>
                <span className="text-[12px] text-muted-foreground">
                  Reverts to app-bound LAN server.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button onClick={handleInstall} disabled={busy}>
                  <Play className="h-4 w-4 mr-1.5" /> Install service
                </Button>
                <span className="text-[12px] text-muted-foreground">
                  Requires admin. UAC prompt will appear.
                </span>
              </div>
            )}
          </section>

          {/* Why + how */}
          <section className="rounded-lg border border-border p-4 space-y-3 text-[13px] text-muted-foreground">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-foreground">
              What this does
            </h3>
            <ul className="space-y-1.5 list-disc pl-5">
              <li>Starts <span className="font-mono">omnix-lan-service.exe</span> under the SYSTEM account on every boot.</li>
              <li>Auto-restarts on crash (5s → 5s → 30s).</li>
              <li>Independent of the Omnix window — closing the app doesn&rsquo;t stop the service.</li>
              <li>Manageable from <span className="font-mono">services.msc</span> like any Windows service.</li>
              <li>Reads the same <span className="font-mono">network.mode</span>, <span className="font-mono">network.server_port</span>, and business name from your database, so no re-configuration.</li>
            </ul>
            <p>
              <b>Note:</b> when the service is installed, the app-bound LAN server (started by <span className="font-mono">useLanAutostart</span>) will detect a port conflict and step aside. This means clients always hit the service, not the app.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
