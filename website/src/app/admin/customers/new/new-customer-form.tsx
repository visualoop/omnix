'use client'

import { useState } from 'react'
import { CheckCircle, Copy } from '@phosphor-icons/react'

type Variant = 'dawa' | 'retail' | 'hospitality' | 'hardware'
const VARIANTS: Array<{ id: Variant; label: string }> = [
  { id: 'dawa', label: 'Omnix Dawa (Pharmacy)' },
  { id: 'retail', label: 'Omnix Retail' },
  { id: 'hospitality', label: 'Omnix Hospitality' },
  { id: 'hardware', label: 'Omnix Hardware' },
]

interface Result {
  ok: true
  user: { id: string; email: string; name: string }
  tempPassword: string
  license: { id: string; licenseKey: string; variant: Variant; trialEndsAt: string } | null
}

export function NewCustomerForm() {
  const [orgName, setOrgName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('KE')
  const [currency, setCurrency] = useState('KES')
  const [variant, setVariant] = useState<Variant | ''>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const submit = async () => {
    if (!orgName.trim()) {
      setError('Organisation name is required')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName: orgName.trim(),
          email: email.trim() || undefined,
          phoneNumber: phone.trim() || undefined,
          country,
          currency,
          issueTrialVariant: variant || undefined,
        }),
      })
      const j = await res.json()
      if (!res.ok || !j.ok) {
        setError(j.error || 'Failed to create')
        return
      }
      setResult(j as Result)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 mb-2">
            <CheckCircle weight="fill" className="size-5" />
            <span className="text-sm font-medium">Customer created</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Share these credentials with the customer over WhatsApp/phone. They&rsquo;ll sign in
            at <code className="px-1 rounded bg-muted">omnix.co.ke/login</code> and can update
            their email + password from their profile page.
          </p>
        </div>

        <CredentialsPanel
          label="Email / username"
          value={result.user.email}
          note={result.user.email.endsWith('@omnix-customer.local') ? 'Placeholder — customer can change this later.' : undefined}
        />
        <CredentialsPanel label="Temporary password" value={result.tempPassword} monospaced />

        {result.license ? (
          <div className="rounded-lg border border-border p-4 space-y-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Trial licence issued
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Key</div>
                <code className="font-mono text-[13px] text-foreground select-all">
                  {result.license.licenseKey}
                </code>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Trial ends</div>
                <div className="text-sm">{new Date(result.license.trialEndsAt).toISOString().slice(0, 10)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Variant</div>
                <div className="text-sm capitalize">{result.license.variant}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Mark paid</div>
                <a
                  href={`/admin/licenses/${result.license.id}`}
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  Go to licence detail →
                </a>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex gap-2">
          <button
            className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-accent"
            onClick={() => {
              setResult(null)
              setOrgName('')
              setEmail('')
              setPhone('')
              setVariant('')
            }}
          >
            Create another
          </button>
          <a
            href={`/admin/users/${result.user.id}`}
            className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90"
          >
            View customer →
          </a>
        </div>
      </div>
    )
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Organisation name" required>
          <input
            required
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="e.g. Naivas Chemist Kilifi"
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
          />
        </Field>
        <Field label="Phone (optional)">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+254 700 000 000"
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
          />
        </Field>
        <Field label="Email (optional)" help="Leave blank if the customer doesn't want to give one. We generate a placeholder they can replace from their profile.">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@example.com"
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
          />
        </Field>
        <Field label="Country / currency">
          <div className="flex gap-2">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="h-10 px-2 rounded-md border border-input bg-background text-sm"
            >
              {['KE', 'UG', 'TZ', 'RW', 'NG', 'GH', 'ZA'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="h-10 px-2 rounded-md border border-input bg-background text-sm"
            >
              {['KES', 'UGX', 'TZS', 'RWF', 'NGN', 'GHS', 'ZAR', 'USD'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </Field>
      </div>

      <Field
        label="Issue a 30-day trial licence?"
        help="Optional. You can also issue licences later from /admin/licenses."
      >
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => setVariant('')}
            className={`h-9 rounded-md border text-xs ${
              variant === '' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
            }`}
          >
            No licence
          </button>
          {VARIANTS.map((v) => (
            <button
              type="button"
              key={v.id}
              onClick={() => setVariant(v.id)}
              className={`h-9 rounded-md border text-xs ${
                variant === v.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </Field>

      {error ? (
        <div className="text-sm text-destructive rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
          {error}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <a
          href="/admin/users"
          className="h-10 px-4 grid place-items-center rounded-md border border-border text-sm hover:bg-accent"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={busy}
          className="h-10 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create customer'}
        </button>
      </div>
    </form>
  )
}

function Field({
  label,
  help,
  required,
  children,
}: {
  label: string
  help?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-foreground">
        {label} {required ? <span className="text-destructive">*</span> : null}
      </span>
      {help ? <span className="block text-[11px] text-muted-foreground mt-0.5">{help}</span> : null}
      <div className="mt-1">{children}</div>
    </label>
  )
}

function CredentialsPanel({ label, value, note, monospaced }: { label: string; value: string; note?: string; monospaced?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">
        {label}
      </div>
      <div className="flex items-center gap-3">
        <code
          className={`flex-1 select-all text-[15px] ${monospaced ? 'font-mono tracking-[0.08em]' : ''}`}
        >
          {value}
        </code>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:border-primary/40"
        >
          <Copy className="size-3.5" />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {note ? <p className="text-[11px] text-muted-foreground mt-2">{note}</p> : null}
    </div>
  )
}
