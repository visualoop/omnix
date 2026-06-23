import { Desktop, MapPin, ShieldCheck, ShieldWarning, Network } from '@phosphor-icons/react/dist/ssr'
import { StatusDot } from './status-dot'

interface MachineLike {
  id: string
  hostname: string | null
  os: string | null
  currentVersion: string | null
  city: string | null
  county?: string | null
  lastSeenAt: Date | null
  status: string | null
  authTokenHash?: string | null
  branchName?: string | null
  networkMode?: string | null
}

/**
 * MachineCard — a single Omnix install, drawn as a small machine card
 * with a stylised CRT-screen header (hairline frame, mono hostname),
 * status LED, OS chip, version pill, and a footer line that names where
 * the machine lives.
 *
 * The visual goal: a customer's laptop should LOOK like a laptop in the
 * grid, not a row in a spreadsheet. The header echoes a window title
 * bar; the body holds OS / version chips; the footer is plain prose
 * about location and last seen.
 *
 * Status:
 *   live    — heartbeat in last 5 min        → pulsing copper
 *   recent  — heartbeat in last 60 min       → solid amber
 *   idle    — heartbeat older than 60 min    → grey
 *   down    — no heartbeat in 24h            → red
 */
export function MachineCard({ m }: { m: MachineLike }) {
  const tone = computeTone(m.lastSeenAt)
  const pulse = tone === 'live'
  const lastSeenLabel = m.lastSeenAt ? formatRelative(m.lastSeenAt) : 'never'
  const isMaster = m.networkMode === 'lan_master'

  return (
    <div className="group relative rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] transition-colors overflow-hidden">
      {/* CRT header — three control dots like a window chrome, then hostname mono */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-2.5 bg-[var(--color-surface-2)]">
        <span className="flex gap-1.5 shrink-0">
          <span className="size-2 rounded-full bg-[var(--color-fg-subtle)] opacity-30" />
          <span className="size-2 rounded-full bg-[var(--color-fg-subtle)] opacity-30" />
          <span className="size-2 rounded-full bg-[var(--color-fg-subtle)] opacity-30" />
        </span>
        <code className="font-mono text-[12px] truncate flex-1 text-[var(--color-fg)]">
          {m.hostname ?? `unknown-${m.id.slice(0, 6)}`}
        </code>
        <StatusDot tone={tone} pulse={pulse} label={`${tone}, last seen ${lastSeenLabel}`} />
      </div>

      {/* Body — OS, version, role */}
      <div className="px-4 py-3 space-y-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Chip icon={<Desktop weight="regular" className="size-3" />} text={m.os ?? 'unknown OS'} />
          {m.currentVersion ? <Chip text={`v${m.currentVersion}`} mono /> : null}
          {isMaster ? (
            <Chip
              icon={<Network weight="regular" className="size-3" />}
              text="LAN master"
              tone="accent"
            />
          ) : null}
        </div>

        {(m.city || m.county) && (
          <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-fg-muted)]">
            <MapPin weight="regular" className="size-3 text-[var(--color-fg-subtle)]" />
            <span>{[m.city, m.county].filter(Boolean).join(', ')}</span>
          </div>
        )}

        {m.branchName && (
          <div className="text-[11px] text-[var(--color-fg-subtle)] truncate">
            {m.branchName}
          </div>
        )}
      </div>

      {/* Footer — last seen + auth state */}
      <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] px-4 py-2 text-[11px] font-mono text-[var(--color-fg-subtle)]">
        <span>last seen {lastSeenLabel}</span>
        <span className="flex items-center gap-1">
          {m.authTokenHash ? (
            <ShieldCheck weight="regular" className="size-3 text-[var(--color-positive)]" />
          ) : (
            <ShieldWarning weight="regular" className="size-3 text-[var(--color-negative)]" />
          )}
          <span className="uppercase tracking-[0.18em]">{m.status ?? 'unknown'}</span>
        </span>
      </div>
    </div>
  )
}

function Chip({
  text,
  icon,
  mono,
  tone,
}: {
  text: string
  icon?: React.ReactNode
  mono?: boolean
  tone?: 'accent'
}) {
  const isAccent = tone === 'accent'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] ${
        mono ? 'font-mono tabular-nums normal-case tracking-normal' : ''
      }`}
      style={{
        borderColor: isAccent ? 'var(--color-accent-line)' : 'var(--color-border)',
        background: isAccent ? 'var(--color-accent-soft)' : 'transparent',
        color: isAccent ? 'var(--color-accent)' : 'var(--color-fg-muted)',
      }}
    >
      {icon}
      {text}
    </span>
  )
}

function computeTone(lastSeen: Date | null): 'live' | 'recent' | 'idle' | 'down' {
  if (!lastSeen) return 'down'
  const ageMs = Date.now() - new Date(lastSeen).getTime()
  if (ageMs < 5 * 60 * 1000) return 'live'
  if (ageMs < 60 * 60 * 1000) return 'recent'
  if (ageMs < 24 * 60 * 60 * 1000) return 'idle'
  return 'down'
}

function formatRelative(d: Date): string {
  const ms = Date.now() - new Date(d).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ago`
  const days = Math.floor(h / 24)
  return `${days}d ago`
}
