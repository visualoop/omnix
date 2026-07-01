import { useEffect, useState } from "react";
import { Power } from "@phosphor-icons/react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/brand";

/**
 * /settings/autostart — toggle whether the app launches on Windows boot.
 *
 * Previously bolted onto Business Profile alongside the update checker.
 * Now stands on its own under the Application tab.
 */
export function SettingsAutostartPage() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    import("@/services/autostart").then(({ getAutostartEnabled }) =>
      getAutostartEnabled().then((v) => {
        setEnabled(v);
        setLoading(false);
      }),
    );
  }, []);

  const toggle = async (next: boolean) => {
    setUpdating(true);
    try {
      const { setAutostartEnabled } = await import("@/services/autostart");
      await setAutostartEnabled(next);
      setEnabled(next);
      toast.success(next ? "Will start with Windows" : "Auto-start disabled");
    } catch (e) {
      toast.error("Failed to update auto-start: " + e);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="border border-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-2">
          <Power className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Start with Windows</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          Recommended for the master device. {APP_NAME} launches automatically when this PC
          boots, so the LAN server is always reachable from cashier stations and the app is
          ready when the shift starts.
        </p>
        {loading ? (
          <p className="text-xs text-muted-foreground">Checking...</p>
        ) : (
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm">{enabled ? "Enabled" : "Disabled"}</span>
            <Checkbox
              checked={enabled}
              onCheckedChange={(v) => toggle(Boolean(v))}
              disabled={updating}
            />
          </label>
        )}
      </div>
    </div>
  );
}
