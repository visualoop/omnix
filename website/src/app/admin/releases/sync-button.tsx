'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowsClockwise } from '@phosphor-icons/react'

export function ReleasesSyncButton() {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="font-mono text-[11px] text-[var(--color-fg-muted)]">{msg}</span>}
      <button
        onClick={() => {
          setMsg('Syncing…')
          startTransition(async () => {
            const res = await fetch('/api/admin/releases/sync-from-github?limit=20', { method: 'POST' })
            const j = await res.json()
            if (j.ok) {
              setMsg(`Inserted ${j.inserted.length}, updated ${j.updated.length}`)
              router.refresh()
            } else {
              setMsg(`Failed: ${j.error ?? 'unknown'}`)
            }
          })
        }}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-md border border-foreground/15 bg-background px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-foreground transition-colors hover:border-foreground/40 disabled:opacity-50"
      >
        <ArrowsClockwise weight="bold" className={`size-3.5 ${busy ? 'animate-spin' : ''}`} />
        {busy ? 'Syncing…' : 'Sync from GitHub'}
      </button>
    </div>
  )
}
