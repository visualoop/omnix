/**
 * StatStrip — compact multi-cell stat display used under the giant KES hero
 * on Dashboard + POS Overview.
 *
 * Design (frontend-design + emil-design-eng):
 *   - Mono 10px uppercase eyebrow above each value
 *   - 18-20px value (Fraunces optional; default is tabular mono for numbers)
 *   - Hairline dividers between cells
 *   - No card chrome; the strip sits on the newspaper masthead
 *
 * Renders as a horizontal row on mobile and a vertical stack on ≥lg,
 * matching the two-column hero pattern on the reference pages.
 */
import type { ReactNode } from "react";

export interface StatCell {
  /** UPPERCASE mono caption. Keep it 2-3 words max. */
  label: string;
  /** Rendered value. Pass a plain string for numbers, ReactNode for money-etc. */
  value: ReactNode;
  /** Optional accent — 'critical' turns the value red. Use sparingly. */
  tone?: "default" | "muted" | "critical" | "positive";
}

interface Props {
  cells: StatCell[];
  /** 'vertical' stacks on ≥lg (used in the wide-hero right column). */
  layout?: "auto" | "horizontal" | "vertical";
  className?: string;
}

const TONE_CLASS: Record<NonNullable<StatCell["tone"]>, string> = {
  default: "text-foreground",
  muted: "text-foreground/60",
  critical: "text-red-600 dark:text-red-400",
  positive: "text-emerald-600 dark:text-emerald-400",
};

export function StatStrip({ cells, layout = "auto", className }: Props) {
  if (cells.length === 0) return null;

  const containerCls =
    layout === "horizontal"
      ? "flex flex-wrap gap-x-8 gap-y-4"
      : layout === "vertical"
        ? "flex flex-col gap-3"
        : "flex flex-wrap gap-x-8 gap-y-4 lg:flex-col lg:gap-3 lg:divide-y lg:divide-foreground/10";

  return (
    <dl className={`${containerCls} ${className ?? ""}`}>
      {cells.map((c) => (
        <div key={c.label} className="min-w-[92px] lg:pt-3 lg:first:pt-0">
          <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/55">
            {c.label}
          </dt>
          <dd
            className={`mt-0.5 font-mono text-[18px] leading-tight tabular-nums ${
              TONE_CLASS[c.tone ?? "default"]
            }`}
          >
            {c.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
