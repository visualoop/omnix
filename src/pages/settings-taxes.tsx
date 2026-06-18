/**
 * Tax settings page.
 *
 * Configure how tax is applied across the app:
 *   - Mode: off / inclusive / exclusive
 *   - Default rate (number)
 *   - Label (VAT, GST, Sales Tax)
 *
 * Mode is the master switch:
 *   off        — tax disabled site-wide. POS shows no tax line. Receipts skip the row.
 *   inclusive  — selling price already contains tax. POS displays "Total (tax incl.)";
 *                tax extracted for reports + KRA eTIMS.
 *   exclusive  — tax added on top at checkout. Default for KE / classic VAT.
 */
import { useEffect, useState } from "react";
import { Percent, Package, Loader2, Wand2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { confirm } from "@/components/ui/confirm-dialog";
import { query, execute } from "@/lib/db";
import { invalidateTaxCache } from "@/services/tax";
import { useCartStore } from "@/stores/cart";
import { toast } from "sonner";

type TaxMode = "off" | "inclusive" | "exclusive";

export function TaxSettingsPage() {
  const [mode, setMode] = useState<TaxMode>("exclusive");
  const [defaultRate, setDefaultRate] = useState("16");
  const [label, setLabel] = useState("VAT");
  const [loading, setLoading] = useState(true);
  const [productCount, setProductCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const [settingsRows, countRows] = await Promise.all([
      query<{ key: string; value: string }>(
        `SELECT key, value FROM settings WHERE key IN ('tax.mode', 'tax.default_rate', 'tax.label')`,
      ),
      query<{ n: number }>(`SELECT COUNT(*) as n FROM products WHERE active = 1 AND COALESCE(kind,'physical') = 'physical'`),
    ]);
    const map = new Map(settingsRows.map((r) => [r.key, r.value]));
    const m = map.get("tax.mode");
    if (m === "off" || m === "inclusive" || m === "exclusive") setMode(m);
    if (map.get("tax.default_rate")) setDefaultRate(map.get("tax.default_rate") as string);
    if (map.get("tax.label")) setLabel(map.get("tax.label") as string);
    setProductCount(countRows[0]?.n ?? 0);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const saveAll = async () => {
    const rate = parseFloat(defaultRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error("Enter a valid tax rate (0-100)");
      return;
    }
    await Promise.all([
      execute(
        `INSERT INTO settings (key, value, category) VALUES ('tax.mode', ?1, 'tax')
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
        [mode],
      ),
      execute(
        `INSERT INTO settings (key, value, category) VALUES ('tax.default_rate', ?1, 'tax')
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
        [String(rate)],
      ),
      execute(
        `INSERT INTO settings (key, value, category) VALUES ('tax.label', ?1, 'tax')
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
        [label.trim() || "VAT"],
      ),
    ]);
    invalidateTaxCache();
    useCartStore.getState().setTaxMode(mode);
    toast.success("Tax settings saved", {
      description: mode === "off"
        ? "Tax disabled. POS will hide the tax line."
        : `Mode: ${mode === "inclusive" ? "tax-inclusive pricing" : "tax-exclusive pricing"}.`,
    });
  };

  const applyToAllProducts = async () => {
    const rate = parseFloat(defaultRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error("Save a valid rate first");
      return;
    }
    const ok = await confirm({
      title: `Apply ${rate}% ${label} to all ${productCount} products?`,
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
      toast.success(`Updated ${productCount} products to ${rate}% ${label}`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-lg">
      {/* Mode picker */}
      <div>
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Percent className="h-4 w-4" /> Tax mode
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Master switch for how tax is computed across POS, receipts, and reports.
        </p>
        <Select value={mode} onValueChange={(v) => setMode(v as TaxMode)}>
          <SelectTrigger className="w-full mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="off">Off — no tax anywhere</SelectItem>
            <SelectItem value="exclusive">Exclusive — tax added at checkout (classic VAT)</SelectItem>
            <SelectItem value="inclusive">Inclusive — selling price already contains tax</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Label */}
      <div>
        <h3 className="text-sm font-medium">Tax label</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Shown on receipts, reports, and the POS cart total.
          Common values: VAT (Kenya / EU), GST (Australia / India / NZ), Sales Tax (US).
        </p>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="mt-2 w-32"
          maxLength={16}
          disabled={mode === "off"}
        />
      </div>

      {/* Default rate */}
      <div>
        <h3 className="text-sm font-medium">Default rate</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Default tax applied to new products. Existing products keep their own rate
          until you tap <strong>Apply to all products</strong> below.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Input
            type="number"
            value={defaultRate}
            onChange={(e) => setDefaultRate(e.target.value)}
            className="w-24"
            step="0.1"
            disabled={mode === "off"}
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </div>

      <Button onClick={saveAll}>Save tax settings</Button>

      <div className="border-t border-border" />

      <div className="border border-border rounded-lg p-3 bg-amber-500/5">
        <div className="text-sm font-medium flex items-center gap-1.5">
          <Wand2 className="h-3.5 w-3.5 text-amber-600" />
          Apply default rate to all existing products
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
          disabled={busy || productCount === 0 || mode === "off"}
          className="mt-2 cursor-pointer"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
          Apply {defaultRate}% to all {productCount} products
        </Button>
      </div>

      <div className="border-t border-border" />

      <div>
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Package className="h-4 w-4" /> Tax classes
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Common tax types. Configure per-product on the product form.
        </p>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between py-1.5 px-3 bg-muted/30 rounded">
            <span>Standard-rated ({label} {defaultRate}%)</span>
            <span className="text-muted-foreground">Default</span>
          </div>
          <div className="flex justify-between py-1.5 px-3 bg-muted/30 rounded">
            <span>Zero-rated (0%)</span>
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
