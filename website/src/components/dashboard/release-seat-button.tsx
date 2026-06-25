'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

/**
 * "Release seat" button — frees the seat consumed by a machine so the
 * customer can re-install on a different PC.
 *
 * Asks for confirmation, calls DELETE /api/dashboard/machines/[id],
 * routes back to /dashboard/machines on success so the now-revoked
 * machine doesn't fill the detail page with "revoked" labels.
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

  function release() {
    const sure = window.confirm(
      `Release the seat on ${hostname || 'this machine'}?\n\nThe Omnix install on this PC will stop signing in. You can install on a different PC after release. This does not refund the licence.`,
    )
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

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={release}
        disabled={pending}
        className="rounded-md border border-rose-500/30 bg-rose-500/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-rose-700 hover:bg-rose-500/10 disabled:opacity-50 cursor-pointer dark:text-rose-300"
        title="Release seat — frees the seat for reinstall on another PC"
      >
        {pending ? 'Releasing…' : 'Release'}
      </button>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={release}
        disabled={pending}
        className="inline-flex items-center justify-center rounded-md border border-rose-500/30 bg-rose-500/5 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-rose-700 hover:bg-rose-500/10 disabled:opacity-50 cursor-pointer dark:text-rose-300"
      >
        {pending ? 'Releasing seat…' : 'Release seat'}
      </button>
      {error ? (
        <span className="font-mono text-[10px] text-[var(--color-negative)]">{error}</span>
      ) : null}
    </div>
  )
}
