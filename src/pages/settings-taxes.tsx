/**
 * Tax settings page.
 * Configure default tax rate, tax classes, and exempt product categories.
 */
import { useEffect, useState } from "react";
import { Percent, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { query, execute } from "@/lib/db";
import { toast } from "sonner";

export function TaxSettingsPage() {
  const [defaultRate, setDefaultRate] = useState("16");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    query<{ key: string; value: string }>(
      `SELECT key, value FROM settings WHERE key IN ('tax.default_rate')`,
    ).then((rows) => {
      const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      if (map["tax.default_rate"]) setDefaultRate(map["tax.default_rate"]);
      setLoading(false);
    });
  }, []);

  const saveRate = async () => {
    const rate = parseFloat(defaultRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error("Enter a valid tax rate (0-100)");
      return;
    }
    await execute(
      `INSERT INTO settings (key, value, category) VALUES ('tax.default_rate', ?1, 'tax')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [String(rate)],
    );
    toast.success("Default tax rate saved");
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Percent className="h-4 w-4" /> Default Tax Rate
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          This is the default VAT rate applied to new products. Products can override this individually.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <Input
            type="number"
            value={defaultRate}
            onChange={(e) => setDefaultRate(e.target.value)}
            className="w-24"
            step="0.1"
          />
          <span className="text-sm text-muted-foreground">%</span>
          <Button variant="outline" size="sm" onClick={saveRate}>Save</Button>
        </div>
      </div>

      <div className="border-t border-border" />

      <div>
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Package className="h-4 w-4" /> Tax Classes
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Common tax types used in Kenya. Configure per-product on the product form.
        </p>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between py-1.5 px-3 bg-muted/30 rounded">
            <span>Standard-rated (VAT 16%)</span>
            <span className="text-muted-foreground">Default</span>
          </div>
          <div className="flex justify-between py-1.5 px-3 bg-muted/30 rounded">
            <span>Zero-rated (0% VAT)</span>
            <span className="text-muted-foreground">Essential goods, exports</span>
          </div>
          <div className="flex justify-between py-1.5 px-3 bg-muted/30 rounded">
            <span>Exempt</span>
            <span className="text-muted-foreground">Medical, education, financial</span>
          </div>
        </div>
      </div>
    </div>
  );
}
