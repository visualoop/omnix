'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { alert } from '@/components/ui/dialog-imperative'
import { Button } from '@/components/ui/button'

interface Props {
  machineRowId: string
  hostname: string | null
  currentChannel: string
  currentAutoUpdate: string
}

export function UpdatePolicyPanel({ machineRowId, hostname, currentChannel, currentAutoUpdate }: Props) {
  const router = useRouter()
  const [channel, setChannel] = useState(currentChannel === 'canary' || currentChannel === 'beta' ? 'canary' : 'stable')
  const [autoUpdate, setAutoUpdate] = useState(currentAutoUpdate !== 'false')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/machines/${machineRowId}/update-policy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updateChannel: channel, autoUpdateEnabled: autoUpdate }),
      })
      const j = await res.json()
      if (!res.ok || !j.ok) throw new Error(j.error || 'Save failed')
      router.refresh()
    } catch (e) {
      await alert({ title: 'Update policy save failed', description: String(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-lg border border-border p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Update policy</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Control whether this machine auto-updates and which release channel it pulls from.
          Canary machines receive beta releases before they promote to stable.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Release channel</label>
          <div className="mt-1 flex gap-1.5">
            <button
              type="button"
              onClick={() => setChannel('stable')}
              className={`flex-1 rounded-md border px-3 py-1.5 text-xs ${
                channel === 'stable' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
              }`}
            >
              Stable
            </button>
            <button
              type="button"
              onClick={() => setChannel('canary')}
              className={`flex-1 rounded-md border px-3 py-1.5 text-xs ${
                channel === 'canary' ? 'border-amber-500 bg-amber-500/10 text-amber-700' : 'border-border text-muted-foreground hover:border-amber-500/40'
              }`}
            >
              Canary (beta)
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {channel === 'canary'
              ? 'Machine will pull the latest beta release for testing before it promotes to stable.'
              : 'Machine only pulls releases marked stable (default).'}
          </p>
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Auto-update</label>
          <div className="mt-1 flex gap-1.5">
            <button
              type="button"
              onClick={() => setAutoUpdate(true)}
              className={`flex-1 rounded-md border px-3 py-1.5 text-xs ${
                autoUpdate ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
              }`}
            >
              Enabled
            </button>
            <button
              type="button"
              onClick={() => setAutoUpdate(false)}
              className={`flex-1 rounded-md border px-3 py-1.5 text-xs ${
                !autoUpdate ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border text-muted-foreground hover:border-destructive/40'
              }`}
            >
              Paused
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {autoUpdate
              ? 'Background auto-update on next boot. Manual "Check for Updates" still works.'
              : 'Machine will not auto-update. Owner must click "Check for Updates" in settings.'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <div className="text-[11px] text-muted-foreground">
          Changes apply on the machine&rsquo;s next boot ({hostname ?? 'this machine'}).
        </div>
        <Button
          onClick={save}
          disabled={busy || (channel === (currentChannel === 'canary' || currentChannel === 'beta' ? 'canary' : 'stable') && autoUpdate === (currentAutoUpdate !== 'false'))}
          size="sm"
        >
          {busy ? 'Saving…' : 'Save policy'}
        </Button>
      </div>
    </section>
  )
}
