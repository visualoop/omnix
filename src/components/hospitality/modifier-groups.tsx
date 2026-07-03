/**
 * ModifierGroups — nested CRUD editor for a menu item's modifier groups.
 * Sits on the MenuItemDetailPage under the Recipe section. Each group is
 * a Sauces / Sides / Doneness selector with 1..N options and optional
 * price deltas. Group `type` is single (radio) or multiple (checkboxes).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash, PencilSimple, Check } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirm } from "@/components/ui/confirm-dialog";
import {
  listModifierGroupsForItem,
  createModifierGroup,
  addModifierOption,
  removeModifierOption,
  deleteModifierGroup,
  type MenuModifierGroupFull,
} from "@/services/hospitality";
import { money as KES } from "@/lib/money";
import { cn } from "@/lib/utils";

interface Props {
  menuItemId: string;
}

export function ModifierGroups({ menuItemId }: Props) {
  const [groups, setGroups] = useState<MenuModifierGroupFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingGroup, setAddingGroup] = useState(false);

  const load = () => {
    setLoading(true);
    listModifierGroupsForItem(menuItemId)
      .then(setGroups)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [menuItemId]);

  if (loading) {
    return <div className="text-sm text-muted-foreground italic">Loading modifiers…</div>;
  }

  return (
    <div className="space-y-3">
      {groups.length === 0 && !addingGroup ? (
        <div className="text-sm text-muted-foreground italic">
          No modifier groups yet. Add one to let guests pick sauces, sides, or doneness.
        </div>
      ) : null}

      {groups.map((g) => (
        <GroupCard
          key={g.id}
          group={g}
          onChange={load}
        />
      ))}

      {addingGroup ? (
        <AddGroupForm
          menuItemId={menuItemId}
          onCancel={() => setAddingGroup(false)}
          onDone={() => { setAddingGroup(false); load(); }}
        />
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAddingGroup(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add modifier group
        </Button>
      )}
    </div>
  );
}

function GroupCard({ group, onChange }: { group: MenuModifierGroupFull; onChange: () => void }) {
  const [addingOption, setAddingOption] = useState(false);
  const [newOptName, setNewOptName] = useState("");
  const [newOptPrice, setNewOptPrice] = useState<string>("0");

  const saveOption = async () => {
    if (!newOptName.trim()) return;
    try {
      await addModifierOption(group.id, newOptName.trim(), Number(newOptPrice) || 0);
      setNewOptName("");
      setNewOptPrice("0");
      setAddingOption(false);
      onChange();
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{group.name}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted rounded px-1.5 py-0.5">
            {group.type === "single" ? "Pick one" : "Pick any"}
          </span>
          {group.required ? (
            <span className="text-[10px] uppercase tracking-wide text-rose-600 bg-rose-500/10 rounded px-1.5 py-0.5">
              Required
            </span>
          ) : null}
        </div>
        <button
          onClick={async () => {
            const ok = await confirm({
              title: `Delete "${group.name}"?`,
              description: "The group and every option under it will be removed. Order lines that already used this modifier keep their history.",
              confirmText: "Delete",
              cancelText: "Keep",
            });
            if (!ok) return;
            await deleteModifierGroup(group.id);
            onChange();
          }}
          className="text-muted-foreground hover:text-rose-600 transition-colors"
          title="Delete group"
        >
          <Trash className="h-4 w-4" />
        </button>
      </div>

      <ul className="space-y-1">
        {group.options.map((o) => (
          <li key={o.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-accent/30">
            <span className="flex-1">{o.name}</span>
            {o.price_delta ? (
              <span className="font-mono text-xs text-muted-foreground">+{KES(o.price_delta)}</span>
            ) : (
              <span className="font-mono text-[10px] text-muted-foreground/60">free</span>
            )}
            <button
              onClick={async () => { await removeModifierOption(o.id); onChange(); }}
              className="text-muted-foreground hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove option"
            >
              <Trash className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      {addingOption ? (
        <div className="flex items-center gap-2 mt-2">
          <Input
            value={newOptName}
            onChange={(e) => setNewOptName(e.target.value)}
            placeholder="Option name (e.g. Chilli)"
            className="h-8 text-sm flex-1"
            onKeyDown={(e) => { if (e.key === "Enter") saveOption(); }}
          />
          <Input
            type="number"
            step="0.01"
            value={newOptPrice}
            onChange={(e) => setNewOptPrice(e.target.value)}
            placeholder="Price +"
            className="h-8 text-sm w-24 font-mono"
          />
          <Button size="sm" onClick={saveOption}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <button
            onClick={() => { setAddingOption(false); setNewOptName(""); setNewOptPrice("0"); }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAddingOption(true)}
          className="mt-2 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> Add option
        </button>
      )}
    </div>
  );
}

function AddGroupForm({ menuItemId, onCancel, onDone }: { menuItemId: string; onCancel: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"single" | "multiple">("single");
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState<Array<{ name: string; price: string }>>([{ name: "", price: "0" }]);
  const [saving, setSaving] = useState(false);

  const patchOpt = (i: number, patch: Partial<{ name: string; price: string }>) => {
    setOptions((prev) => prev.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  };

  const save = async () => {
    if (!name.trim()) { toast.error("Group needs a name"); return; }
    const clean = options.filter((o) => o.name.trim());
    if (clean.length === 0) { toast.error("Add at least one option"); return; }
    setSaving(true);
    try {
      await createModifierGroup(menuItemId, {
        name: name.trim(),
        type,
        required,
        options: clean.map((o) => ({ name: o.name.trim(), priceDelta: Number(o.price) || 0 })),
      });
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Group name (e.g. Sauces)"
          autoFocus
        />
        <div className="flex items-center gap-2">
          <label className="text-xs flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              checked={type === "single"}
              onChange={() => setType("single")}
            />
            Pick one
          </label>
          <label className="text-xs flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              checked={type === "multiple"}
              onChange={() => setType("multiple")}
            />
            Pick any
          </label>
          <label className="text-xs flex items-center gap-1.5 cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
            />
            Required
          </label>
        </div>
      </div>

      <div className="space-y-1">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={o.name}
              onChange={(e) => patchOpt(i, { name: e.target.value })}
              placeholder={`Option ${i + 1}`}
              className="h-8 text-sm flex-1"
            />
            <Input
              type="number"
              step="0.01"
              value={o.price}
              onChange={(e) => patchOpt(i, { price: e.target.value })}
              placeholder="+"
              className="h-8 text-sm w-24 font-mono"
            />
            <button
              onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
              className="text-muted-foreground hover:text-rose-600"
              title="Remove"
            >
              <Trash className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setOptions((prev) => [...prev, { name: "", price: "0" }])}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add option
        </Button>
      </div>

      <div className="flex items-center gap-2 justify-end pt-2 border-t border-border">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save group"}
        </Button>
      </div>
    </div>
  );
}

/** Chip picker used at order-taking time — surfaces the modifier options
 *  and returns the guest's selection. */
export function ModifierPicker({
  groups,
  onSelectionsChange,
}: {
  groups: MenuModifierGroupFull[];
  onSelectionsChange: (selections: Array<{ modifierName: string; optionName: string; priceDelta: number }>) => void;
}) {
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  const toggle = (group: MenuModifierGroupFull, optionId: string) => {
    setSelections((prev) => {
      const current = prev[group.id] ?? [];
      let next: string[];
      if (group.type === "single") {
        next = current.includes(optionId) ? [] : [optionId];
      } else {
        next = current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId];
      }
      const updated = { ...prev, [group.id]: next };
      const out: Array<{ modifierName: string; optionName: string; priceDelta: number }> = [];
      for (const g of groups) {
        for (const optId of updated[g.id] ?? []) {
          const opt = g.options.find((o) => o.id === optId);
          if (opt) out.push({ modifierName: g.name, optionName: opt.name, priceDelta: opt.price_delta });
        }
      }
      onSelectionsChange(out);
      return updated;
    });
  };

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const selected = selections[g.id] ?? [];
        return (
          <div key={g.id}>
            <div className="text-xs font-medium mb-1">
              {g.name}
              {g.required ? <span className="text-rose-600 ml-1">*</span> : null}
              <span className="text-muted-foreground ml-2 text-[10px]">
                ({g.type === "single" ? "pick one" : "pick any"})
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {g.options.map((o) => {
                const active = selected.includes(o.id);
                return (
                  <button
                    key={o.id}
                    onClick={() => toggle(g, o.id)}
                    className={cn(
                      "text-xs rounded-full border px-2.5 py-1 transition-colors",
                      active
                        ? "border-foreground/30 bg-foreground/[0.06] text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {o.name}
                    {o.price_delta ? (
                      <span className="ml-1 font-mono text-[10px]">+{KES(o.price_delta)}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Silence unused imports if the caller doesn't wire everything. */
export const _ModifierGroupsPencil = PencilSimple;
