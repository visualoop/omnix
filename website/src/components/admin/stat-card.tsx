import type { ReactNode } from 'react'
import { ArrowUpRight, ArrowDownRight } from '@phosphor-icons/react/dist/ssr'

interface Props {
  label: string
  value: string | number
  delta?: { value: number; period: string } | null
  hint?: string
  icon?: ReactNode
  /** When true, render the value in mono tabular-nums (for currency etc). */
  mono?: boolean
}

/**
 * StatCard — a KPI with a single number, eyebrow label, optional
 * delta indicator. Replaces the bare grid of unstyled big numbers.
 *
 * Visual: hairline-bordered tile, small icon in the corner, large
 * Fraunces number, optional period delta below.
 */
export function StatCard({ label, value, delta, hint, icon, mono = false }: Props) {
  const trend = delta && delta.value !== 0 ? (delta.value > 0 ? 'up' : 'down') : null
  return (
    <div className="relative rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 hover:border-[var(--color-border-strong)] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
          {label}
        </span>
        {icon ? <span className="text-[var(--color-fg-subtle)] shrink-0">{icon}</span> : null}
      </div>
      <div
        style={{ fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)' }}
        className={`mt-3 text-[clamp(28px,3vw,36px)] font-medium leading-[1.05] tracking-[-0.01em] text-[var(--color-fg)] ${mono ? 'tabular-nums' : ''}`}
      >
        {value}
      </div>
      {(delta || hint) && (
        <div className="mt-2 flex items-center gap-2 text-[11px] font-mono text-[var(--color-fg-subtle)]">
          {trend === 'up' && <ArrowUpRight className="size-3" weight="bold" style={{ color: 'var(--color-positive)' }} />}
          {trend === 'down' && <ArrowDownRight className="size-3" weight="bold" style={{ color: 'var(--color-negative)' }} />}
          {delta ? (
            <span style={{ color: trend === 'up' ? 'var(--color-positive)' : trend === 'down' ? 'var(--color-negative)' : 'var(--color-fg-subtle)' }}>
              {delta.value > 0 ? '+' : ''}{delta.value}%
            </span>
          ) : null}
          {delta && hint ? <span>·</span> : null}
          {delta && <span>{delta.period}</span>}
          {!delta && hint ? <span>{hint}</span> : null}
        </div>
      )}
    </div>
  )
}
