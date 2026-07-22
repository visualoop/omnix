import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'

export interface EntityHeroStat {
  label: string
  value: ReactNode
  tone?: 'muted' | 'positive' | 'warning' | 'danger'
}

export interface EntityHeroBadge {
  label: string
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}

interface Props {
  eyebrow?: string
  title: string
  subtitle?: ReactNode
  badges?: EntityHeroBadge[]
  actions?: ReactNode
  stats?: EntityHeroStat[]
  className?: string
}

const TONE: Record<NonNullable<EntityHeroStat['tone']>, string> = {
  muted: 'text-[var(--color-fg)]',
  positive: 'text-[var(--color-positive)]',
  warning: 'text-[var(--color-caution)]',
  danger: 'text-[var(--color-negative)]',
}

/** Responsive entity header shared by customer and staff detail pages. */
export function EntityHero({ eyebrow, title, subtitle, badges, actions, stats, className }: Props) {
  return (
    <header className={cn('min-w-0 border-b border-[var(--color-border)] pb-6', className)}>
      <div className="flex min-w-0 flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
              {eyebrow}
            </span>
          ) : null}
          <h1 className="mt-1 max-w-[24ch] font-display text-[clamp(30px,4.5vw,48px)] font-semibold leading-none tracking-[-0.045em] text-[var(--color-fg)] text-balance">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-3 max-w-[68ch] text-[14px] leading-6 text-[var(--color-fg-muted)]">
              {subtitle}
            </p>
          ) : null}
          {badges?.length ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {badges.map((badge, index) => (
                <Badge key={`${badge.label}-${index}`} variant={badge.variant ?? 'secondary'}>
                  {badge.label}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex w-full shrink-0 flex-wrap items-center gap-2 md:w-auto md:justify-end max-sm:[&>*]:w-full">
            {actions}
          </div>
        ) : null}
      </div>

      {stats?.length ? (
        <dl className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-x-6 gap-y-4 border-t border-[var(--color-border)] pt-5">
          {stats.map((stat, index) => (
            <div key={`${stat.label}-${index}`} className="min-w-0">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
                {stat.label}
              </dt>
              <dd className={cn('mt-1 font-mono text-[20px] font-medium leading-tight tabular-nums', TONE[stat.tone ?? 'muted'])}>
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  )
}
