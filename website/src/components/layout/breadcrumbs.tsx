import Link from 'next/link'
import { cn } from '@/lib/cn'

export interface Crumb {
  label: string
  href?: string
}

interface Props {
  items: Crumb[]
  className?: string
}

/**
 * Breadcrumbs — same editorial trail as the desktop component, but
 * uses Next.js `<Link>`. Pass `items[].href` to make a crumb a link.
 * Last crumb is treated as the current page (not a link).
 */
export function Breadcrumbs({ items, className }: Props) {
  if (!items.length) return null
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        'flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground',
        className,
      )}
    >
      {items.map((c, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={`${c.label}-${i}`} className="inline-flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className="text-foreground/30">/</span>}
            {isLast || !c.href ? (
              <span className="text-foreground/80" aria-current={isLast ? 'page' : undefined}>
                {c.label}
              </span>
            ) : (
              <Link href={c.href} className="hover:text-foreground transition-colors">
                {c.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
