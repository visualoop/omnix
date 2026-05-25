import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { getLicenseStatus, type LicenseStatus } from "@/services/license";
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
    } catch (e) {
      console.error("License check failed:", e);
      // Fail closed: if we can't verify, treat as unactivated
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
