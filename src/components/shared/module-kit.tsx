/**
 * Module UI kit — the shared visual language for the four trade module
 * screens (Dawa, Retail, Hardware, Hospitality).
 *
 * Design intent (per AGENTS.md + frontend-design skill):
 *  - Flat. Hairline borders, no drop shadows, no gradients on data surfaces.
 *  - One accent per module (teal / amber / orange / rose) — the same hues the
 *    POS and customer display already use, so a module feels like one product
 *    end to end. Colour never carries meaning alone; it sits beside a label.
 *  - Monospace, tabular numerals for every figure.
 *  - 8px rhythm.
 *
 * The signature device is the MASTHEAD: a left vertical accent rule + an
 * eyebrow that names the trade, with the screen title in a tight display
 * weight. It's the one memorable, repeated mark that brands each module
 * without decoration. Everything else stays quiet.
 */
import type { ReactNode } from "react";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { ModuleId } from "@/stores/active-module";

/* ── Per-module accent tokens ─────────────────────────────────────────── */

export interface ModuleAccent {
  /** Tailwind text colour for the accent (figures, icons, active links). */
  text: string;
  /** Faint accent wash for tiles/badges. */
  wash: string;
  /** Solid accent background (primary buttons, the masthead rule). */
  solid: string;
  /** Solid accent on hover. */
  solidHover: string;
  /** Border tint for accented tiles. */
  border: string;
  /** Plain bg class used for the thin masthead rule + KPI top-lines. */
  rule: string;
  /** The trade eyebrow shown above a screen title. */
  eyebrow: string;
}

const ACCENTS: Record<ModuleId, ModuleAccent> = {
  dawa: {
    text: "text-teal-700 dark:text-teal-400",
    wash: "bg-teal-500/10",
    solid: "bg-teal-700 text-white",
    solidHover: "hover:bg-teal-800",
    border: "border-teal-500/40",
    rule: "bg-teal-600",
    eyebrow: "Dawa · Pharmacy",
  },
  retail: {
    text: "text-amber-700 dark:text-amber-400",
    wash: "bg-amber-500/10",
    solid: "bg-amber-700 text-white",
    solidHover: "hover:bg-amber-800",
    border: "border-amber-500/40",
    rule: "bg-amber-600",
    eyebrow: "Retail",
  },
  hardware: {
    text: "text-orange-700 dark:text-orange-400",
    wash: "bg-orange-500/10",
    solid: "bg-orange-700 text-white",
    solidHover: "hover:bg-orange-800",
    border: "border-orange-500/40",
    rule: "bg-orange-600",
    eyebrow: "Hardware",
  },
  hospitality: {
    text: "text-rose-700 dark:text-rose-400",
    wash: "bg-rose-500/10",
    solid: "bg-rose-700 text-white",
    solidHover: "hover:bg-rose-800",
    border: "border-rose-500/40",
    rule: "bg-rose-600",
    eyebrow: "Hospitality",
  },
  core: {
    text: "text-primary",
    wash: "bg-primary/10",
    solid: "bg-primary text-primary-foreground",
    solidHover: "hover:bg-primary/90",
    border: "border-primary/40",
    rule: "bg-primary",
    eyebrow: "Omnix",
  },
  salon: {
    text: "text-pink-700 dark:text-pink-400",
    wash: "bg-pink-500/10",
    solid: "bg-pink-600 text-white",
    solidHover: "hover:bg-pink-700",
    border: "border-pink-500/40",
    rule: "bg-pink-600",
    eyebrow: "Salon & Spa",
  },
};

export function moduleAccent(id: ModuleId): ModuleAccent {
  return ACCENTS[id] ?? ACCENTS.core;
}

/* ── Masthead — the signature device ──────────────────────────────────── */

export function ModuleMasthead({
  accent,
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  accent: ModuleAccent;
  /** Override the default trade eyebrow (e.g. "Dawa · Controlled register"). */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-stretch gap-3">
        {/* the accent rule — the repeated mark that brands every screen */}
        <span aria-hidden className={cn("w-1 rounded-full shrink-0", accent.rule)} />
        <div>
          <div className={cn("text-[11px] font-medium uppercase tracking-[0.14em]", accent.text)}>
            {eyebrow ?? accent.eyebrow}
          </div>
          <h1 className="text-[22px] leading-tight font-semibold tracking-tight mt-0.5">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1 max-w-prose">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/* ── KPI tile — flat, accent top-line, mono figure ────────────────────── */

export function ModuleStat({
  label,
  value,
  accent,
  icon: IconCmp,
  tone = "default",
  hint,
  onClick,
}: {
  label: string;
  value: ReactNode;
  accent: ModuleAccent;
  icon?: Icon;
  tone?: "default" | "accent" | "danger";
  hint?: string;
  onClick?: () => void;
}) {
  const figureTone =
    tone === "danger" ? "text-red-600" : tone === "accent" ? accent.text : "text-foreground";
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-md border border-border bg-card p-4",
        onClick && "cursor-pointer transition-colors hover:bg-accent/30",
      )}
    >
      {/* thin accent top-line — the only colour on an idle tile */}
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5", tone === "danger" ? "bg-red-500" : accent.rule)} />
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
        {IconCmp && <IconCmp className={cn("h-3.5 w-3.5", tone === "danger" ? "text-red-500" : accent.text)} weight="bold" />}
      </div>
      <p className={cn("text-2xl font-semibold mt-2 font-mono tabular-nums", figureTone)}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

/* ── Data table chrome — consistent header + row treatment ────────────── */

export function ModuleTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("border border-border rounded-lg overflow-hidden", className)}>
      <table className="w-full text-[13px]">{children}</table>
    </div>
  );
}

export function ModuleTHead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
      {children}
    </thead>
  );
}

/* ── Empty + loading states ───────────────────────────────────────────── */

export function ModuleEmpty({
  icon: IconCmp,
  title,
  hint,
  action,
}: {
  icon?: Icon;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
      {IconCmp && <IconCmp className="h-9 w-9 text-muted-foreground/40 mb-3" />}
      <h3 className="text-sm font-medium">{title}</h3>
      {hint && <p className="text-xs text-muted-foreground mt-1 max-w-xs">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ModuleSpinner() {
  return (
    <div className="flex justify-center py-16">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
    </div>
  );
}
