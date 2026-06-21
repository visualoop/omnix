/**
 * Receipt settings — configurable footer message + powered-by line.
 * Stored in the settings KV table; read by services/receipt.ts at print time.
 */
import { useEffect, useState } from "react";
import {
  Receipt,
} from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { query, execute } from "@/lib/db";
import { toast } from "sonner";

export function ReceiptSettingsPage() {
  const [footer, setFooter] = useState("Thank you for shopping with us!");
  const [showPoweredBy, setShowPoweredBy] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    query<{ key: string; value: string }>(
      `SELECT key, value FROM settings WHERE key IN ('receipt.footer', 'receipt.show_powered_by')`,
    ).then((rows) => {
      const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      if (map["receipt.footer"] !== undefined) setFooter(map["receipt.footer"]);
      if (map["receipt.show_powered_by"] !== undefined) setShowPoweredBy(map["receipt.show_powered_by"] !== "0");
      setLoading(false);
    });
  }, []);

  const save = async () => {
    await execute(
      `INSERT INTO settings (key, value, category) VALUES ('receipt.footer', ?1, 'receipt')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [footer],
    );
    await execute(
      `INSERT INTO settings (key, value, category) VALUES ('receipt.show_powered_by', ?1, 'receipt')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [showPoweredBy ? "1" : "0"],
    );
    toast.success("Receipt settings saved");
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Receipt className="h-4 w-4" /> Receipt Footer
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Printed at the bottom of every customer receipt. Keep it short.
        </p>
        <Input
          value={footer}
          onChange={(e) => setFooter(e.target.value)}
          className="mt-3"
          placeholder="Thank you for shopping with us!"
          maxLength={120}
        />
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <div>
          <div className="text-sm font-medium">Show “Powered by Omnix”</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Small credit line under the footer.</p>
        </div>
        <Switch checked={showPoweredBy} onCheckedChange={setShowPoweredBy} />
      </div>

      <Button size="sm" onClick={save}>Save receipt settings</Button>
    </div>
  );
}
