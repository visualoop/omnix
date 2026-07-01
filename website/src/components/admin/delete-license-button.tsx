'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { confirm } from '@/components/ui/dialog-imperative'
import { Trash } from '@phosphor-icons/react'

interface Props {
  licenseId: string
  licenseKey: string
}

/**
 * DeleteLicenseButton — small action button on each LicenseCard.
 * Hard-deletes the licence + cascades to its machines after a confirm
 * prompt. Errors surface inline; success refreshes the page.
 */
export function DeleteLicenseButton({ licenseId, licenseKey }: Props) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  async function onClick() {
    if (!(await confirm({ title: `Delete licence ${licenseKey}?`, description: 'This also revokes every machine bound to it. Cannot be undone.', variant: 'destructive', confirmText: 'Delete licence' }))) return
    setErr(null)
    startTransition(async () => {
      const res = await fetch(`/api/admin/licenses/${licenseId}`, { method: 'DELETE' })
      const j = await res.json().catch(() => ({}))
      if (j.ok) {
        router.refresh()
      } else {
        setErr(j.error ?? 'Delete failed')
      }
    })
  }

  return (
    <>
      <button
        onClick={onClick}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-sm border border-[var(--color-border)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)] hover:border-[var(--color-negative)] hover:text-[var(--color-negative)] disabled:opacity-50 transition-colors"
        title="Delete licence"
      >
        <Trash weight="regular" className="size-2.5" />
        {busy ? 'Deleting…' : 'Delete'}
      </button>
      {err ? <span className="text-[10px] text-[var(--color-negative)] ml-2">{err}</span> : null}
    </>
  )
}
