/**
 * Breadcrumbs — editorial trail for detail pages.
 *
 * Visual: mono caption, 11 px, foreground/60. Items separated by a faint
 * "/" separator. Last item is the current page (not a link, foreground/90).
 *
 * Usage:
 *   <Breadcrumbs items={[
 *     { label: "Inventory", to: "/inventory" },
 *     { label: "Paracetamol 500mg" }
 *   ]} />
 *
 * Sits above the BackButton + page heading. Together they form the
 * "where am I, how do I get back, what is this?" triad.
 */
import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"

export interface Crumb {
  label: string
  to?: string
}

interface Props {
  items: Crumb[]
  className?: string
}

export function Breadcrumbs({ items, className }: Props) {
  if (!items.length) return null

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground",
        className,
      )}
    >
      {items.map((crumb, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={`${crumb.label}-${i}`} className="inline-flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className="text-foreground/30">/</span>}
            {isLast || !crumb.to ? (
              <span className="text-foreground/80" aria-current={isLast ? "page" : undefined}>
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.to}
                className="hover:text-foreground transition-colors underline-offset-2 hover:underline"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
