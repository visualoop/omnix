import { LoadingState, SkeletonBar } from '@/components/ui/loading-skeleton'

/**
 * Auth route-group loading state (/login, /signup, /forgot-password,
 * /verify-email, /accept-invitation). Renders inside the minimal auth chrome;
 * a quiet form-shaped skeleton, no placeholder copy.
 */
export default function AuthLoading() {
  return (
    <LoadingState label="Loading…" className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-16">
      <div className="space-y-3">
        <SkeletonBar className="h-8 w-48" />
        <SkeletonBar className="h-4 w-64 max-w-full" />
      </div>
      <div className="space-y-4">
        <SkeletonBar className="h-11 w-full rounded-[var(--radius-md)]" />
        <SkeletonBar className="h-11 w-full rounded-[var(--radius-md)]" />
        <SkeletonBar className="h-11 w-full rounded-[var(--radius-pill)]" />
      </div>
    </LoadingState>
  )
}
