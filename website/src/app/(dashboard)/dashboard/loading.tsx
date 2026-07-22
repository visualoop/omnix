import { SkeletonRow } from '@/components/ui/skeleton'
import { LoadingState, SkeletonBar } from '@/components/ui/loading-skeleton'

/**
 * /dashboard route-group loading state.
 * Streams while the page server-fetches licences + machines. Structural
 * skeletons only — no fake counts or licence rows — wrapped in the shared
 * accessible LoadingState (role=status, aria-busy, screen-reader label).
 */
export default function DashboardLoading() {
  return (
    <LoadingState label="Loading your dashboard…" className="space-y-8">
      <div className="space-y-2">
        <SkeletonBar className="h-7 w-48" />
        <SkeletonBar className="h-4 w-72 max-w-full" />
      </div>
      <section>
        <SkeletonBar className="mb-3 h-5 w-24" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} height={56} />)}
        </div>
      </section>
      <section>
        <SkeletonBar className="mb-3 h-5 w-24" />
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => <SkeletonRow key={i} height={56} />)}
        </div>
      </section>
    </LoadingState>
  )
}
