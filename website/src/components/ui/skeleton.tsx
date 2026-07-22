import { cn } from '@/lib/cn'

interface Props {
  className?: string
  style?: React.CSSProperties
}

/**
 * Skeleton — a single shimmering bar. Matches the Working Counter brand
 * (warm taupe tint, hairline borders, subtle pulse). Use to lay out a
 * loading-state placeholder. The pulse is motion-safe (globals also kill
 * `.animate-pulse` under prefers-reduced-motion) so it never animates for
 * users who asked for less motion.
 */
export function Skeleton({ className, style }: Props) {
  return (
    <span
      className={cn(
        'inline-block motion-safe:animate-pulse rounded',
        'bg-[var(--color-surface)]',
        'border border-[var(--color-border)]',
        className,
      )}
      style={style}
      aria-hidden
    />
  )
}

/**
 * SkeletonText — N rows of varying widths to mimic a paragraph.
 */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  const widths = ['100%', '92%', '78%', '85%', '70%']
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="block h-3"
          style={{ width: widths[i % widths.length] }}
        />
      ))}
    </div>
  )
}

/**
 * SkeletonRow — a hairline-bordered list item placeholder.
 */
export function SkeletonRow({
  height = 56,
  className,
}: {
  height?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] motion-safe:animate-pulse',
        className,
      )}
      style={{ height }}
      aria-hidden
    />
  )
}
