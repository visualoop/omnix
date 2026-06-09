import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { getLicenseStatus, revalidateLicense, type LicenseStatus } from "@/services/license";
import { useEntitlements } from "@/stores/entitlements";
import { LicenseActivationPage } from "@/pages/license-activation";

interface Props {
  children: ReactNode;
}

/**
 * Gates the app behind license activation.
 * Shows LicenseActivationPage if no valid license, otherwise renders children.
 *
 * Set VITE_SKIP_LICENSE=1 in .env.development to bypass during development.
 */
export function LicenseGuard({ children }: Props) {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const skipLicense = import.meta.env.VITE_SKIP_LICENSE === "1";

  const refresh = async () => {
    setLoading(true);
    try {
      const s = await getLicenseStatus();
      setStatus(s);
      useEntitlements.getState().setModules(s.activated ? s.modules : []);
    } catch (e) {
      console.error("License check failed:", e);
      setStatus(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (skipLicense) {
      setLoading(false);
      return;
    }
    refresh();
  }, [skipLicense]);

  // Silent re-validation during the online window.
  //
  // Triggers:
  //   1. Once after the guard confirms an activated license (covers the
  //      cold-start case)
  //   2. Every time the window regains focus (covers "user paid in browser
  //      then alt-tabbed back" — flips trial → active in ~2 seconds, no
  //      restart needed)
  //   3. Every 5 minutes while the window is open (catches background-paid
  //      cases like webhook delays or staff payments on a different device)
  //
  // All three are a no-op when offline (offline-first; never blocks the UI).
  useEffect(() => {
    if (skipLicense || !status?.activated) return;
    let cancelled = false;
    const tick = () => {
      revalidateLicense().then((result) => {
        if (!cancelled && result !== null) refresh();
      });
    };

    // (1) immediate
    tick();

    // (2) window focus — fires when alt-tabbing back from the browser
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);

    // (3) every 5 minutes as a safety net
    const interval = setInterval(tick, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, [skipLicense, status?.activated]);

  if (skipLicense) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status?.activated) {
    return <LicenseActivationPage onActivated={refresh} />;
  }

  return <>{children}</>;
}
