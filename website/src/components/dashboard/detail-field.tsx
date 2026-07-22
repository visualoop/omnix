import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Read-only key/value display for customer detail pages (licence, device,
 * payment). A single shared primitive so every detail page renders its
 * facts with the same flat, hairline, mono-label treatment — replacing the
 * per-page local `Field` helpers that had drifted apart.
 *
 * This is presentational and server-safe (no client boundary).
 */

export function DetailGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2',
        className,
      )}
    >
      {children}
    </dl>
  )
}

export function DetailField({
  label,
  value,
  mono,
  className,
}: {
  label: string
  value?: ReactNode
  /** Render the value in the mono/tabular face — for codes, IDs and money. */
  mono?: boolean
  className?: string
}) {
  const isEmpty = value === null || value === undefined || value === ''
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
        {label}
      </dt>
      <dd
        className={cn(
          'text-[14px] leading-6 text-[var(--color-fg)]',
          mono && 'font-mono tabular-nums',
          isEmpty && 'text-[var(--color-fg-subtle)]',
        )}
      >
        {isEmpty ? '—' : value}
      </dd>
    </div>
  )
}
