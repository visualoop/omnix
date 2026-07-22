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

export function Breadcrumbs({ items, className }: Props) {
  if (!items.length) return null

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
        {items.map((crumb, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${crumb.label}-${index}`} className="inline-flex min-w-0 items-center gap-1.5">
              {index > 0 ? <span aria-hidden className="text-[var(--color-border-strong)]">/</span> : null}
              {isLast || !crumb.href ? (
                <span
                  className={cn('truncate text-[var(--color-fg-muted)]', isLast && 'text-[var(--color-fg)]')}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="truncate transition-colors duration-[var(--duration-fast)] hover:text-[var(--color-fg)]"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
