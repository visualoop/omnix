/**
 * Hardware settings — sellable bulk units + default credit terms.
 * Pricing reuses the shared Price Lists page; commissions are managed inline
 * on the commissions report. Stored in the settings KV table.
 */
import { useEffect, useState } from "react";
import {
  CreditCard as CreditCard,
} from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { query, execute } from "@/lib/db";
import { toast } from "sonner";

export function HardwareSettingsPage() {
  const [termsDays, setTermsDays] = useState("30");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    query<{ key: string; value: string }>(
      `SELECT key, value FROM settings WHERE key = 'hardware.default_terms_days'`,
    ).then((rows) => {
      const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      if (map["hardware.default_terms_days"]) setTermsDays(map["hardware.default_terms_days"]);
      setLoading(false);
    });
  }, []);

  const save = async () => {
await execute(
      `INSERT INTO settings (key, value, category) VALUES ('hardware.default_terms_days', ?1, 'hardware')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [String(parseInt(termsDays, 10) || 30)],
    );
    toast.success("Hardware settings saved");
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-lg">
<div>
        <h3 className="text-sm font-medium flex items-center gap-2"><CreditCard className="h-4 w-4" /> Default credit terms</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">Default payment window (days) for new contractor accounts.</p>
        <div className="flex items-center gap-2 mt-3">
          <Input type="number" value={termsDays} onChange={(e) => setTermsDays(e.target.value)} className="w-24" />
          <span className="text-sm text-muted-foreground">days</span>
        </div>
      </div>
      <Button size="sm" onClick={save}>Save hardware settings</Button>
    </div>
  );
}
