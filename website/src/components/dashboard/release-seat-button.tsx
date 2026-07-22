'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { confirm } from '@/components/ui/dialog-imperative'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

/**
 * "Release seat" button — frees the seat consumed by a device so the
 * customer can re-install on a different PC.
 *
 * Asks for destructive confirmation, calls DELETE
 * /api/dashboard/machines/[id], and routes back to /dashboard/machines on
 * success. The server enforces ownership and the seat/rebind rules; this
 * only triggers and reports them.
 */
export function ReleaseSeatButton({
  machineId,
  hostname,
  variant = 'default',
}: {
  machineId: string
  hostname: string | null
  variant?: 'default' | 'compact'
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function release() {
    const sure = await confirm({
      title: `Release the seat on ${hostname || 'this device'}?`,
      description:
        'The Omnix install on this PC will stop signing in. You can install on a different PC after release. This does not refund the licence.',
      variant: 'destructive',
      confirmText: 'Release seat',
    })
    if (!sure) return
    setError(null)
    startTransition(async () => {
      const res = await fetch(`/api/dashboard/machines/${machineId}`, { method: 'DELETE' })
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!data?.ok) {
        setError(data?.error ?? `Could not release (HTTP ${res.status})`)
        return
      }
      router.push('/dashboard/machines')
      router.refresh()
    })
  }

  const destructiveClasses =
    'text-[var(--color-negative)] hover:bg-[var(--color-negative)]/10 hover:text-[var(--color-negative)]'

  if (variant === 'compact') {
    return (
      <Button
        type="button"
        size="xs"
        variant="ghost"
        onClick={release}
        disabled={pending}
        className={destructiveClasses}
        title="Release seat — frees the seat for reinstall on another PC"
      >
        {pending ? 'Releasing…' : 'Release'}
      </Button>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={release}
        disabled={pending}
        className={cn('border-[var(--color-negative)]/40', destructiveClasses)}
      >
        {pending ? 'Releasing seat…' : 'Release seat'}
      </Button>
      {error ? (
        <span role="alert" className="text-right font-mono text-[10px] text-[var(--color-negative)]">
          {error}
        </span>
      ) : null}
    </div>
  )
}
