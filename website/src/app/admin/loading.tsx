import { SkeletonRow } from '@/components/ui/skeleton'

/**
 * /admin/* loading state. Streams while server-fetches whichever
 * page's data layer (KPIs, machines list, audit feed, etc.).
 */
export default function AdminLoading() {
  return (
    <div className="space-y-8">
      <header className="space-y-2 border-b border-[var(--color-border)] pb-5">
        <div className="h-3 w-20 rounded bg-[var(--color-surface)] animate-pulse" />
        <div className="h-7 w-64 rounded bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse" />
        <div className="h-4 w-96 rounded bg-[var(--color-surface)] animate-pulse" />
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} height={120} />)}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} height={48} />)}
      </div>
    </div>
  )
}
