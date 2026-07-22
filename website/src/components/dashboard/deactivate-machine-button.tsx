'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { confirm } from '@/components/ui/dialog-imperative'
import { Button } from '@/components/ui/button'

/**
 * Deactivate a device to free a licence seat (self-service rebind).
 * Calls POST /api/licensing/rebind; the server enforces the cooldown and
 * ownership — this only triggers it and surfaces the result.
 */
export function DeactivateMachineButton({ machineId }: { machineId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onClick = async () => {
    if (
      !(await confirm({
        title: 'Deactivate this device?',
        description:
          'Frees a seat so another PC can activate. The app on this device will need to re-activate.',
        variant: 'destructive',
        confirmText: 'Deactivate',
      }))
    ) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/licensing/rebind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineId }),
        credentials: 'include',
      })
      const body = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !body.ok) {
        setError(body.error ?? 'Could not deactivate device.')
      } else {
        router.refresh()
      }
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" variant="outline" onClick={onClick} disabled={busy}>
        {busy ? 'Deactivating…' : 'Deactivate'}
      </Button>
      {error ? (
        <span role="alert" className="max-w-[200px] text-right text-[11px] text-[var(--color-negative)]">
          {error}
        </span>
      ) : null}
    </div>
  )
}
