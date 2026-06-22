import type { ReactNode } from 'react'

interface Props {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ eyebrow, title, description, actions, className }: Props) {
  return (
    <header className={`flex flex-col gap-4 border-b border-[var(--color-border)] pb-5 lg:flex-row lg:items-end lg:justify-between ${className ?? ''}`}>
      <div>
        {eyebrow ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
            {eyebrow}
          </span>
        ) : null}
        <h1
          style={{ fontFamily: 'var(--font-display, serif)' }}
          className="mt-1.5 text-[clamp(24px,3vw,32px)] font-medium leading-[1.05] tracking-[-0.01em] text-[var(--color-fg)]"
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-[60ch] text-[13px] leading-[1.55] text-[var(--color-fg-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  )
}
