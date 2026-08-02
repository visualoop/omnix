import { useEffect, useState } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import {
  Check,
  CircleNotch as Loader2,
  Copy,
  Cpu as Server,
  DeviceMobile as Smartphone,
  MagnifyingGlass as Search,
  LockKey as Lock,
  Network,
  Power,
  Power as PowerOff,
  Radio,
  ShieldCheck,
  Key,
  ArrowsClockwise,
  Trash as Trash2,
  WarningCircle as AlertCircle,
  WifiHigh as Wifi,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  getMode,
  setMode,
  getServerPort,
  setServerPort,
  getDeviceName,
  setDeviceName,
  startServer,
  stopServer,
  getServerStatus,
  generatePairingCode,
  listPairedDevices,
  revokePairedDevice,
  discoverServers,
  pairWithMaster,
  getMasterConfig,
  clearMasterConfig,
  pingMaster,
  getLegacyTrustedLanEnabled,
  setLegacyTrustedLanEnabled,
  getPrivateMeshStatus,
  installPrivateMesh,
  requestPrivateMeshEnrollment,
  rotatePrivateMeshKey,
  promotePrivateMeshKey,
  revokePrivateMesh,
  type PrivateMeshStatus,
  type MeshEnrollmentRequestStatus,
  type NetworkMode,
  type BrowserCertificateState,
  type ServerStatus,
  type PairedDevice,
  type DiscoveredServer,
  type PairingCodeInfo,
} from "@/services/network";
import { getMachineInfo } from "@/services/license";
import { refreshDbMode } from "@/lib/db";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/brand";
import { intlLocale } from "@/lib/intl";

import { BackButton } from "@/components/ui/back-button";
import { BrowserViewerPanel } from "@/components/network/BrowserViewerPanel";
export function NetworkSettingsPage() {
  const [mode, setModeState] = useState<NetworkMode>("standalone");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setModeState(await getMode());
    // Get business name from local DB
    try {
      const { query } = await import("@/lib/db");
      const rows = await query<{ name: string }>("SELECT name FROM business LIMIT 1");
      if (rows[0]) setBusinessName(rows[0].name);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleModeChange = async (newMode: NetworkMode) => {
    if (newMode === mode) return;
    if (mode === "master") {
      // Stop server first
      try { await stopServer(); } catch {}
    }
    if (mode === "client") {
      await clearMasterConfig();
    }
    await setMode(newMode);
    await refreshDbMode();
    setModeState(newMode);
    toast.success(`Switched to ${newMode} mode`);
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <BackButton fallback="/settings" />
        <h1 className="text-xl font-semibold tracking-tight">Network</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure how this device works on your local network
        </p>
      </div>

      <PrivateMeshPanel />

      {/* Mode selector */}
      <div className="grid grid-cols-3 gap-3">
        <ModeCard
          mode="standalone"
          active={mode === "standalone"}
          icon={Smartphone}
          title="Standalone"
          description="Single device. Default for most pharmacies."
          onClick={() => handleModeChange("standalone")}
        />

        <ModeCard
          mode="master"
          active={mode === "master"}
          icon={Server}
          title="Master"
          description="This device hosts the database. Other devices connect to it."
          onClick={() => handleModeChange("master")}
        />
        <ModeCard
          mode="client"
          active={mode === "client"}
          icon={Wifi}
          title="Client"
          description="Connect to a Master device on this network."
          onClick={() => handleModeChange("client")}
        />
      </div>

      {/* Mode-specific settings */}
      {mode === "master" && <MasterPanel businessName={businessName} />}
      {mode === "client" && <ClientPanel onPaired={load} />}
      {mode === "standalone" && (
        <div className="border border-border rounded-lg p-4 text-sm text-muted-foreground">
          Standalone mode: no network sharing. Recommended for single-device pharmacies.
        </div>
      )}
    </div>
  );
}

function PrivateMeshPanel() {
  const [status, setStatus] = useState<PrivateMeshStatus | null>(null);
  const [enrollment, setEnrollment] = useState<MeshEnrollmentRequestStatus | null>(null);
  const [busy, setBusy] = useState<"install" | "enroll" | "rotate" | "promote" | "revoke" | null>(null);

  const load = async () => {
    try {
      setStatus(await getPrivateMeshStatus());
    } catch (error) {
      toast.error(`Could not read Private Mesh status: ${String(error)}`);
    }
  };

  useEffect(() => {
    void load();
    const refresh = window.setInterval(() => { void load(); }, 5_000);
    return () => window.clearInterval(refresh);
  }, []);

  const install = async () => {
    const approved = await confirm({
      title: "Install Omnix Private Mesh?",
      description: "Windows will request administrator approval. Omnix will install its signed tunnel driver and background service for this computer.",
      confirmText: "Continue to UAC",
    });
    if (!approved) return;
    setBusy("install");
    try {
      setStatus(await installPrivateMesh());
      toast.success("Private Mesh installed");
    } catch (error) {
      toast.error(String(error));
    } finally {
      setBusy(null);
    }
  };

  const enroll = async () => {
    setBusy("enroll");
    try {
      const request = await requestPrivateMeshEnrollment();
      setEnrollment(request);
      toast.success("Enrollment request created; waiting for HQ approval");
    } catch (error) {
      toast.error(String(error));
    } finally {
      setBusy(null);
    }
  };

  const rotate = async () => {
    setBusy("rotate");
    try {
      setStatus(await rotatePrivateMeshKey());
      toast.success("New key generated; the current key remains valid during approval");
    } catch (error) {
      toast.error(String(error));
    } finally {
      setBusy(null);
    }
  };

  const promote = async () => {
    setBusy("promote");
    try {
      setStatus(await promotePrivateMeshKey());
      toast.success("Rotated key is now active");
    } catch (error) {
      toast.error(String(error));
    } finally {
      setBusy(null);
    }
  };

  const revoke = async () => {
    const approved = await confirm({
      title: "Revoke this device from Private Mesh?",
      description: "This is terminal for the current credential. The tunnel stops immediately and the protected key is deleted.",
      confirmText: "Revoke device",
      variant: "destructive",
    });
    if (!approved) return;
    setBusy("revoke");
    try {
      setStatus(await revokePrivateMesh("administrative"));
      setEnrollment(null);
      toast.success("Private Mesh credential revoked");
    } catch (error) {
      toast.error(String(error));
    } finally {
      setBusy(null);
    }
  };

  const stateLabel = status?.state.replace(/_/g, " ") ?? "Checking";
  const active = status?.running === true;

  return (
    <section className="border-y border-border py-4" aria-labelledby="private-mesh-heading">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 id="private-mesh-heading" className="text-sm font-semibold">Omnix Private Mesh</h2>
            <Badge variant={active ? "default" : "secondary"} className="capitalize">
              {stateLabel}
            </Badge>
          </div>
          <p className="mt-1.5 max-w-xl text-xs leading-5 text-muted-foreground">
            Encrypted branch sync without a WireGuard account or separate VPN app. Only the assigned
            Omnix private subnet is routed; internet and payment traffic stay on the normal connection.
          </p>
        </div>
        {!status?.installed && (
          <Button size="sm" onClick={() => { void install(); }} disabled={busy !== null || status?.available === false}>
            {busy === "install" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />}
            Install Private Mesh
          </Button>
        )}
      </div>

      {status?.available === false && (
        <p className="mt-3 text-xs text-muted-foreground">Private Mesh service installation is available on Windows.</p>
      )}

      {status?.installed && status.state !== "revoked" && (
        <div className="mt-4 grid gap-3 border-l-2 border-primary/40 pl-4 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-medium">Device credential</p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              {status.currentKey?.keyId ?? "Protected key ready; enrollment not started"}
            </p>
            {enrollment && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                Waiting for HQ approval · expires {new Date(enrollment.expiresAt).toLocaleTimeString(intlLocale(), { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!enrollment && !status.running && (
              <Button size="sm" variant="outline" onClick={() => { void enroll(); }} disabled={busy !== null}>
                {busy === "enroll" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Key className="mr-1.5 h-3.5 w-3.5" />}
                Enrol device
              </Button>
            )}
            {status.currentKey && !status.nextKey && (
              <Button size="sm" variant="outline" onClick={() => { void rotate(); }} disabled={busy !== null}>
                <ArrowsClockwise className="mr-1.5 h-3.5 w-3.5" /> Rotate key
              </Button>
            )}
            {status.nextKey && (
              <Button size="sm" variant="outline" onClick={() => { void promote(); }} disabled={busy !== null}>
                <Check className="mr-1.5 h-3.5 w-3.5" /> Activate approved key
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => { void revoke(); }} disabled={busy !== null} className="text-destructive hover:text-destructive">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Revoke
            </Button>
          </div>
        </div>
      )}

      {status?.lastError && (
        <p className="mt-3 flex items-start gap-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {status.lastError}
        </p>
      )}
      <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Route boundary · Private Omnix subnet only · Administrator approval required for system changes
      </p>
    </section>
  );
}

function ModeCard({
  active, icon: Icon, title, description, onClick,
}: {
  mode: NetworkMode; active: boolean;
  icon: typeof Network; title: string; description: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left border rounded-lg p-4 transition-colors ${
        active ? "border-primary bg-primary/5" : "border-border hover:border-accent hover:bg-accent/30"
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
        <span className="text-sm font-medium">{title}</span>
        {active && <Badge variant="default" className="bg-primary text-primary-foreground text-[10px]">Active</Badge>}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </button>
  );
}

function MasterPanel({ businessName }: { businessName: string }) {
  const [status, setStatus] = useState<ServerStatus>({ running: false, url: null, read_only_url: null, mdns_active: false, browser_tls: null });
  const [port, setPort] = useState(8765);
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const [pairingCode, setPairingCode] = useState<PairingCodeInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [legacyTrustedLan, setLegacyTrustedLan] = useState(false);

  const load = async () => {
    setStatus(await getServerStatus());
    setPort(await getServerPort());
    setDevices(await listPairedDevices());
    setLegacyTrustedLan(await getLegacyTrustedLanEnabled());
  };

  useEffect(() => { load(); }, []);

  const handleStart = async () => {
    setBusy(true);
    try {
      await setServerPort(port);
      const s = await startServer(port, businessName);
      setStatus(s);
      toast.success("Server started on " + s.url);
    } catch (e) {
      toast.error("Failed to start: " + e);
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    setBusy(true);
    try {
      await stopServer();
      setStatus({ running: false, url: null, read_only_url: null, mdns_active: false, browser_tls: null });
      toast.success("Server stopped");
    } catch (e) {
      toast.error("Failed to stop: " + e);
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateCode = async () => {
    try {
      const code = await generatePairingCode();
      setPairingCode(code);
      toast.success("Pairing code valid for 5 minutes");
    } catch (e) {
      toast.error("Failed: " + e);
    }
  };

  const handleCopyUrl = async () => {
    if (!status.url) return;
    await navigator.clipboard.writeText(status.url);
    setCopied(true);
    toast.success("URL copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async (token: string, name: string) => {
    if (!(await confirm({ title: `Revoke access for "${name}"?` }))) return;
    await revokePairedDevice(token);
    toast.success("Device revoked");
    load();
  };

  const handleLegacyCompatibility = async (enabled: boolean) => {
    await setLegacyTrustedLanEnabled(enabled);
    setLegacyTrustedLan(enabled);
    toast.success(enabled ? "Legacy paired till compatibility enabled" : "Legacy paired till compatibility disabled");
  };

  return (
    <div className="space-y-4">
      {/* Server status */}
      <div className={`border rounded-lg p-4 ${status.running ? "border-green-500/50 bg-green-500/5" : "border-border"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-md flex items-center justify-center ${
              status.running ? "bg-green-500/20 text-green-700" : "bg-muted text-muted-foreground"
            }`}>
              <Server className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {status.running ? "Running" : "Stopped"}
              </p>
              {status.url && (
                <p className="text-xs text-muted-foreground font-mono mt-0.5">Devices: {status.url}</p>
              )}
              {status.read_only_url && (
                <p className="text-xs text-muted-foreground font-mono mt-0.5">Reports: {status.read_only_url}/web</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status.running && status.url && (
              <Button variant="ghost" size="sm" onClick={handleCopyUrl}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            )}
            {status.running ? (
              <Button onClick={handleStop} variant="outline" size="sm" disabled={busy}>
                <PowerOff className="h-3.5 w-3.5 mr-1.5" /> Stop
              </Button>
            ) : (
              <Button onClick={handleStart} size="sm" disabled={busy}>
                {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Power className="h-3.5 w-3.5 mr-1.5" />}
                Start Server
              </Button>
            )}
          </div>
        </div>

        {status.running && status.browser_tls && (
          <div className="mt-4 border-t border-border/80 pt-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Lock className="mt-0.5 size-4 text-blue-600" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold">Browser report connection</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {status.browser_tls.scheme} · {status.browser_tls.hostname}
                  </p>
                </div>
              </div>
              <Badge variant="outline">{certificateStateLabel(status.browser_tls.certificateState)}</Badge>
            </div>
            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-[8rem_1fr]">
              <dt className="text-muted-foreground">SHA-256 fingerprint</dt>
              <dd className="break-all font-mono text-[10px] leading-4">{status.browser_tls.certificateFingerprint}</dd>
              {status.browser_tls.certificateExpiresAt && (
                <>
                  <dt className="text-muted-foreground">Certificate expires</dt>
                  <dd>{new Date(status.browser_tls.certificateExpiresAt).toLocaleString(intlLocale(), { day: "2-digit", month: "short", year: "numeric" })}</dd>
                </>
              )}
            </dl>
            {status.browser_tls.certificateState.startsWith("self_signed") ? (
              <div className="mt-3 border-l-2 border-amber-500 pl-3 text-xs leading-5 text-muted-foreground">
                <span className="font-medium text-foreground">One-time browser trust required.</span>{" "}
                Open the Reports address on each browser, compare its certificate fingerprint with the value above, then trust it only when they match. The warning remains until this step is completed or a managed certificate is issued.
              </div>
            ) : status.browser_tls.certificateState === "trusted_renewal_delayed" ? (
              <div className="mt-3 border-l-2 border-amber-500 pl-3 text-xs leading-5 text-muted-foreground">
                The trusted certificate is still valid, but automatic renewal is delayed. Check this hub’s internet connection and certificate-helper configuration.
              </div>
            ) : (
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                This certificate is trusted by standard browsers. Renewal runs automatically on the hub.
              </p>
            )}
          </div>
        )}

        {!status.running && (
          <div className="mt-4 flex items-end gap-2">
            <div className="space-y-1.5 flex-1">
              <label className="text-xs font-medium text-muted-foreground">Port</label>
              <Input
                type="number"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value, 10) || 8765)}
                className="font-mono"
              />
            </div>
          </div>
        )}

        {status.running && status.mdns_active && (
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
            <Radio className="h-3 w-3" /> Discoverable on this network via mDNS
          </p>
        )}
      </div>

      <div className="border-y border-amber-500/30 py-4">
        <div className="flex items-start justify-between gap-6">
          <div className="max-w-xl">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-medium">Legacy paired till compatibility</h3>
            </div>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              Enable only for older desktop tills that have not moved to the protected command API.
              Android and browser devices never use this mode. Turn it off after every till is updated.
            </p>
          </div>
          <Switch
            checked={legacyTrustedLan}
            onCheckedChange={(checked) => { void handleLegacyCompatibility(checked); }}
            aria-label="Legacy paired till compatibility"
          />
        </div>
      </div>

      {/* Pairing */}
      {status.running && (
        <div className="border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Add a Device</h3>
            <Button onClick={handleGenerateCode} size="sm" variant="outline">
              Generate Code
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Generate a 6-digit code, then enter it on the client device. The code expires in 5 minutes.
          </p>
          {pairingCode && (
            <div className="border-2 border-dashed border-primary/50 rounded-md p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Pairing code (valid 5 min)</p>
              <p className="text-3xl font-bold font-mono tracking-widest text-primary">
                {pairingCode.code}
              </p>
            </div>
          )}
        </div>
      )}

      {status.running && status.read_only_url && (
        <BrowserViewerPanel readOnlyUrl={status.read_only_url} />
      )}

      {/* Paired devices */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Paired Devices ({devices.filter((d) => d.revoked === 0).length})
        </h3>
        {devices.length === 0 ? (
          <div className="border border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
            No paired devices yet
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
            {devices.map((d) => (
              <div key={d.token} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{d.device_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                    {d.token}
                    {d.last_seen_at && ` · last seen ${new Date(d.last_seen_at).toLocaleString(intlLocale(), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {d.revoked === 1 ? (
                    <Badge variant="secondary">Revoked</Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(d.token, d.device_name)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClientPanel({ onPaired }: { onPaired: () => void }) {
  const [discovered, setDiscovered] = useState<DiscoveredServer[]>([]);
  const [searching, setSearching] = useState(false);
  const [masterUrl, setMasterUrl] = useState("");
  const [code, setCode] = useState("");
  const [deviceName, setDeviceNameState] = useState("");
  const [pairing, setPairing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMaster, setCurrentMaster] = useState<{ url: string; ok: boolean; business?: string } | null>(null);

  const load = async () => {
    setDeviceNameState(await getDeviceName() || "Cashier Station");
    const config = await getMasterConfig();
    if (config.url && config.token) {
      const ping = await pingMaster(config.url);
      setCurrentMaster({ url: config.url, ok: ping.ok, business: ping.business });
    }
  };

  useEffect(() => { load(); }, []);

  const handleDiscover = async () => {
    setSearching(true);
    try {
      const found = await discoverServers(2500);
      setDiscovered(found);
      if (found.length === 0) {
        toast.info("No master devices found on this network");
      }
    } catch (e) {
      toast.error("Discovery failed: " + e);
    } finally {
      setSearching(false);
    }
  };

  const handlePair = async () => {
    if (!masterUrl || !code || !deviceName) {
      setError("Master URL, pairing code, and device name are all required");
      return;
    }
    setError(null);
    setPairing(true);
    try {
      await setDeviceName(deviceName);
      const machine = await getMachineInfo();
      const result = await pairWithMaster(masterUrl, code, deviceName, machine.fingerprint);
      await refreshDbMode();
      toast.success(`Paired with ${result.business_name}`);
      onPaired();
      load();
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setPairing(false);
    }
  };

  const handleUnpair = async () => {
    if (!(await confirm({ title: "Disconnect from this master? You'll need to pair again to use the shared database." }))) return;
    await clearMasterConfig();
    await refreshDbMode();
    setCurrentMaster(null);
    toast.success("Disconnected");
    onPaired();
  };

  if (currentMaster) {
    return (
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-md flex items-center justify-center ${
              currentMaster.ok ? "bg-green-500/20 text-green-700" : "bg-red-500/20 text-red-700"
            }`}>
              <Wifi className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {currentMaster.ok ? "Connected" : "Master unreachable"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">{currentMaster.url}</p>
              {currentMaster.business && (
                <p className="text-xs text-muted-foreground mt-0.5">{currentMaster.business}</p>
              )}
            </div>
          </div>
          <Button onClick={handleUnpair} variant="outline" size="sm">
            Disconnect
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Discovery */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Find Master Device</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Search for {APP_NAME} master devices on this network
            </p>
          </div>
          <Button onClick={handleDiscover} disabled={searching} size="sm" variant="outline">
            {searching ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Searching...</>
            ) : (
              <><Search className="h-3.5 w-3.5 mr-1.5" /> Search</>
            )}
          </Button>
        </div>
        {discovered.length > 0 && (
          <div className="space-y-1.5">
            {discovered.map((d) => (
              <button
                key={d.url}
                onClick={() => setMasterUrl(d.url)}
                className="w-full text-left flex items-center justify-between px-3 py-2 rounded-md border border-border hover:bg-accent/50"
              >
                <span className="text-sm font-mono">{d.url}</span>
                <Badge variant="outline">{d.name}</Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pairing form */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-medium">Pair with Master</h3>
        <Field label="Master URL">
          <Input
            value={masterUrl}
            onChange={(e) => setMasterUrl(e.target.value)}
            placeholder="http://192.168.1.10:8765"
            className="font-mono"
          />
        </Field>
        <Field label="Pairing Code (6 digits)">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            className="font-mono text-lg tracking-widest text-center"
            maxLength={6}
          />
        </Field>
        <Field label="This Device's Name">
          <Input
            value={deviceName}
            onChange={(e) => setDeviceNameState(e.target.value)}
            placeholder="e.g., Front Counter"
          />
        </Field>

        {error && (
          <div className="border border-red-500/50 bg-red-500/5 rounded-md p-2.5 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <Button
          onClick={handlePair}
          disabled={pairing || !masterUrl || code.length !== 6 || !deviceName}
          className="w-full"
        >
          {pairing ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Pairing...</>
          ) : (
            "Pair with Master"
          )}
        </Button>
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

function certificateStateLabel(state: BrowserCertificateState): string {
  switch (state) {
    case "trusted": return "Trusted certificate";
    case "trusted_renewal_due": return "Trusted · renewal due";
    case "trusted_renewing": return "Trusted · renewing";
    case "trusted_renewal_delayed": return "Trusted · renewal delayed";
    case "self_signed_managed_pending": return "Private · managed certificate pending";
    case "self_signed": return "Private certificate";
  }
}
