'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Wrench } from '@phosphor-icons/react'
import { confirm } from '@/components/ui/dialog-imperative'

interface Change {
  id: string
  variant: string
  oldKey: string
  newKey: string | null
  issue?: string
}

/**
 * RepairLicenseKeysButton — canonicalises legacy licence keys.
 *
 * Keys issued through the checkout page were written as `OMX-<VARIANT>-…`
 * while every other issuance path emitted `OMNIX-<SHORT>-…`. The desktop app
 * rejected the former outright, so those customers could not activate.
 *
 * Always previews before writing: the dry-run GET reports exactly which rows
 * would change, and nothing is written until the confirm is accepted.
 */
export function RepairLicenseKeysButton() {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function onClick() {
    setErr(null)
    setMsg(null)

    const preview = await fetch('/api/admin/licenses/repair-keys')
      .then((r) => r.json())
      .catch(() => null)

    if (!preview?.ok) {
      setErr(preview?.error ?? 'Could not read the licence keys')
      return
    }

    const changes: Change[] = preview.changes ?? []
    if (changes.length === 0) {
      setMsg('Every licence key is already canonical')
      return
    }

    const blocked = changes.filter((c) => c.issue || !c.newKey)
    const summary = changes
      .slice(0, 8)
      .map((c) => `${c.oldKey} → ${c.newKey ?? 'unrecognised'}`)
      .join('\n')

    const ok = await confirm({
      title: `Rewrite ${changes.length} licence key${changes.length === 1 ? '' : 's'}?`,
      description:
        `${summary}${changes.length > 8 ? `\n…and ${changes.length - 8} more` : ''}` +
        (blocked.length > 0
          ? `\n\n${blocked.length} row(s) cannot be repaired safely, so nothing will be written.`
          : '\n\nOnly the key changes. The old keys are recorded in the audit log.'),
      confirmText: blocked.length > 0 ? 'Try anyway' : `Rewrite ${changes.length}`,
    })
    if (!ok) return

    startTransition(async () => {
      const res = await fetch('/api/admin/licenses/repair-keys', { method: 'POST' })
      const j = await res.json().catch(() => ({}))
      if (j.ok) {
        setMsg(`Repaired ${j.updated} licence key${j.updated === 1 ? '' : 's'}`)
        router.refresh()
      } else {
        setErr(j.error ?? 'Repair failed')
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onClick}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--color-border)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)] transition-colors hover:border-[var(--color-fg)] hover:text-[var(--color-fg)] disabled:opacity-50"
        title="Canonicalise legacy OMX- licence keys"
      >
        <Wrench weight="regular" className="size-2.5" />
        {busy ? 'Repairing…' : 'Repair key formats'}
      </button>
      {msg ? <span className="font-mono text-[9px] text-[var(--color-fg-subtle)]">{msg}</span> : null}
      {err ? <span className="font-mono text-[9px] text-[var(--color-negative)]">{err}</span> : null}
    </div>
  )
}
