/**
 * AllergenPicker — click-to-toggle chip list for common allergens,
 * plus a free-text "add other" input for edge cases (mustard, celery,
 * mollusks, sulphites — anything the standard set misses).
 *
 * Stored as a comma-separated string on menu_items.allergens so the
 * KDS ticket + POS receipt can render a compact pill list.
 */
import { useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const COMMON = [
  "dairy",
  "gluten",
  "nuts",
  "egg",
  "soy",
  "shellfish",
  "fish",
  "pork",
  "mustard",
  "sesame",
  "celery",
  "sulphites",
];

interface Props {
  value: string; // comma-separated
  onChange: (v: string) => void;
}

function parse(csv: string): string[] {
  return csv
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function join(arr: string[]): string {
  return Array.from(new Set(arr)).join(", ");
}

export function AllergenPicker({ value, onChange }: Props) {
  const selected = new Set(parse(value));
  const [custom, setCustom] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const toggle = (tag: string) => {
    const next = new Set(selected);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    onChange(join(Array.from(next)));
  };

  const addCustom = () => {
    const clean = custom.trim().toLowerCase();
    if (!clean) return;
    const next = new Set(selected);
    next.add(clean);
    onChange(join(Array.from(next)));
    setCustom("");
    setAddOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {COMMON.map((tag) => {
          const active = selected.has(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={cn(
                "text-xs rounded-full border px-2.5 py-1 transition-colors capitalize",
                active
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {tag}
            </button>
          );
        })}
        {/* Custom tags — ones the operator added but that aren't in COMMON. */}
        {Array.from(selected).filter((t) => !COMMON.includes(t)).map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            className="text-xs rounded-full border border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400 px-2.5 py-1 capitalize inline-flex items-center gap-1"
          >
            {tag}
            <X className="h-2.5 w-2.5 opacity-60" />
          </button>
        ))}
        {addOpen ? (
          <div className="inline-flex items-center gap-1">
            <Input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addCustom(); }
                if (e.key === "Escape") { setAddOpen(false); setCustom(""); }
              }}
              autoFocus
              placeholder="e.g. lupin"
              className="h-7 text-xs w-24"
            />
            <button
              type="button"
              onClick={addCustom}
              className="text-[11px] text-primary hover:underline"
            >
              add
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="text-xs rounded-full border border-dashed border-border px-2.5 py-1 text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
          >
            <Plus className="h-3 w-3" /> other
          </button>
        )}
      </div>
    </div>
  );
}
