import {
  ShieldStar, Prohibit, MapPin, At, Phone, Buildings,
} from '@phosphor-icons/react/dist/ssr'

interface UserLike {
  id: string
  email: string
  name: string | null
  image?: string | null
  role: string | null
  banned?: boolean | null
  banReason?: string | null
  country: string | null
  currency: string | null
  phoneNumber?: string | null
  businessName?: string | null
  createdAt: Date | null
  emailVerified?: boolean | null
}

const ROLE_LABEL: Record<string, string> = {
  user: 'Customer',
  platform_admin: 'Admin',
  support_agent: 'Support',
  sales_rep: 'Sales',
}

/**
 * UserCard — circular avatar with initials + role chip + business name.
 * Banned users get a red tint and prohibition icon.
 *
 * The card is dense (3-up grid) but still readable; no shadows, no
 * decorative gradients, just hairline borders + the single accent
 * applied to the role chip when role is staff.
 */
export function UserCard({ u }: { u: UserLike }) {
  const isStaff = u.role && u.role !== 'user'
  const initials = (u.name ?? u.email).slice(0, 2).toUpperCase()
  const banned = u.banned === true

  return (
    <div
      className="relative rounded-md border bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] transition-colors p-4"
      style={{
        borderColor: banned ? 'rgba(176,67,47,0.32)' : 'var(--color-border)',
        background: banned
          ? 'linear-gradient(0deg, rgba(176,67,47,0.04), rgba(176,67,47,0.04)), var(--color-surface)'
          : 'var(--color-surface)',
      }}
    >
      <div className="flex items-start gap-3">
        {u.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={u.image}
            alt=""
            className="size-10 rounded-full object-cover shrink-0"
            style={{ border: '1px solid var(--color-border)' }}
          />
        ) : (
          <div
            className="size-10 rounded-full grid place-items-center shrink-0 font-mono text-[12px] font-medium"
            style={{
              background: isStaff ? 'var(--color-accent-soft)' : 'var(--color-surface-2)',
              color: isStaff ? 'var(--color-accent)' : 'var(--color-fg-muted)',
              border: `1px solid ${isStaff ? 'var(--color-accent-line)' : 'var(--color-border)'}`,
            }}
          >
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-medium text-[var(--color-fg)] truncate">
              {u.name || u.email.split('@')[0]}
            </span>
            {banned && (
              <span
                className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em]"
                style={{ color: 'var(--color-negative)', border: '1px solid var(--color-negative)' }}
              >
                <Prohibit weight="bold" className="size-2.5" />
                Banned
              </span>
            )}
            {isStaff && !banned && (
              <span
                className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em]"
                style={{ color: 'var(--color-accent)', border: '1px solid var(--color-accent-line)', background: 'var(--color-accent-soft)' }}
              >
                <ShieldStar weight="fill" className="size-2.5" />
                {ROLE_LABEL[u.role!] ?? u.role}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--color-fg-muted)] truncate">
            <At weight="regular" className="size-3 shrink-0" />
            <span className="truncate font-mono">{u.email}</span>
          </div>
        </div>
      </div>

      {(u.businessName || u.phoneNumber || u.country) && (
        <div className="mt-3 grid grid-cols-1 gap-1 text-[11px] text-[var(--color-fg-muted)]">
          {u.businessName && (
            <div className="flex items-center gap-1.5">
              <Buildings weight="regular" className="size-3 shrink-0" />
              <span className="truncate">{u.businessName}</span>
            </div>
          )}
          {u.phoneNumber && (
            <div className="flex items-center gap-1.5">
              <Phone weight="regular" className="size-3 shrink-0" />
              <span className="font-mono">{u.phoneNumber}</span>
            </div>
          )}
          {u.country && (
            <div className="flex items-center gap-1.5">
              <MapPin weight="regular" className="size-3 shrink-0" />
              <span>{u.country} · {u.currency ?? 'KES'}</span>
            </div>
          )}
        </div>
      )}

      {banned && u.banReason && (
        <div className="mt-3 border-t border-[var(--color-border)] pt-2 text-[11px] text-[var(--color-negative)] italic">
          {u.banReason}
        </div>
      )}
    </div>
  )
}
