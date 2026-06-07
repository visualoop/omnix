/**
 * Tax settings page.
 *
 * Configure the default VAT rate. New products inherit it; existing
 * products keep their per-product rate UNTIL the operator clicks
 * "Apply to all products" — that bulk-updates every product's tax_rate
 * to match. Necessary because Omnix products had a hard-coded 16%
 * default before this setting existed, so operators who set 0% here
 * still saw 16% at POS.
 */
import { useEffect, useState } from "react";
import { Percent, Package, Loader2, Wand2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { confirm } from "@/components/ui/confirm-dialog";
import { query, execute } from "@/lib/db";
import { toast } from "sonner";

export function TaxSettingsPage() {
  const [defaultRate, setDefaultRate] = useState("16");
  const [loading, setLoading] = useState(true);
  const [productCount, setProductCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const [settingsRows, countRows] = await Promise.all([
      query<{ key: string; value: string }>(
        `SELECT key, value FROM settings WHERE key = 'tax.default_rate'`,
      ),
      query<{ n: number }>(`SELECT COUNT(*) as n FROM products WHERE active = 1 AND COALESCE(kind,'physical') = 'physical'`),
    ]);
    if (settingsRows[0]?.value) setDefaultRate(settingsRows[0].value);
    setProductCount(countRows[0]?.n ?? 0);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

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
    toast.success("Default tax rate saved", {
      description: "New products will use this rate. Tap 'Apply to all products' to update existing items.",
    });
  };

  const applyToAllProducts = async () => {
    const rate = parseFloat(defaultRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error("Save a valid rate first");
      return;
    }
    const ok = await confirm({
      title: `Apply ${rate}% VAT to all ${productCount} products?`,
      description:
        "Every existing product's tax rate will change to the new default. " +
        "This affects all future POS sales. You can still override per-product later.",
      confirmText: "Apply",
    });
    if (!ok) return;

    setBusy(true);
    try {
      await execute(
        `UPDATE products SET tax_rate = ?1 WHERE active = 1 AND COALESCE(kind,'physical') = 'physical'`,
        [rate],
      );
      toast.success(`Updated ${productCount} products to ${rate}% VAT`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Percent className="h-4 w-4" /> Default Tax Rate
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Default VAT applied to new products. Existing products keep their own rate
          until you tap <strong>Apply to all products</strong> below.
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

        <div className="mt-4 border border-border rounded-lg p-3 bg-amber-500/5">
          <div className="text-sm font-medium flex items-center gap-1.5">
            <Wand2 className="h-3.5 w-3.5 text-amber-600" />
            Apply to all existing products
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            Bulk-updates every active product's tax rate to {defaultRate}%. Use this when you
            change your VAT registration status (e.g. de-registered → 0%) and want every
            future sale to reflect the new rate.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={applyToAllProducts}
            disabled={busy || productCount === 0}
            className="mt-2 cursor-pointer"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Apply {defaultRate}% to all {productCount} products
          </Button>
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
