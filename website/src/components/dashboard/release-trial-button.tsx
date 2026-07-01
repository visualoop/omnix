'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { confirm } from '@/components/ui/dialog-imperative'
import { X as TrashIcon } from '@/components/icons'

/**
 * Release a trial licence. Hard-delete via DELETE /api/dashboard/licenses/[id].
 *
 * Used by the dashboard licence-detail page so customers can clean up
 * trial keys they no longer want. Active / paid licences cannot be
 * released this way — the API rejects with 403 and the user sees the
 * Customer Display refund-policy link instead.
 */
export function ReleaseTrialButton({
  licenseId,
  licenseKey,
}: {
  licenseId: string
  licenseKey: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function release() {
    const sure = await confirm({
      title: 'Release this trial licence?',
      description: `${licenseKey}\n\nThe key will be permanently removed from your account. You can start a new trial of the same variant later from the dashboard.`,
      variant: 'destructive',
      confirmText: 'Release trial',
    })
    if (!sure) return
    setError(null)
    startTransition(async () => {
      const res = await fetch(`/api/dashboard/licenses/${licenseId}`, { method: 'DELETE' })
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!data?.ok) {
        setError(data?.error ?? `Could not release (HTTP ${res.status})`)
        return
      }
      router.push('/dashboard/licenses')
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={release}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        title="Permanently delete this trial licence from your account"
      >
        <TrashIcon className="size-3.5" />
        {pending ? 'Releasing…' : 'Release trial'}
      </button>
      {error ? (
        <span className="font-mono text-[10px] text-[var(--color-negative)]">{error}</span>
      ) : null}
    </>
  )
}
