import { useEffect, useState } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import {
  Network,
  Wifi,
  Server,
  Smartphone,
  Power,
  PowerOff,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Search,
  Trash2,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  type NetworkMode,
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
        <h1 className="text-xl font-semibold tracking-tight">Network</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure how this device works on your local network
        </p>
      </div>

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
  const [status, setStatus] = useState<ServerStatus>({ running: false, url: null, mdns_active: false });
  const [port, setPort] = useState(8765);
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const [pairingCode, setPairingCode] = useState<PairingCodeInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setStatus(await getServerStatus());
    setPort(await getServerPort());
    setDevices(await listPairedDevices());
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
      setStatus({ running: false, url: null, mdns_active: false });
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
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{status.url}</p>
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
