import { useEffect, useRef, useState } from "react";
import {
  ArrowClockwise,
  CheckCircle,
  DesktopTower,
  MagnifyingGlass,
  PlugsConnected,
  WarningCircle,
  WifiHigh,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  AndroidHubError,
  diagnosticFor,
  discoverAndroidHubs,
  loginAndroidHub,
  pairAndroidHub,
  splitHubUrl,
  type AndroidFirstRunDiagnostic,
  type AndroidHubConfig,
} from "@/mobile/android-hub";

interface AndroidFirstRunProps {
  readonly initialDiagnostic?: AndroidFirstRunDiagnostic | null;
  readonly onPaired: (config: AndroidHubConfig) => void;
}

function Field({ label, hint, children }: {
  readonly label: string;
  readonly hint?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-foreground">{label}</span>
        {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function Diagnostic({ diagnostic }: { readonly diagnostic: AndroidFirstRunDiagnostic }) {
  return (
    <section role="alert" className="border-y border-destructive/35 bg-destructive/[0.04] py-3">
      <div className="flex gap-3">
        <WarningCircle className="mt-0.5 size-5 shrink-0 text-destructive" weight="fill" />
        <div>
          <p className="text-[13px] font-semibold text-foreground">{diagnostic.title}</p>
          <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{diagnostic.message}</p>
        </div>
      </div>
    </section>
  );
}

export function AndroidFirstRun({ initialDiagnostic = null, onPaired }: AndroidFirstRunProps) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("8765");
  const [code, setCode] = useState("");
  const [deviceName, setDeviceName] = useState("Omnix Android");
  const [discovered, setDiscovered] = useState<readonly { name: string; url: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [diagnostic, setDiagnostic] = useState<AndroidFirstRunDiagnostic | null>(initialDiagnostic);
  const fingerprint = useRef(`android-${crypto.randomUUID()}`);

  const discover = async () => {
    setSearching(true);
    setDiagnostic(null);
    try {
      const found = await discoverAndroidHubs();
      setDiscovered(found);
      if (found.length === 1) {
        const selected = splitHubUrl(found[0].url);
        setHost(selected.host);
        setPort(selected.port);
      }
    } catch (error) {
      setDiscovered([]);
      setDiagnostic({
        kind: "hub-unreachable",
        title: "Automatic discovery unavailable",
        message: `${error instanceof Error ? error.message : "No hub was found"}. You can still enter the hub address below.`,
        retryable: true,
      });
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    void discover();
  }, []);

  const chooseDiscovered = (url: string) => {
    const selected = splitHubUrl(url);
    setHost(selected.host);
    setPort(selected.port);
    setDiagnostic(null);
  };

  const pair = async () => {
    setPairing(true);
    setDiagnostic(null);
    try {
      const config = await pairAndroidHub({
        host,
        port,
        code,
        deviceName,
        fingerprint: fingerprint.current,
      });
      onPaired(config);
    } catch (error) {
      setDiagnostic(diagnosticFor(error));
    } finally {
      setPairing(false);
    }
  };

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
        <header className="border-b border-border pb-6">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <span className="grid size-6 place-items-center rounded-[5px] bg-primary text-[10px] font-bold text-primary-foreground">OX</span>
            Android enrollment
          </div>
          <h1 className="mt-6 text-[28px] font-semibold leading-[1.08] tracking-[-0.035em]">Connect this device to your branch hub</h1>
          <p className="mt-3 max-w-md text-[14px] leading-6 text-muted-foreground">
            Keep Omnix open on the branch computer and place this phone on the same Wi-Fi. Business records stay on that hub.
          </p>
        </header>

        <div className="mt-5 space-y-5">
          {diagnostic ? <Diagnostic diagnostic={diagnostic} /> : null}

          <section aria-labelledby="nearby-hubs" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id="nearby-hubs" className="text-[13px] font-semibold">Nearby branch hubs</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Discovered on this Wi-Fi by mDNS</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => void discover()} disabled={searching}>
                {searching ? <MagnifyingGlass className="size-4" /> : <ArrowClockwise className="size-4" />}
                {searching ? "Searching" : "Search again"}
              </Button>
            </div>

            {discovered.length > 0 ? (
              <div className="divide-y divide-border border-y border-border">
                {discovered.map((hub) => (
                  <button
                    key={hub.url}
                    type="button"
                    onClick={() => chooseDiscovered(hub.url)}
                    className="flex min-h-14 w-full items-center gap-3 px-1 text-left transition-colors duration-150 hover:bg-muted/40 active:bg-muted/70"
                  >
                    <WifiHigh className="size-5 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{hub.name}</span>
                      <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">{hub.url}</span>
                    </span>
                    {splitHubUrl(hub.url).host === host && splitHubUrl(hub.url).port === port ? (
                      <CheckCircle className="size-5 shrink-0 text-primary" weight="fill" />
                    ) : null}
                  </button>
                ))}
              </div>
            ) : !searching ? (
              <div className="border-y border-border py-4 text-[12px] leading-5 text-muted-foreground">
                No hub appeared automatically. Enter the address shown under <span className="font-medium text-foreground">Settings → Network</span> on the desktop hub.
              </div>
            ) : null}
          </section>

          <section aria-labelledby="manual-address" className="space-y-4 border-t border-border pt-5">
            <div className="flex items-center gap-2">
              <DesktopTower className="size-4 text-muted-foreground" />
              <h2 id="manual-address" className="text-[13px] font-semibold">Hub address</h2>
            </div>
            <Field label="Host or IP address" hint="Example: 192.168.1.20">
              <Input
                value={host}
                onChange={(event) => setHost(event.target.value)}
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="192.168.1.20"
                className="font-mono"
              />
            </Field>
            <Field label="Port" hint="Usually 8765">
              <Input
                value={port}
                onChange={(event) => setPort(event.target.value.replace(/\D/g, "").slice(0, 5))}
                inputMode="numeric"
                placeholder="8765"
                className="font-mono"
              />
            </Field>
          </section>

          <section aria-labelledby="pair-device" className="space-y-4 border-t border-border pt-5">
            <div className="flex items-center gap-2">
              <PlugsConnected className="size-4 text-muted-foreground" />
              <h2 id="pair-device" className="text-[13px] font-semibold">Pair this device</h2>
            </div>
            <Field label="Pairing code" hint="Valid for 5 minutes">
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className="h-12 text-center font-mono text-lg tracking-[0.3em]"
              />
            </Field>
            <Field label="Device name">
              <Input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} placeholder="Front counter phone" />
            </Field>
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={() => void pair()}
              disabled={pairing || !host.trim() || !port || code.length !== 6 || !deviceName.trim()}
            >
              {pairing ? "Checking hub…" : "Connect and pair"}
            </Button>
          </section>
        </div>
      </div>
    </main>
  );
}

interface AndroidHubLoginProps {
  readonly config: AndroidHubConfig;
  readonly onAuthenticated: (config: AndroidHubConfig) => void;
  readonly onChangeHub: () => void;
}

export function AndroidHubLogin({ config, onAuthenticated, onChangeHub }: AndroidHubLoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [branchId, setBranchId] = useState(config.branches[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [diagnostic, setDiagnostic] = useState<AndroidFirstRunDiagnostic | null>(null);

  const signIn = async () => {
    setSubmitting(true);
    setDiagnostic(null);
    try {
      onAuthenticated(await loginAndroidHub(config, { username, password, branchId }));
    } catch (error) {
      const next = error instanceof AndroidHubError && error.kind === "pairing-rejected"
        ? { kind: "pairing-rejected" as const, title: "Sign-in not accepted", message: error.message, retryable: true }
        : diagnosticFor(error);
      setDiagnostic(next);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
        <header className="border-b border-border pb-6">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-primary">
            <CheckCircle className="size-4" weight="fill" /> Paired with {config.businessName}
          </div>
          <h1 className="mt-6 text-[28px] font-semibold leading-[1.08] tracking-[-0.035em]">Sign in through the branch hub</h1>
          <p className="mt-3 text-[14px] leading-6 text-muted-foreground">Use the same username and password you use on the desktop hub.</p>
        </header>

        <div className="mt-6 space-y-5">
          {diagnostic ? <Diagnostic diagnostic={diagnostic} /> : null}
          <Field label="Branch">
            <Combobox
              value={branchId}
              onChange={setBranchId}
              options={config.branches.map((branch) => ({ value: branch.id, label: branch.name, hint: branch.code }))}
              placeholder="Choose an assigned branch"
              searchPlaceholder="Search branches…"
              emptyText="No active branches on this hub"
            />
          </Field>
          <Field label="Username">
            <Input value={username} onChange={(event) => setUsername(event.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="username" />
          </Field>
          <Field label="Password">
            <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
          </Field>
          <Button type="button" size="lg" className="w-full" onClick={() => void signIn()} disabled={submitting || !username.trim() || !password || !branchId}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={onChangeHub}>Use a different hub</Button>
        </div>
      </div>
    </main>
  );
}
