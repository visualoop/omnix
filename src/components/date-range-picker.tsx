/**
 * DateRangePicker — a compact date-range control with preset chips.
 *
 * Presets: Today · Yesterday · Last 7 · Last 30 · Month · YTD · Custom.
 * Renders two <input type="date"> pickers side-by-side and a chip row above.
 * On preset click, both dates snap to the corresponding range. On manual edit,
 * the "Custom" chip is highlighted.
 *
 * Consumers pass `value` = { start, end } and `onChange` = (next) => void.
 * All dates are YYYY-MM-DD strings (ISO date only, no time zone drift).
 */
import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = () => iso(new Date());
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86400000));
const monthStart = () => {
  const d = new Date();
  return iso(new Date(d.getFullYear(), d.getMonth(), 1));
};
const yearStart = () => {
  const d = new Date();
  return iso(new Date(d.getFullYear(), 0, 1));
};

export type DateRangePreset = "today" | "yesterday" | "7d" | "30d" | "month" | "ytd" | "custom";

export function presetToRange(p: DateRangePreset): DateRange {
  switch (p) {
    case "today": return { start: today(), end: today() };
    case "yesterday": return { start: daysAgo(1), end: daysAgo(1) };
    case "7d": return { start: daysAgo(6), end: today() };
    case "30d": return { start: daysAgo(29), end: today() };
    case "month": return { start: monthStart(), end: today() };
    case "ytd": return { start: yearStart(), end: today() };
    case "custom": return { start: daysAgo(29), end: today() };
  }
}

function rangeMatchesPreset(r: DateRange, p: DateRangePreset): boolean {
  const target = presetToRange(p);
  return target.start === r.start && target.end === r.end;
}

const PRESETS: { key: DateRangePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "month", label: "This month" },
  { key: "ytd", label: "YTD" },
];

interface Props {
  value: DateRange;
  onChange: (next: DateRange) => void;
  className?: string;
  compact?: boolean;
}

export function DateRangePicker({ value, onChange, className, compact = false }: Props) {
  const activePreset = useMemo<DateRangePreset>(() => {
    for (const p of PRESETS) if (rangeMatchesPreset(value, p.key)) return p.key;
    return "custom";
  }, [value]);

  const inputCls = compact ? "h-7 w-32 text-xs" : "h-8 w-36 text-xs";

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <div className="flex items-center gap-1 mr-1">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(presetToRange(p.key))}
            className={cn(
              "px-2 py-1 rounded text-[11px] font-medium transition-colors",
              activePreset === p.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <Input
        type="date"
        value={value.start}
        max={value.end}
        onChange={(e) => onChange({ ...value, start: e.target.value })}
        className={inputCls}
      />
      <span className="text-xs text-muted-foreground">→</span>
      <Input
        type="date"
        value={value.end}
        min={value.start}
        onChange={(e) => onChange({ ...value, end: e.target.value })}
        className={inputCls}
      />
    </div>
  );
}
