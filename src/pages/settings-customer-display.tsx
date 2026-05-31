/**
 * Customer display settings page.
 * Controls what shows on the second-screen customer display.
 */
import { useEffect, useState } from "react";
import { Monitor, Eye, Receipt, User } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { query, execute } from "@/lib/db";
import { openCustomerDisplay, closeCustomerDisplay, isCustomerDisplayOpen } from "@/lib/customer-display";
import { toast } from "sonner";

export function CustomerDisplaySettingsPage() {
  const [privacy, setPrivacy] = useState(false);
  const [showTax, setShowTax] = useState(true);
  const [showCustomer, setShowCustomer] = useState(true);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      query<{ key: string; value: string }>(
        `SELECT key, value FROM settings WHERE key IN ('customer_display.privacy','customer_display.show_tax','customer_display.show_customer')`,
      ),
      isCustomerDisplayOpen(),
    ]).then(([rows, open]) => {
      const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      setPrivacy(map["customer_display.privacy"] === "1");
      setShowTax(map["customer_display.show_tax"] !== "0");
      setShowCustomer(map["customer_display.show_customer"] !== "0");
      setDisplayOpen(open);
      setLoading(false);
    });
  }, []);

  const save = async (key: string, value: string) => {
    await execute(
      `INSERT INTO settings (key, value, category) VALUES (?1, ?2, 'customer_display')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [key, value],
    );
  };

  const toggleDisplay = async () => {
    try {
      if (displayOpen) {
        await closeCustomerDisplay();
        setDisplayOpen(false);
        toast.success("Customer display closed");
      } else {
        await openCustomerDisplay();
        setDisplayOpen(true);
        toast.success("Customer display opened");
      }
    } catch (e) {
      toast.error(String(e));
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Monitor className="h-4 w-4" /> Test Display
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Open a window on your second monitor to preview the customer-facing screen.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={toggleDisplay}>
          {displayOpen ? "Close" : "Open"} Display
        </Button>
      </div>

      <div className="border-t border-border" />

      <SettingToggle
        icon={Eye}
        label="Privacy mode (pharmacy)"
        description="When enabled, product names are hidden on the customer display in pharmacy mode."
        checked={privacy}
        onChange={(v) => { setPrivacy(v); save("customer_display.privacy", v ? "1" : "0"); }}
      />

      <SettingToggle
        icon={Receipt}
        label="Show tax breakdown"
        description="Display tax line separately on totals."
        checked={showTax}
        onChange={(v) => { setShowTax(v); save("customer_display.show_tax", v ? "1" : "0"); }}
      />

      <SettingToggle
        icon={User}
        label="Show customer name"
        description="Show the selected customer name on the display."
        checked={showCustomer}
        onChange={(v) => { setShowCustomer(v); save("customer_display.show_customer", v ? "1" : "0"); }}
      />
    </div>
  );
}

function SettingToggle({ icon: Icon, label, description, checked, onChange }: {
  icon: typeof Monitor;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-2.5">
        <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{description}</div>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
