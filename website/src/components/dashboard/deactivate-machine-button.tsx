'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Deactivate a machine to free a licence seat (self-service rebind).
 * Calls POST /api/licensing/rebind; the server enforces the cooldown.
 */
export function DeactivateMachineButton({ machineId }: { machineId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onClick = async () => {
    if (!confirm('Deactivate this machine? It frees a seat so another PC can activate. The app on that machine will need to re-activate.')) {
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
        setError(body.error ?? 'Could not deactivate machine.')
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
      <button
        onClick={onClick}
        disabled={busy}
        className="cursor-pointer rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50"
      >
        {busy ? 'Deactivating…' : 'Deactivate'}
      </button>
      {error ? <span className="max-w-[200px] text-right text-[11px] text-[var(--color-danger,#dc2626)]">{error}</span> : null}
    </div>
  )
}
