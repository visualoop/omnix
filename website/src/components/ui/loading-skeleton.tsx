import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * LoadingState — the accessible wrapper every `loading.tsx` boundary uses.
 *
 * Provides the loading semantics in one place:
 *   - role="status" + aria-busy="true" + aria-live="polite"
 *   - a visually-hidden text label so screen readers announce the wait
 *   - structural skeletons only (passed as children); no fake content, no
 *     invented metrics, no spinner. Motion lives in the skeleton bars and is
 *     motion-safe, so reduced-motion users see static placeholders.
 */
export function LoadingState({
  label = 'Loading…',
  children,
  className,
}: {
  label?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={cn('min-w-0', className)}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

/** A single structural skeleton bar. */
export function SkeletonBar({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'motion-safe:animate-pulse rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)]',
        className,
      )}
      style={style}
    />
  )
}

/**
 * SkeletonHeader — the title + subtitle block most pages open with. Structural
 * only: two bars, no placeholder words.
 */
export function SkeletonHeader({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      <SkeletonBar className="h-8 w-64 max-w-full" />
      <SkeletonBar className="h-4 w-80 max-w-full" />
    </div>
  )
}

/**
 * SkeletonList — N hairline rows. The workhorse for table/list loading.
 */
export function SkeletonList({
  rows = 4,
  rowHeight = 56,
  className,
}: {
  rows?: number
  rowHeight?: number
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBar key={i} className="rounded-[var(--radius-md)]" style={{ height: rowHeight }} />
      ))}
    </div>
  )
}

/**
 * SkeletonCards — a responsive grid of card placeholders (dashboards, stat rows).
 */
export function SkeletonCards({
  count = 3,
  cardHeight = 120,
  className,
}: {
  count?: number
  cardHeight?: number
  className?: string
}) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBar key={i} className="rounded-[var(--radius-md)]" style={{ height: cardHeight }} />
      ))}
    </div>
  )
}
