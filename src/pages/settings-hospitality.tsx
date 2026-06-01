/**
 * Hospitality settings — service charge rule (single default rule, kept simple).
 * Tips are voluntary and handled at payment; this configures the auto service
 * charge percent applied at the order-pay step.
 */
import { useEffect, useState } from "react";
import { Percent } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { query, execute } from "@/lib/db";
import { toast } from "sonner";

export function HospitalitySettingsPage() {
  const [percent, setPercent] = useState("0");
  const [appliesTo, setAppliesTo] = useState<"dine_in" | "room_service" | "all">("dine_in");
  const [ruleId, setRuleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    query<{ id: string; percent: number; applies_to: string }>(
      `SELECT id, percent, applies_to FROM service_charge_rules WHERE active = 1 LIMIT 1`,
    ).then((rows) => {
      if (rows[0]) { setRuleId(rows[0].id); setPercent(String(rows[0].percent)); setAppliesTo(rows[0].applies_to as never); }
      setLoading(false);
    });
  }, []);

  const save = async () => {
    const pct = parseFloat(percent) || 0;
    if (ruleId) {
      await execute(`UPDATE service_charge_rules SET percent = ?2, applies_to = ?3 WHERE id = ?1`, [ruleId, pct, appliesTo]);
    } else {
      const id = crypto.randomUUID();
      await execute(
        `INSERT INTO service_charge_rules (id, name, percent, applies_to, active) VALUES (?1, 'Service charge', ?2, ?3, 1)`,
        [id, pct, appliesTo],
      );
      setRuleId(id);
    }
    toast.success("Service charge saved");
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-sm font-medium flex items-center gap-2"><Percent className="h-4 w-4" /> Service charge</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">Auto percent added at payment. Kept separate from product revenue and allocated to the waiter.</p>
        <div className="flex items-center gap-2 mt-3">
          <Input type="number" value={percent} onChange={(e) => setPercent(e.target.value)} className="w-24" step="0.5" />
          <span className="text-sm text-muted-foreground">%</span>
          <select value={appliesTo} onChange={(e) => setAppliesTo(e.target.value as never)} className="h-9 rounded-md border border-input bg-background px-2 text-sm cursor-pointer">
            <option value="dine_in">Dine-in only</option>
            <option value="room_service">Room service only</option>
            <option value="all">All orders</option>
          </select>
        </div>
      </div>
      <Button size="sm" onClick={save}>Save service charge</Button>
    </div>
  );
}
