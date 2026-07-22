import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

interface Props {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ eyebrow, title, description, actions, className }: Props) {
  return (
    <header
      className={cn(
        'flex min-w-0 flex-col gap-5 border-b border-[var(--color-border)] pb-6',
        'md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
            {eyebrow}
          </span>
        ) : null}
        <h1 className="mt-1.5 max-w-[24ch] font-display text-[clamp(28px,4vw,40px)] font-semibold leading-none tracking-[-0.04em] text-[var(--color-fg)] text-balance">
          {title}
        </h1>
        {description ? (
          <p className="mt-2.5 max-w-[64ch] text-[14px] leading-6 text-[var(--color-fg-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 md:w-auto md:justify-end max-sm:[&>*]:w-full">
          {actions}
        </div>
      ) : null}
    </header>
  )
}
