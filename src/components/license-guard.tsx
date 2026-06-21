import { useEffect, useState, type ReactNode } from "react";
import {
  CircleNotch as Loader2,
} from "@phosphor-icons/react";
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
 *
 * IMPORTANT: only the INITIAL load toggles `loading`. Periodic revalidation
 * happens silently — it updates the entitlements store + status object
 * without unmounting children. Otherwise every 5-minute revalidation
 * (or every window focus) would tear down and remount the setup wizard,
 * losing form state and triggering visible flicker.
 */
export function LicenseGuard({ children }: Props) {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const skipLicense = import.meta.env.VITE_SKIP_LICENSE === "1";

  // Silent fetch — does NOT touch `loading`, so children stay mounted.
  const fetchStatus = async (): Promise<LicenseStatus | null> => {
    try {
      const s = await getLicenseStatus();
      setStatus(s);
      useEntitlements.getState().setModules(s.activated ? s.modules : []);
      return s;
    } catch (e) {
      console.error("License check failed:", e);
      return null;
    }
  };

  // Initial load — shows spinner only on cold start, never on revalidation.
  useEffect(() => {
    if (skipLicense) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      await fetchStatus();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [skipLicense]);

  // Silent re-validation while the user works. Triggers:
  //   1. Once when the guard confirms an activated license
  //   2. Window focus (alt-tab back from the browser after paying)
  //   3. Every 5 minutes as a safety net
  // All three update entitlements in place — no spinner flicker, no
  // unmount of setup wizard / dashboard children.
  useEffect(() => {
    if (skipLicense || !status?.activated) return;
    let cancelled = false;
    const tick = () => {
      revalidateLicense().then((result) => {
        if (!cancelled && result !== null) fetchStatus();
      });
    };

    tick();
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
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
    // After the user activates from the activation page, the onActivated
    // callback below re-runs fetchStatus() — which sets activated=true,
    // children mount, no spinner.
    return <LicenseActivationPage onActivated={fetchStatus} />;
  }

  return <>{children}</>;
}
