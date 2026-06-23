import { CalendarBlank, Tag, User } from '@phosphor-icons/react/dist/ssr'

interface LicenseLike {
  id: string
  licenseKey: string
  variant: string | null
  tier: string | null
  status: string | null
  trialEndsAt: Date | null
  maintenanceUntil: Date | null
  maxMachines: number | null
  maxBranches: number | null
  customerEmail?: string | null
  createdAt: Date | null
}

/**
 * LicenseCard — a visual license document, not a row.
 *
 * Layout: hairline-bordered card with a copper accent strip on the left
 * (the only strong colour), serif "OMNIX" logotype on top, the license
 * key set in mono with letter-spacing for readability, then a row of
 * quiet stats (variant, tier, machines/branches), and a footer with
 * status + maintenance expiry.
 *
 * The status appears as a small wax-seal style circle in the top-right
 * with one of: ACTIVE, TRIAL, LAPSED, REVOKED.
 */
export function LicenseCard({ l }: { l: LicenseLike }) {
  const statusInfo = STATUS_INFO[l.status ?? 'unknown'] ?? STATUS_INFO.unknown
  const expiryDate = l.maintenanceUntil ?? l.trialEndsAt
  const daysLeft = expiryDate ? daysBetween(new Date(), new Date(expiryDate)) : null

  return (
    <div className="relative grid grid-cols-[6px_1fr] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] transition-colors overflow-hidden">
      {/* Copper accent strip on the left — the single strong note */}
      <div style={{ background: 'var(--color-accent)' }} className="opacity-90" />

      <div className="px-5 py-4">
        {/* Top row: brand + status seal */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div
              style={{ fontFamily: 'var(--font-display)' }}
              className="text-[14px] font-medium tracking-[0.04em] uppercase text-[var(--color-fg)]"
            >
              Omnix
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--color-fg-subtle)] mt-0.5">
              {l.variant ?? 'pro'} · {l.tier ?? 'starter'}
            </div>
          </div>
          <StatusSeal label={statusInfo.label} colour={statusInfo.colour} />
        </div>

        {/* License key — the hero of the card */}
        <code
          className="block mt-4 font-mono text-[15px] tabular-nums tracking-[0.08em] text-[var(--color-fg)] select-all"
          style={{ wordBreak: 'break-all' }}
        >
          {formatKey(l.licenseKey)}
        </code>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-3 gap-3 text-[11px]">
          <Stat label="Machines" value={String(l.maxMachines ?? 1)} />
          <Stat label="Branches" value={String(l.maxBranches ?? 1)} />
          <Stat
            label={l.status === 'trial' ? 'Trial ends' : 'Maint. until'}
            value={expiryDate ? new Date(expiryDate).toISOString().slice(0, 10) : '—'}
            mono
          />
        </div>

        {/* Footer — owner email + days left */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3 text-[11px] text-[var(--color-fg-subtle)]">
          <span className="flex items-center gap-1.5 truncate min-w-0">
            <User weight="regular" className="size-3" />
            <span className="truncate">{l.customerEmail ?? 'unassigned'}</span>
          </span>
          {daysLeft !== null && (
            <span
              className="flex items-center gap-1 font-mono shrink-0"
              style={{
                color:
                  daysLeft < 0
                    ? 'var(--color-negative)'
                    : daysLeft < 14
                    ? 'var(--color-caution)'
                    : 'var(--color-fg-subtle)',
              }}
            >
              <CalendarBlank weight="regular" className="size-3" />
              {daysLeft < 0 ? `expired ${-daysLeft}d ago` : `${daysLeft}d left`}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusSeal({ label, colour }: { label: string; colour: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] shrink-0"
      style={{
        borderColor: colour,
        color: colour,
        background: 'transparent',
      }}
    >
      <Tag weight="fill" className="size-2.5" />
      {label}
    </span>
  )
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--color-fg-subtle)]">{label}</div>
      <div className={`text-[var(--color-fg)] mt-1 ${mono ? 'font-mono tabular-nums text-[12px]' : 'text-[13px]'}`}>
        {value}
      </div>
    </div>
  )
}

const STATUS_INFO: Record<string, { label: string; colour: string }> = {
  active:   { label: 'Active',   colour: 'var(--color-positive)' },
  trial:    { label: 'Trial',    colour: 'var(--color-caution)'  },
  lapsed:   { label: 'Lapsed',   colour: 'var(--color-fg-subtle)' },
  revoked:  { label: 'Revoked',  colour: 'var(--color-negative)' },
  unknown:  { label: 'Unknown',  colour: 'var(--color-fg-subtle)' },
}

function formatKey(key: string): string {
  // Format like XXXX-XXXX-XXXX-XXXX for readability.
  if (!key) return '—'
  const compact = key.replace(/[-\s]/g, '').toUpperCase()
  if (compact.length <= 4) return compact
  return compact.match(/.{1,4}/g)?.join('-') ?? compact
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime()
  return Math.round(ms / (24 * 60 * 60 * 1000))
}
