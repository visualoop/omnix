'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { confirm } from '@/components/ui/dialog-imperative'
import { Button } from '@/components/ui/button'
import { X as TrashIcon } from '@/components/icons'

/**
 * Release a trial licence. Hard-delete via DELETE /api/dashboard/licenses/[id].
 *
 * Lets customers clean up trial keys they no longer want. The API rejects
 * active/paid licences (403) — this button never assumes it can delete;
 * the server decides and the error surfaces here.
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
      description: `${licenseKey}\n\nThe key will be permanently removed from your account. To keep using this product, buy a perpetual licence from the dashboard.`,
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
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={release}
        disabled={pending}
        title="Permanently delete this trial licence from your account"
      >
        <TrashIcon className="size-3.5" />
        {pending ? 'Releasing…' : 'Release trial'}
      </Button>
      {error ? (
        <span role="alert" className="font-mono text-[10px] text-[var(--color-negative)]">
          {error}
        </span>
      ) : null}
    </div>
  )
}
