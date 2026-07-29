'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface PartnerAdminActionsProps {
  kind: 'affiliate' | 'reseller'
  entityId: string
  userId: string
  initialRate: number
  initialStatus: 'active' | 'blocked' | 'suspended'
  blockedReason?: string | null
}

export function PartnerAdminActions({
  kind,
  entityId,
  userId,
  initialRate,
  initialStatus,
  blockedReason,
}: PartnerAdminActionsProps) {
  const router = useRouter()
  const [rate, setRate] = useState(String(initialRate))
  const [status, setStatus] = useState(initialStatus)
  const [reason, setReason] = useState(blockedReason ?? '')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const disabledStatus = kind === 'affiliate' ? 'blocked' : 'suspended'

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setNotice(null)

    const numericRate = Number(rate)
    const endpoint = kind === 'affiliate'
      ? `/api/admin/affiliates/${entityId}`
      : `/api/admin/users/${userId}/reseller`
    const body = kind === 'affiliate'
      ? {
          commissionPercent: numericRate,
          blocked: status === 'blocked',
          blockedReason: status === 'blocked' ? reason.trim() : '',
        }
      : {
          discountPercent: numericRate,
          status: status === 'suspended' ? 'suspended' : 'active',
        }

    try {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error ?? `Update failed (${response.status})`)
      }
      setNotice({ kind: 'success', text: `${kind === 'affiliate' ? 'Affiliate' : 'Reseller'} updated.` })
      router.refresh()
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Update failed.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="min-w-[15rem]">
      <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">
        Manage
      </summary>
      <form onSubmit={save} className="mt-3 flex flex-col gap-3 border-l border-[var(--color-border)] pl-3">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--color-fg-muted)]">
            {kind === 'affiliate' ? 'Commission %' : 'Wholesale discount %'}
          </span>
          <Input
            type="number"
            min={0}
            max={60}
            step={1}
            value={rate}
            onChange={(event) => setRate(event.target.value)}
            aria-label={kind === 'affiliate' ? 'Affiliate commission percent' : 'Reseller wholesale discount percent'}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--color-fg-muted)]">Status</span>
          <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
            <SelectTrigger aria-label="Partner status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value={disabledStatus}>{kind === 'affiliate' ? 'Blocked' : 'Suspended'}</SelectItem>
            </SelectContent>
          </Select>
        </label>

        {kind === 'affiliate' && status === 'blocked' ? (
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--color-fg-muted)]">Reason</span>
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="Why this account is blocked"
            />
          </label>
        ) : null}

        {notice ? <Alert variant={notice.kind}>{notice.text}</Alert> : null}
        <Button type="submit" size="sm" disabled={busy || !rate.trim()}>
          {busy ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </details>
  )
}
