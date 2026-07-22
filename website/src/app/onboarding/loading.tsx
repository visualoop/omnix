import { LoadingState, SkeletonBar } from '@/components/ui/loading-skeleton'

/**
 * Onboarding loading state. The wizard resolves the signed-in customer + their
 * licences server-side; a centred, structural placeholder holds the space.
 */
export default function OnboardingLoading() {
  return (
    <LoadingState
      label="Loading onboarding…"
      className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-6 px-6 py-16"
    >
      <div className="space-y-3 text-center">
        <SkeletonBar className="mx-auto h-8 w-64 max-w-full" />
        <SkeletonBar className="mx-auto h-4 w-80 max-w-full" />
      </div>
      <SkeletonBar className="h-56 w-full rounded-[var(--radius-lg)]" />
    </LoadingState>
  )
}
