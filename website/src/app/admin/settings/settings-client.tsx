'use client'

/**
 * Admin settings — interactive client.
 *
 * Group rows by category. Each row shows current state (set in DB / set in
 * env / unset) + sensitive mask + Edit dialog. Each category has a "Test"
 * button that pings the corresponding service.
 *
 * Design: editorial cream paper + Fraunces masthead + hairline rules.
 * No card containers. Match the rest of /admin.
 */

import { useState, useTransition } from 'react'
import { Eye, EyeSlash, Pencil, CheckCircle, XCircle, ArrowsClockwise, Flask as FlaskIcon } from '@phosphor-icons/react'

interface Setting {
  key: string
  category: string
  label: string
  description: string | null
  sensitive: boolean
  hasValue: boolean
  source: 'db' | 'env' | 'unset'
  preview: string | null
  updatedAt: Date | string | null
  updatedBy: string | null
}

interface Props {
  initial: Setting[]
}

const CATEGORY_ORDER = ['paystack', 'email', 'oauth', 'storage', 'system', 'feature_flags', 'analytics']

const CATEGORY_LABELS: Record<string, string> = {
  paystack: 'Paystack',
  email: 'Email (Resend)',
  oauth: 'Google OAuth',
  storage: 'Cloud backup storage',
  system: 'System',
  feature_flags: 'Feature flags',
  analytics: 'Analytics',
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  paystack: 'Payment gateway for license fees, maintenance renewals, cloud-backup add-ons.',
  email: 'Magic-link sign-in, invitations, payment receipts, support replies.',
  oauth: 'Google sign-in for /login. Requires a redeploy after changing — Better Auth wires at startup.',
  storage: 'Encrypted desktop backups land in this S3-compatible bucket. R2 recommended.',
  system: 'Internal Bearer secrets for cron + bootstrap routes.',
  feature_flags: 'Quick toggles. No redeploy needed.',
  analytics: 'GA4 measurement tag.',
}

export function SettingsClient({ initial }: Props) {
  const [settings, setSettings] = useState(initial)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({})
  const [busy, startTransition] = useTransition()
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: settings.filter((s) => s.category === cat),
  })).filter((g) => g.items.length > 0)

  async function save(key: string) {
    if (!draft.trim()) return
    startTransition(async () => {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: draft }),
      })
      if (res.ok) {
        setToast({ kind: 'ok', text: `Saved ${key}` })
        // Refresh settings list
        const next = await fetch('/api/admin/settings').then((r) => r.json())
        if (next?.settings) setSettings(next.settings)
        setEditingKey(null)
        setDraft('')
      } else {
        const j = await res.json().catch(() => ({}))
        setToast({ kind: 'err', text: j.error ?? 'Save failed' })
      }
    })
  }

  async function runTest(category: string) {
    let body: Record<string, unknown> = {}
    if (category === 'paystack') body = { type: 'paystack' }
    else if (category === 'email') body = { type: 'email' }
    else if (category === 'oauth') body = { type: 'oauth' }
    else if (category === 'storage') body = { type: 's3' }
    else return

    setToast({ kind: 'ok', text: `Testing ${CATEGORY_LABELS[category]}…` })
    const res = await fetch('/api/admin/settings/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const j = await res.json()
    if (j.ok) {
      const detail =
        category === 'email'  ? `Sent to ${j.sentTo}` :
        category === 'paystack' ? `Live (HTTP ${j.status})` :
        category === 'oauth'  ? j.note :
        category === 'storage' ? `Bucket OK (${j.objectCount} objects visible)` :
        'OK'
      setToast({ kind: 'ok', text: `${CATEGORY_LABELS[category]}: ${detail}` })
    } else {
      setToast({ kind: 'err', text: `${CATEGORY_LABELS[category]}: ${j.error ?? 'failed'}` })
    }
  }

  return (
    <div className="space-y-12 px-6 pb-20">
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-md px-4 py-3 text-[13px] shadow-sm ${
            toast.kind === 'ok'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {toast.text}
          <button onClick={() => setToast(null)} className="ml-3 opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      <div className="flex items-center justify-end">
        <button
          onClick={async () => {
            startTransition(async () => {
              const res = await fetch('/api/admin/settings/import-env', { method: 'POST' })
              const j = await res.json()
              if (j.ok) {
                setToast({ kind: 'ok', text: `Imported ${j.imported.length} value(s) from env` })
                const next = await fetch('/api/admin/settings').then((r) => r.json())
                if (next?.settings) setSettings(next.settings)
              } else {
                setToast({ kind: 'err', text: j.error ?? 'Import failed' })
              }
            })
          }}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md border border-foreground/15 bg-background px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-foreground transition-colors hover:border-foreground/40 disabled:opacity-50"
        >
          <ArrowsClockwise weight="bold" className="size-3.5" />
          Import current env → DB
        </button>
      </div>

      {grouped.map(({ category, items }) => (
        <section key={category}>
          <header className="mb-4 flex items-end justify-between border-b border-foreground/10 pb-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {category.replace('_', ' ')}
              </div>
              <h2
                className="mt-2 text-[24px] leading-tight font-medium text-foreground"
                style={{ fontFamily: 'var(--font-display, serif)' }}
              >
                {CATEGORY_LABELS[category]}
              </h2>
              <p className="mt-1 text-[13px] text-muted-foreground">{CATEGORY_DESCRIPTIONS[category]}</p>
            </div>
            {(category === 'paystack' || category === 'email' || category === 'oauth' || category === 'storage') && (
              <button
                onClick={() => runTest(category)}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-md border border-foreground/15 bg-background px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-foreground transition-colors hover:border-foreground/40 disabled:opacity-50"
              >
                <FlaskIcon weight="bold" className="size-3.5" />
                Test
              </button>
            )}
          </header>

          <ul className="divide-y divide-foreground/10">
            {items.map((s) => {
              const isEditing = editingKey === s.key
              const reveal = showSensitive[s.key] ?? false
              return (
                <li key={s.key} className="grid grid-cols-12 gap-4 py-4">
                  <div className="col-span-4">
                    <div className="text-[13px] font-medium text-foreground">{s.label}</div>
                    {s.description && (
                      <div className="mt-1 text-[12px] leading-[1.5] text-muted-foreground">{s.description}</div>
                    )}
                    <div className="mt-2 font-mono text-[11px] text-muted-foreground/80">{s.key}</div>
                  </div>

                  <div className="col-span-6">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type={s.sensitive && !reveal ? 'password' : 'text'}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder={s.sensitive ? 'Paste new value…' : 'New value'}
                          className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 font-mono text-[13px] text-foreground outline-none focus:border-foreground/50"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => save(s.key)}
                            disabled={busy || !draft.trim()}
                            className="rounded-md bg-foreground px-3 py-1.5 text-[12px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => { setEditingKey(null); setDraft('') }}
                            className="text-[12px] text-muted-foreground hover:text-foreground"
                          >
                            Cancel
                          </button>
                          {s.sensitive && (
                            <button
                              onClick={() => setShowSensitive((m) => ({ ...m, [s.key]: !reveal }))}
                              className="ml-auto text-[12px] text-muted-foreground hover:text-foreground"
                            >
                              {reveal ? 'Hide' : 'Show'}
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="font-mono text-[13px] tabular-nums">
                        {s.hasValue ? (
                          <span className="text-foreground">{s.preview}</span>
                        ) : (
                          <span className="text-muted-foreground">Not set</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="col-span-2 flex items-start justify-end gap-2">
                    <SourceBadge source={s.source} />
                    {!isEditing && (
                      <button
                        onClick={() => { setEditingKey(s.key); setDraft('') }}
                        className="rounded-md border border-foreground/15 bg-background p-1.5 text-foreground transition-colors hover:border-foreground/40"
                        aria-label={`Edit ${s.label}`}
                      >
                        <Pencil weight="bold" className="size-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <p className="mt-12 max-w-2xl text-[12px] leading-[1.6] text-muted-foreground">
        Sensitive values are stored AES-256-GCM-encrypted in the <code className="font-mono">platform_settings</code> table.
        Source <span className="font-mono">db</span> = stored by an admin here. Source <span className="font-mono">env</span> = falling back to the deployment's environment variable. Source <span className="font-mono">unset</span> = nothing configured; the integration won't work.
        <br /><br />
        <strong className="text-foreground">Note:</strong> Better Auth (Google OAuth + magic link cookie secret) only re-reads its config on cold start.
        Updating <span className="font-mono">google.client_id</span>, <span className="font-mono">google.client_secret</span>, or <span className="font-mono">BETTER_AUTH_SECRET</span> requires a redeploy or a 5-min wait for the next cold boot.
        Paystack, Resend, S3, and cron secrets re-read on every request and take effect within 60 seconds (cache TTL).
      </p>
    </div>
  )
}

function SourceBadge({ source }: { source: 'db' | 'env' | 'unset' }) {
  const map = {
    db:    { label: 'DB',    icon: <CheckCircle weight="fill" className="size-3.5" />,    color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    env:   { label: 'ENV',   icon: <ArrowsClockwise weight="bold" className="size-3.5" />, color: 'text-amber-800 bg-amber-50 border-amber-200' },
    unset: { label: 'UNSET', icon: <XCircle weight="fill" className="size-3.5" />,         color: 'text-red-700 bg-red-50 border-red-200' },
  }[source]
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${map.color}`}>
      {map.icon}
      {map.label}
    </span>
  )
}

void Eye
void EyeSlash
