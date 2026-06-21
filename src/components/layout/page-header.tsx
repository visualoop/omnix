/**
 * PageHeader — newspaper-masthead pattern reusable across the app.
 *
 * Use this on any page that wants the editorial design language.
 * Pages that already have their own custom layout (POS sale, POS overview,
 * P&L, dashboard, settings) keep their existing chrome and don't use this.
 *
 * Layout (frontend-design + emil-design-eng):
 *   - Mono uppercase 10 px eyebrow above the title
 *   - Fraunces serif title at clamp(24 px, 3 vw, 32 px), weight 500
 *   - Optional 14 px description with 1.55 leading, max 60 ch wide
 *   - Optional right-aligned actions slot (buttons, Combobox, etc.)
 *   - Hairline border-b — a single 1 px foreground/10 line, no card chrome
 *
 * Example:
 *   <PageHeader
 *     eyebrow="Operations"
 *     title="Suppliers"
 *     description="Vendors, terms, contacts."
 *     actions={<Button size="sm"><Plus /> New supplier</Button>}
 *   />
 */
import type { ReactNode } from "react";

interface Props {
  /** Mono caption above the title (e.g. 'Operations', 'HR', 'Finance'). */
  eyebrow?: string;
  /** Display title — set in Fraunces. */
  title: string;
  /** 1–2 short sentences. Plain language, no marketing-speak. */
  description?: string;
  /** Right-aligned actions slot (buttons, search, filters). */
  actions?: ReactNode;
  /** Optional className override on the outer wrapper. */
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: Props) {
  return (
    <header
      className={`flex flex-col gap-4 border-b border-foreground/10 pb-5 lg:flex-row lg:items-end lg:justify-between ${className ?? ""}`}
    >
      <div>
        {eyebrow ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {eyebrow}
          </span>
        ) : null}
        <h1
          style={{ fontFamily: "var(--font-display, serif)" }}
          className="mt-1.5 text-[clamp(24px,3vw,32px)] font-medium leading-[1.05] tracking-[-0.01em]"
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-[60ch] text-[13px] leading-[1.55] text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
