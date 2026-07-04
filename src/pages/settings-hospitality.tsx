/**
 * Hospitality settings — service charge rule (single default rule, kept
 * simple) + kitchen behaviour flags (auto-fire, require-recipe-to-sell).
 * Tips are voluntary and handled at payment; this configures the auto
 * service charge percent applied at the order-pay step.
 */
import { useEffect, useState } from "react";
import {
  Percent, ForkKnife, Fire,
} from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { query, execute } from "@/lib/db";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Setting keys — kept in one place so the read/write paths agree. */
const K_REQUIRE_RECIPE = "hospitality.require_recipe_to_sell";
const K_AUTO_FIRE = "hospitality.auto_fire";

export function HospitalitySettingsPage() {
  const [percent, setPercent] = useState("0");
  const [appliesTo, setAppliesTo] = useState<"dine_in" | "room_service" | "all">("dine_in");
  const [ruleId, setRuleId] = useState<string | null>(null);
  const [requireRecipe, setRequireRecipe] = useState(false);
  const [autoFire, setAutoFire] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      query<{ id: string; percent: number; applies_to: string }>(
        `SELECT id, percent, applies_to FROM service_charge_rules WHERE active = 1 LIMIT 1`,
      ),
      query<{ key: string; value: string }>(
        `SELECT key, value FROM settings WHERE key IN (?1, ?2)`,
        [K_REQUIRE_RECIPE, K_AUTO_FIRE],
      ),
    ]).then(([rules, flags]) => {
      if (rules[0]) { setRuleId(rules[0].id); setPercent(String(rules[0].percent)); setAppliesTo(rules[0].applies_to as never); }
      const flagMap = new Map(flags.map((f) => [f.key, f.value]));
      setRequireRecipe(flagMap.get(K_REQUIRE_RECIPE) === "on");
      // Auto-fire default is ON — only OFF if explicitly set to "off".
      setAutoFire(flagMap.get(K_AUTO_FIRE) !== "off");
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

  const upsertFlag = async (key: string, value: string) => {
    const mod = await import("@/services/hospitality");
    if (key === K_AUTO_FIRE) {
      await mod.setAutoFire(value === "on");
    } else if (key === K_REQUIRE_RECIPE) {
      await mod.setRequireRecipeToSell(value === "on");
    }
  };

  const toggleRequireRecipe = async (next: boolean) => {
    setRequireRecipe(next);
    try {
      await upsertFlag(K_REQUIRE_RECIPE, next ? "on" : "off");
      toast.success(next ? "Menu items now require a recipe to sell" : "Menu items can be sold without a recipe");
    } catch (e) {
      setRequireRecipe(!next);
      toast.error(String(e));
    }
  };

  const toggleAutoFire = async (next: boolean) => {
    setAutoFire(next);
    try {
      await upsertFlag(K_AUTO_FIRE, next ? "on" : "off");
      toast.success(next ? "Items now auto-fire to the kitchen" : "Items require manual 'Send to kitchen'");
    } catch (e) {
      setAutoFire(!next);
      toast.error(String(e));
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Kitchen behaviour */}
      <section>
        <h3 className="text-sm font-medium flex items-center gap-2"><Fire className="h-4 w-4" /> Kitchen behaviour</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">How the app moves orders from the floor to the kitchen and back.</p>
        <div className="mt-3 space-y-2">
          <SettingRow
            label="Auto-fire to kitchen"
            hint="When on, items appear on the KDS the moment they are added. Matches Toast, Square, Chowbus defaults."
            value={autoFire}
            onChange={toggleAutoFire}
          />
          <SettingRow
            label="Require recipe to sell"
            hint="When on, order-taking + POS refuse to add a menu item that has no recipe attached. Prevents 'silent sells' where ingredient stock never decrements. Recommended for full-service restaurants with strict food-cost targets."
            value={requireRecipe}
            onChange={toggleRequireRecipe}
          />
        </div>
      </section>

      {/* Service charge */}
      <section>
        <h3 className="text-sm font-medium flex items-center gap-2"><Percent className="h-4 w-4" /> Service charge</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">Auto percent added at payment. Kept separate from product revenue and allocated to the waiter.</p>
        <div className="flex items-center gap-2 mt-3">
          <Input type="number" value={percent} onChange={(e) => setPercent(e.target.value)} className="w-24" step="0.5" />
          <span className="text-sm text-muted-foreground">%</span>
          <Select value={appliesTo} onValueChange={(v) => setAppliesTo(v as never)}>
            <SelectTrigger className="h-9 text-sm w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dine_in">Dine-in only</SelectItem>
              <SelectItem value="room_service">Room service only</SelectItem>
              <SelectItem value="all">All orders</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={save} className="mt-3">Save service charge</Button>
      </section>
    </div>
  );
}

function SettingRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium flex items-center gap-1.5">
          <ForkKnife className="h-3.5 w-3.5 text-muted-foreground" />
          {label}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          "shrink-0 relative w-10 h-6 rounded-full transition-colors",
          value ? "bg-primary" : "bg-muted",
        )}
        aria-pressed={value}
        aria-label={label}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background transition-transform",
            value ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}
