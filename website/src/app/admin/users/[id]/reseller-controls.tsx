'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { confirm } from '@/components/ui/dialog-imperative'

interface Reseller {
  id: string
  companyName: string
  discountPercent: number
  status: 'active' | 'suspended' | string
  totalLicensesIssued: number
  totalRevenueBrought: number
  totalCommissionEarned: number
  unpaidCommission: number
  commissionCurrency: string
  approvedAt: string | null
}

export function ResellerControls({ userId, reseller }: { userId: string; reseller: Reseller | null }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [companyName, setCompanyName] = useState(reseller?.companyName ?? '')
  const [discount, setDiscount] = useState(reseller?.discountPercent ?? 15)

  const call = async (method: 'POST' | 'PATCH' | 'DELETE', body?: object) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/reseller`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) throw new Error(j.error ?? 'Failed')
      router.refresh()
      setEditing(false)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const promote = () => call('POST', { companyName: companyName.trim() || undefined, discountPercent: discount })
  const update = () => call('PATCH', { companyName: companyName.trim() || undefined, discountPercent: discount })
  const suspend = async () => {
    if (!(await confirm({ title: 'Suspend this reseller?', description: 'They will not be able to issue new licences until reactivated.', variant: 'destructive', confirmText: 'Suspend' }))) return
    call('DELETE')
  }
  const reactivate = () => call('POST', {}) // POST is idempotent — reactivates + updates

  if (!reseller) {
    return (
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Reseller</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Promote this user to a reseller so they can issue licences at a wholesale discount.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] text-muted-foreground">Company name</span>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Uses account name if blank"
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-muted-foreground">Discount %</span>
            <input
              type="number"
              min={0}
              max={60}
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            />
          </label>
        </div>
        {error ? <div className="text-xs text-destructive">{error}</div> : null}
        <button
          disabled={busy}
          onClick={promote}
          className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? 'Promoting…' : 'Promote to reseller'}
        </button>
      </div>
    )
  }

  const suspended = reseller.status === 'suspended'
  return (
    <div className={`rounded-lg border p-4 space-y-3 ${suspended ? 'border-amber-500/40 bg-amber-500/5' : 'border-emerald-500/40 bg-emerald-500/5'}`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Reseller · {reseller.companyName}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {suspended ? 'Suspended — cannot issue new licences.' : `Active at ${reseller.discountPercent}% discount off retail.`}
          </p>
        </div>
        <div className="flex gap-1">
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="text-xs px-2 py-1 rounded border border-border hover:border-primary/40"
            >
              Edit
            </button>
          ) : null}
          {suspended ? (
            <button
              disabled={busy}
              onClick={reactivate}
              className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground disabled:opacity-50"
            >
              Reactivate
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={suspend}
              className="text-xs px-2 py-1 rounded border border-destructive/40 text-destructive hover:bg-destructive/5 disabled:opacity-50"
            >
              Suspend
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] text-muted-foreground">Company name</span>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-muted-foreground">Discount %</span>
              <input
                type="number"
                min={0}
                max={60}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              />
            </label>
          </div>
          {error ? <div className="text-xs text-destructive">{error}</div> : null}
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={update}
              className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditing(false)
                setCompanyName(reseller.companyName)
                setDiscount(reseller.discountPercent)
              }}
              className="text-xs px-3 py-1.5 rounded border border-border"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3 text-xs">
          <div>
            <div className="text-muted-foreground">Licences issued</div>
            <div className="mt-0.5 text-sm font-medium">{reseller.totalLicensesIssued}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Revenue brought</div>
            <div className="mt-0.5 text-sm font-medium tabular-nums">{reseller.commissionCurrency} {Math.round(reseller.totalRevenueBrought).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Commission earned</div>
            <div className="mt-0.5 text-sm font-medium tabular-nums">{reseller.commissionCurrency} {Math.round(reseller.totalCommissionEarned).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Unpaid</div>
            <div className="mt-0.5 text-sm font-medium tabular-nums">{reseller.commissionCurrency} {Math.round(reseller.unpaidCommission).toLocaleString()}</div>
          </div>
        </div>
      )}
    </div>
  )
}
