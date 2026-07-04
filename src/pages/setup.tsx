import { useState } from "react";
import { CircleNotch, WarningCircle, CheckCircle } from "@phosphor-icons/react";
import { Flag } from "@/components/ui/flag";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth";
import { runSetup } from "@/services/auth";
import { setAutostartEnabled } from "@/services/autostart";
import { OmnixLogo } from "@/components/omnix-logo";
import { ModuleLogo } from "@/components/module-logos";
import { APP_NAME } from "@/lib/brand";
import { useActiveModule, MODULE_DEFINITIONS, type ModuleId } from "@/stores/active-module";
import { isModuleEntitled, entitledModules } from "@/stores/entitlements";
import { IS_PRO, LOCKED_MODULE, MODULES_ALLOWED, VARIANT_NAME } from "@/lib/variant";
import { useCountry } from "@/stores/country";
import { listCountries, TOP_MARKETS, getCountry, type CountryCode } from "@/lib/countries";

interface SetupData {
  businessName: string;
  address: string;
  phone: string;
  email: string;
  ownerName: string;
  username: string;
  password: string;
  confirmPassword: string;
  autostart: boolean;
  moduleId: ModuleId;
}

export function SetupWizard() {
  const [step, setStep] = useState(0);
  const [pickedCountry, setPickedCountry] = useState<CountryCode | null>(null);
  // Trade variants pre-lock the module to whatever the binary ships.
  // Pro picks the first entitled module as a default (operator can switch on step 1).
  const defaultModule = (
    !IS_PRO && LOCKED_MODULE
      ? LOCKED_MODULE
      : (entitledModules()[0] ?? "dawa")
  ) as ModuleId;
  const [data, setData] = useState<SetupData>({
    businessName: "",
    address: "",
    phone: "",
    email: "",
    ownerName: "",
    username: "",
    password: "",
    confirmPassword: "",
    autostart: true,
    moduleId: defaultModule,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setSetupComplete, setUser } = useAuthStore();
  const setActiveModule = useActiveModule((s) => s.setActive);

    const update = (field: keyof SetupData, value: string | boolean) => {
    setData((d) => ({ ...d, [field]: value }));
    if (error) setError(null);
  };

  const finish = async () => {
    setError(null);

    if (data.password !== data.confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (data.password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }
    if (!data.username.match(/^[a-zA-Z0-9_]+$/)) {
      setError("Username can only contain letters, numbers, and underscores");
      return;
    }

    setSubmitting(true);
    try {
      const { user } = await runSetup({
        business_name: data.businessName,
        business_type: data.moduleId,
        address: data.address,
        phone: data.phone,
        email: data.email,
        owner_name: data.ownerName,
        username: data.username,
        password: data.password,
      });

      // Persist active module so sidebar/branding pick it up
      try {
        await setActiveModule(data.moduleId);
      } catch (e) {
        console.warn("Could not save active module:", e);
      }

      // Apply autostart preference (best-effort; don't fail setup if it errors)
      try {
        await setAutostartEnabled(data.autostart);
      } catch (e) {
        console.warn("Could not set autostart:", e);
      }

      setSetupComplete(true);
      setUser(user);
    } catch (e) {
      setError(String(e));
      setSubmitting(false);
    }
  };

  const steps = [
    // Step 0: Welcome + country picker
    <div key="welcome" className="space-y-5 text-center">
      <div className="inline-flex items-center justify-center">
        <OmnixLogo size={72} />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Welcome to {VARIANT_NAME}</h2>
        <p className="text-sm text-muted-foreground max-w-[340px] mx-auto leading-relaxed">
          First — pick the country you operate in. This sets your currency, tax label, and the
          local payment methods we wire up by default.
        </p>
      </div>

      {/* Country quick-pick — top markets first, then "All countries" picker */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {TOP_MARKETS.map((cc) => {
            const c = getCountry(cc);
            if (!c) return null;
            const selected = pickedCountry === cc;
            return (
              <button
                key={cc}
                type="button"
                onClick={() => setPickedCountry(cc)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[12px] transition-all ${
                  selected
                    ? "border-primary bg-primary/8 ring-2 ring-primary/15"
                    : "border-border/60 hover:border-primary/40 hover:bg-foreground/[0.03]"
                }`}
              >
                <Flag code={c.code} className="w-6" title={c.name} />
                <span className="truncate font-medium">{c.name}</span>
              </button>
            );
          })}
        </div>

        {/* All-countries dropdown for everywhere else */}
        <details className="text-left">
          <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground select-none">
            Other country (search 180+ countries)
          </summary>
          <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-border/60 p-1">
            {listCountries()
              .filter((c) => !TOP_MARKETS.includes(c.code))
              .map((c) => {
                const selected = pickedCountry === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setPickedCountry(c.code)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition ${
                      selected ? "bg-primary/10 text-primary" : "hover:bg-foreground/[0.04]"
                    }`}
                  >
                    <Flag code={c.code} className="w-5" title={c.name} />
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{c.currencyCode}</span>
                  </button>
                );
              })}
          </div>
        </details>

        {pickedCountry && (() => {
          const c = getCountry(pickedCountry);
          if (!c) return null;
          return (
            <div className="rounded-lg border border-border/60 bg-foreground/[0.02] p-3 text-left text-[11.5px] leading-relaxed">
              <div className="flex items-center gap-1.5 font-medium">
                <Flag code={c.code} className="w-5" title={c.name} />
                <span>{c.name}</span>
                <span className="ml-auto font-mono text-muted-foreground">
                  {c.currencyCode} · {c.taxLabel} {c.defaultTaxRate}%
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      <p className="text-[11px] text-muted-foreground">Takes about 60 seconds.</p>
      <Button
        onClick={async () => {
          if (!pickedCountry) return;
          await useCountry.getState().set(pickedCountry);
          setStep(IS_PRO ? 1 : 2);
        }}
        disabled={!pickedCountry}
        className="w-full h-11 rounded-xl shadow-native cursor-pointer"
      >
        {pickedCountry ? "Continue" : "Pick a country"}
      </Button>
    </div>,

    // Step 1: Module selection
    <div key="module" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Pick your trade</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Omnix tailors itself to your business. Pick one to start — switch any time from Settings.
        </p>
      </div>
      <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1 -mr-1">
        {(Object.values(MODULE_DEFINITIONS) as Array<typeof MODULE_DEFINITIONS[ModuleId]>)
          .filter((m) => m.id !== "core")
          .filter((m) => MODULES_ALLOWED.includes(m.id))
          .filter((m) => isModuleEntitled(m.id))
          .map((m) => {
            const isPlanned = m.status === "planned";
            const isSelected = data.moduleId === m.id;
            return (
              <button
                key={m.id}
                type="button"
                disabled={isPlanned}
                onClick={() => update("moduleId", m.id)}
                className={`w-full text-left flex items-center gap-3 rounded-2xl border p-3.5 transition-all duration-200 ${
                  isSelected
                    ? "border-primary bg-primary/8 ring-2 ring-primary/15"
                    : isPlanned
                      ? "border-border opacity-50 cursor-not-allowed"
                      : "border-border/60 hover:border-primary/40 hover:bg-foreground/[0.03]"
                }`}
              >
                <ModuleLogo moduleId={m.id} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{m.name}</span>
                    {isPlanned && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">
                        Soon
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{m.tagline}</p>
                </div>
                {isSelected && <CheckCircle className="h-4 w-4 text-primary shrink-0" />}
              </button>
            );
          })}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(0)} className="flex-1 rounded-xl cursor-pointer">Back</Button>
        <Button onClick={() => setStep(2)} className="flex-1 rounded-xl cursor-pointer">Continue</Button>
      </div>
    </div>,

    // Step 2: Business info
    <div key="business" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Your business</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          This appears on receipts, invoices, and eTIMS submissions.
        </p>
      </div>
      <div className="space-y-3">
        <Field label="Business Name *">
          <Input
            placeholder={MODULE_DEFINITIONS[data.moduleId].setupPlaceholders.businessName}
            value={data.businessName}
            onChange={(e) => update("businessName", e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Address">
          <Input
            placeholder={MODULE_DEFINITIONS[data.moduleId].setupPlaceholders.address}
            value={data.address}
            onChange={(e) => update("address", e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <Input
            placeholder={MODULE_DEFINITIONS[data.moduleId].setupPlaceholders.phone}
            value={data.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            placeholder={MODULE_DEFINITIONS[data.moduleId].setupPlaceholders.email}
            value={data.email}
            onChange={(e) => update("email", e.target.value)}
          />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(IS_PRO ? 1 : 0)} className="flex-1 rounded-xl cursor-pointer">Back</Button>
        <Button
          onClick={() => setStep(3)}
          className="flex-1 rounded-xl cursor-pointer"
          disabled={!data.businessName}
        >
          Continue
        </Button>
      </div>
    </div>,

    // Step 3: Owner account
    <div key="owner" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Owner account</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          You'll sign in with this. Only you (the owner) can reset other users' passwords or change billing.
        </p>
      </div>
      <div className="space-y-3">
        <Field label="Your Full Name *">
          <Input
            placeholder="e.g., Jane Mwangi"
            value={data.ownerName}
            onChange={(e) => update("ownerName", e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Username *">
          <Input
            placeholder="e.g., jane"
            value={data.username}
            onChange={(e) => update("username", e.target.value.toLowerCase())}
            className="font-mono"
          />
        </Field>
        <Field label="Password *">
          <Input
            type="password"
            placeholder="At least 4 characters"
            value={data.password}
            onChange={(e) => update("password", e.target.value)}
          />
        </Field>
        <Field label="Confirm Password *">
          <Input
            type="password"
            placeholder="Repeat password"
            value={data.confirmPassword}
            onChange={(e) => update("confirmPassword", e.target.value)}
          />
        </Field>
      </div>

      {error && (
        <div className="border border-red-500/50 bg-red-500/5 rounded-md p-2.5 flex items-start gap-2">
          <WarningCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(2)} className="flex-1" disabled={submitting}>
          Back
        </Button>
        <Button
          onClick={() => {
            // Validate before going to next step
            if (data.password !== data.confirmPassword) {
              setError("Passwords don't match");
              return;
            }
            if (data.password.length < 4) {
              setError("Password must be at least 4 characters");
              return;
            }
            if (!data.username.match(/^[a-zA-Z0-9_]+$/)) {
              setError("Username can only contain letters, numbers, and underscores");
              return;
            }
            setError(null);
            setStep(4);
          }}
          className="flex-1 rounded-xl cursor-pointer"
          disabled={submitting || !data.ownerName || !data.username || !data.password || !data.confirmPassword}
        >
          Continue
        </Button>
      </div>
    </div>,

    // Step 4: Preferences (autostart)
    <div key="prefs" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Almost done</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          A few preferences before we finish
        </p>
      </div>

      <label className="flex items-start gap-3 border border-border rounded-lg p-4 cursor-pointer hover:bg-accent/30 transition-colors">
        <Checkbox checked={data.autostart} onCheckedChange={(v) => update("autostart", Boolean(v))} />
        <div className="flex-1">
          <p className="text-sm font-medium">Start {APP_NAME} when Windows boots</p>
          <p className="text-xs text-muted-foreground mt-1">
            Recommended for the master device. {APP_NAME} will launch automatically every time
            this PC turns on, so the LAN server is always reachable from cashier stations.
            You can change this later in Settings.
          </p>
        </div>
      </label>

      <div className="border border-border rounded-md p-3 bg-muted/20">
        <p className="text-xs text-muted-foreground">
          <strong>Note:</strong> If this is a cashier client station (not the main device),
          uncheck this — the staff will open {APP_NAME} manually when they start their shift.
        </p>
      </div>

      {error && (
        <div className="border border-red-500/50 bg-red-500/5 rounded-md p-2.5 flex items-start gap-2">
          <WarningCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(3)} className="flex-1" disabled={submitting}>
          Back
        </Button>
        <Button onClick={finish} className="flex-1" disabled={submitting}>
          {submitting ? (
            <><CircleNotch className="h-4 w-4 mr-2 animate-spin" /> Setting up...</>
          ) : (
            "Complete Setup"
          )}
        </Button>
      </div>
    </div>,
  ];

  return (
    <div className="glass-canvas relative flex h-screen w-full items-center justify-center p-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-80 w-80 rounded-full bg-primary/15 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-blue-500/10 blur-[140px]" />
      </div>
      <div className="relative z-10 w-full max-w-[460px] glass-thick rounded-glass-xl p-7 space-y-6">
        {/* Progress */}
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i <= step ? "bg-primary" : "bg-foreground/10"
              }`}
            />
          ))}
        </div>
        {steps[step]}
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
