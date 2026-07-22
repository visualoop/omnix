import { SkeletonRow } from '@/components/ui/skeleton'
import { LoadingState } from '@/components/ui/loading-skeleton'

export default function AdminLoading() {
  return (
    <LoadingState label="Loading operator console…" className="flex min-w-0 flex-col gap-10 sm:gap-12">
      <header className="grid gap-6 border-b border-[var(--color-border-strong)] pb-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="space-y-3">
          <div className="h-3 w-44 rounded-[var(--radius-xs)] bg-[var(--color-surface)] motion-safe:animate-pulse" />
          <div className="h-14 w-full max-w-xl rounded-[var(--radius-sm)] bg-[var(--color-surface)] motion-safe:animate-pulse sm:h-16" />
          <div className="h-4 w-full max-w-2xl rounded-[var(--radius-xs)] bg-[var(--color-surface)] motion-safe:animate-pulse" />
        </div>
        <div className="h-9 w-40 rounded-[var(--radius-xs)] bg-[var(--color-surface)] motion-safe:animate-pulse" />
      </header>

      <section className="space-y-4">
        <div className="h-7 w-36 rounded-[var(--radius-xs)] bg-[var(--color-surface)] motion-safe:animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonRow key={index} height={176} className="rounded-none border border-[var(--color-border)]" />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="h-7 w-44 rounded-[var(--radius-xs)] bg-[var(--color-surface)] motion-safe:animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonRow key={index} height={96} className="rounded-none border border-[var(--color-border)]" />
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-12">
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => <SkeletonRow key={index} height={44} />)}
        </div>
        <SkeletonRow height={240} />
      </div>
    </LoadingState>
  )
}
