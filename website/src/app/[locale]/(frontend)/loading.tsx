import { LoadingState, SkeletonBar } from '@/components/ui/loading-skeleton'

/**
 * Localized marketing loading state. Renders in the site chrome (header +
 * footer stay put) while a marketing/content/guide/location page streams.
 * Structural only — a hero block and two content bands, no placeholder
 * headlines and no fake stats.
 */
export default function FrontendLoading() {
  return (
    <LoadingState label="Loading…" className="container-default section-tight">
      <div className="flex flex-col gap-6">
        <SkeletonBar className="h-4 w-40" />
        <SkeletonBar className="h-16 w-full max-w-3xl sm:h-24" />
        <SkeletonBar className="h-5 w-full max-w-xl" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SkeletonBar className="h-40 rounded-[var(--radius-lg)]" />
          <SkeletonBar className="h-40 rounded-[var(--radius-lg)]" />
          <SkeletonBar className="h-40 rounded-[var(--radius-lg)]" />
        </div>
      </div>
    </LoadingState>
  )
}
