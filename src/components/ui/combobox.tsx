"use client";

/**
 * Searchable Combobox — shadcn-style searchable select.
 *
 * Used wherever a Select would have too many options to scan visually
 * (categories, brands, suppliers, customers in POS, etc.). Drop-in
 * replacement for `<Select>` with the same value/onChange pattern but
 * adds a search field at the top of the dropdown.
 *
 * Usage:
 *   <Combobox
 *     value={categoryId}
 *     onChange={setCategoryId}
 *     options={categories.map((c) => ({ value: c.id, label: c.name }))}
 *     placeholder="Pick a category"
 *     searchPlaceholder="Search categories…"
 *     emptyText="No matches"
 *     onCreate={async (label) => {
 *       const id = await createCategory(label);
 *       return { value: id, label };
 *     }}
 *   />
 */
import { useEffect, useRef, useState } from "react";
import {
  CaretDown as ChevronDown,
  Check,
  MagnifyingGlass as Search,
  Plus,
  X,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Optional secondary text shown right-aligned in the row. */
  hint?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** When provided, shows a "+ Create '<query>'" row when no results match. */
  onCreate?: (label: string) => Promise<ComboboxOption | null>;
  disabled?: boolean;
  className?: string;
}

export function Combobox({
  value, onChange, options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No matches",
  onCreate,
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const lower = query.trim().toLowerCase();
  const filtered = lower
    ? options.filter((o) => o.label.toLowerCase().includes(lower))
    : options;
  const showCreateRow = onCreate && lower !== "" && !filtered.some((o) => o.label.toLowerCase() === lower);

  // Focus the search input when the dropdown opens.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery("");
    }
  }, [open]);

  // Close on outside click / Esc.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.parentElement?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const handlePick = (opt: ComboboxOption) => {
    onChange(opt.value);
    setOpen(false);
  };

  const handleCreate = async () => {
    if (!onCreate || !lower) return;
    setCreating(true);
    try {
      const created = await onCreate(query.trim());
      if (created) {
        onChange(created.value);
        setOpen(false);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-[13px] text-foreground",
          "transition-colors hover:border-ring/50 focus:outline-none focus:ring-2 focus:ring-ring/30",
          disabled && "cursor-not-allowed opacity-60",
          !selected && "text-muted-foreground",
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate text-left">{selected?.label ?? placeholder}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-lg"
        >
          <div className="relative border-b border-border">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent px-3 py-2 pl-8 pr-8 text-[13px] outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter" && filtered[0]) {
                  e.preventDefault();
                  handlePick(filtered[0]);
                } else if (e.key === "Enter" && showCreateRow) {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-2 size-5 grid place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && !showCreateRow ? (
              <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                {emptyText}
              </div>
            ) : (
              filtered.map((opt) => {
                const active = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handlePick(opt)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/40",
                    )}
                  >
                    <Check className={cn("size-3.5 shrink-0", active ? "opacity-100" : "opacity-0")} />
                    <span className="flex-1 truncate">{opt.label}</span>
                    {opt.hint && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">{opt.hint}</span>
                    )}
                  </button>
                );
              })
            )}

            {showCreateRow && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-[13px] font-medium text-[var(--color-accent,theme(colors.primary.DEFAULT))] hover:bg-accent/30"
              >
                <Plus className="size-3.5" />
                {creating ? "Creating…" : `Create "${query.trim()}"`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
