import { useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth";
import { runSetup } from "@/services/auth";
import { setAutostartEnabled } from "@/services/autostart";
import { SokoLogo } from "@/components/soko-logo";
import { APP_NAME } from "@/lib/brand";

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
}

export function SetupWizard() {
  const [step, setStep] = useState(0);
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
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setSetupComplete, setUser } = useAuthStore();

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
        business_type: "pharmacy",
        address: data.address,
        phone: data.phone,
        email: data.email,
        owner_name: data.ownerName,
        username: data.username,
        password: data.password,
      });

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
    // Step 0: Welcome
    <div key="welcome" className="space-y-5 text-center">
      <div className="inline-flex items-center justify-center">
        <SokoLogo size={64} />
      </div>
      <div>
        <h2 className="text-xl font-semibold">Welcome to {APP_NAME}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          The operating system for your business. Let's get you set up.
        </p>
      </div>
      <Button onClick={() => setStep(1)} className="w-full h-10">
        Get Started
      </Button>
    </div>,

    // Step 1: Business
    <div key="business" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Your Business</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tell us about your business
        </p>
      </div>
      <div className="space-y-3">
        <Field label="Business Name *">
          <Input
            placeholder="e.g., Afya Pharmacy"
            value={data.businessName}
            onChange={(e) => update("businessName", e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Address">
          <Input
            placeholder="e.g., Moi Avenue, Nairobi"
            value={data.address}
            onChange={(e) => update("address", e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <Input
            placeholder="0700 000 000"
            value={data.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            placeholder="info@yourpharmacy.co.ke"
            value={data.email}
            onChange={(e) => update("email", e.target.value)}
          />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(0)} className="flex-1">Back</Button>
        <Button
          onClick={() => setStep(2)}
          className="flex-1"
          disabled={!data.businessName}
        >
          Continue
        </Button>
      </div>
    </div>,

    // Step 2: Owner account
    <div key="owner" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Owner Account</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          You'll use this to sign in to {APP_NAME}
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
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(1)} className="flex-1" disabled={submitting}>
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
            setStep(3);
          }}
          className="flex-1"
          disabled={submitting || !data.ownerName || !data.username || !data.password || !data.confirmPassword}
        >
          Continue
        </Button>
      </div>
    </div>,

    // Step 3: Preferences (autostart)
    <div key="prefs" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Almost done</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          A few preferences before we finish
        </p>
      </div>

      <label className="flex items-start gap-3 border border-border rounded-lg p-4 cursor-pointer hover:bg-accent/30 transition-colors">
        <input
          type="checkbox"
          checked={data.autostart}
          onChange={(e) => update("autostart", e.target.checked)}
          className="mt-0.5 rounded"
        />
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
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(2)} className="flex-1" disabled={submitting}>
          Back
        </Button>
        <Button onClick={finish} className="flex-1" disabled={submitting}>
          {submitting ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Setting up...</>
          ) : (
            "Complete Setup"
          )}
        </Button>
      </div>
    </div>,
  ];

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-[440px] space-y-6">
        {/* Progress */}
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-primary" : "bg-muted"
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
