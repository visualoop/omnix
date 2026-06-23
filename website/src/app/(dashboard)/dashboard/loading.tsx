import { SkeletonRow } from '@/components/ui/skeleton'

/**
 * /dashboard route-group loading state.
 * Streams while the page server-fetches licences + machines.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse" />
        <div className="h-4 w-72 rounded bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse" />
      </div>
      <section>
        <div className="h-5 w-24 mb-3 rounded bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} height={56} />)}
        </div>
      </section>
      <section>
        <div className="h-5 w-24 mb-3 rounded bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse" />
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => <SkeletonRow key={i} height={56} />)}
        </div>
      </section>
    </div>
  )
}
