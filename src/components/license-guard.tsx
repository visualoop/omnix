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

  // Silent re-validation during the online window. Runs once after the guard
  // confirms an activated license; offline failures are a no-op (offline-first).
  useEffect(() => {
    if (skipLicense || !status?.activated) return;
    let cancelled = false;
    revalidateLicense().then((result) => {
      // Server gave a definitive answer (revoked or refreshed entitlements):
      // re-pull status so the entitlements store + gate reflect it.
      if (!cancelled && result !== null) refresh();
    });
    return () => {
      cancelled = true;
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
