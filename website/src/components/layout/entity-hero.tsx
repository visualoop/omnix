import type { ReactNode } from 'react'
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
  muted: 'text-foreground',
  positive: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
}

/**
 * EntityHero — newspaper-masthead detail-page header. Matches the
 * desktop primitive in shape so admin dashboards feel like a single
 * editorial system.
 */
export function EntityHero({ eyebrow, title, subtitle, badges, actions, stats, className }: Props) {
  return (
    <header className={cn('border-b border-foreground/10 pb-5', className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</span>
          ) : null}
          <h1
            style={{ fontFamily: 'var(--font-display, serif)' }}
            className="mt-1 text-[clamp(28px,3.4vw,40px)] font-medium leading-[1.05] tracking-[-0.015em]"
          >
            {title}
          </h1>
          {subtitle ? <p className="mt-2 max-w-[68ch] text-[14px] leading-[1.55] text-muted-foreground">{subtitle}</p> : null}
          {badges?.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {badges.map((b, i) => (
                <BadgeInline key={`${b.label}-${i}`} variant={b.variant ?? 'secondary'}>
                  {b.label}
                </BadgeInline>
              ))}
            </div>
          ) : null}
        </div>
        {actions ? <div className="shrink-0 flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {stats?.length ? (
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((s, i) => (
            <div key={`${s.label}-${i}`} className="flex flex-col gap-0.5">
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{s.label}</dt>
              <dd
                style={{ fontFamily: 'var(--font-display, serif)' }}
                className={cn('text-[20px] font-medium leading-tight tabular-nums', TONE[s.tone ?? 'muted'])}
              >
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  )
}

function BadgeInline({ variant, children }: { variant: NonNullable<EntityHeroBadge['variant']>; children: ReactNode }) {
  const styles: Record<string, string> = {
    default: 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    secondary: 'border border-foreground/15 bg-foreground/[0.04] text-foreground/70',
    destructive: 'border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
    outline: 'border border-foreground/20 text-foreground/80',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em]',
        styles[variant],
      )}
    >
      {children}
    </span>
  )
}
