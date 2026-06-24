/**
 * Login profile picker.
 *
 * On app start (or after logout) we render a tile per active user instead
 * of an empty username field. The cashier clicks their tile, types the
 * password, and signs in.
 *
 * Tile shape:
 *   - Big circular avatar with initials (no images yet — we use the role
 *     accent colour as the fill so tiles aren't all identical)
 *   - Full name in serif at the top, role pill underneath
 *   - Hover lifts the tile slightly
 *
 * If there are 0 users → caller falls through to the setup flow.
 * If there's exactly 1 user → caller can auto-pick on mount.
 * If there are 2+ users → render the grid.
 */
import type { User } from "@/services/auth"
import { cn } from "@/lib/utils"

interface Props {
  users: User[]
  /** Click handler — caller transitions the parent UI to the password step. */
  onPick: (user: User) => void
  /** "Use another account" — caller switches to a free-form username input. */
  onUseOther?: () => void
  /** Optional className override on the outer wrapper. */
  className?: string
}

const ROLE_COLORS: Record<User["role"], string> = {
  owner: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  manager: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  cashier: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  viewer: "bg-foreground/10 text-foreground/70 border-foreground/20",
}

const AVATAR_TONES: Record<User["role"], string> = {
  owner: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  manager: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  cashier: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  viewer: "bg-foreground/15 text-foreground/80",
}

function initialsOf(fullName: string, fallback: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return fallback.slice(0, 2).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function ProfilePicker({ users, onPick, onUseOther, className }: Props) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="text-center space-y-1">
        <h2 className="text-base font-semibold tracking-tight">Who&rsquo;s signing in?</h2>
        <p className="text-xs text-muted-foreground">
          Pick your profile. You&rsquo;ll enter your password next.
        </p>
      </div>

      <ul
        className={cn(
          "grid gap-2",
          users.length <= 2 ? "grid-cols-1" : users.length <= 4 ? "grid-cols-2" : "grid-cols-3",
        )}
        role="listbox"
        aria-label="Choose user profile"
      >
        {users.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onClick={() => onPick(u)}
              role="option"
              aria-selected={false}
              className={cn(
                "group relative flex w-full flex-col items-center gap-2.5 rounded-xl border border-border/60 bg-foreground/[0.02] p-4 text-center transition-all cursor-pointer",
                "hover:border-foreground/30 hover:bg-foreground/[0.04] hover:-translate-y-[1px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-12 items-center justify-center rounded-full font-mono text-[15px] font-semibold tabular-nums",
                  AVATAR_TONES[u.role],
                )}
                aria-hidden
              >
                {initialsOf(u.full_name || u.username, u.username)}
              </span>
              <span className="flex flex-col items-center gap-1">
                <span
                  className="line-clamp-1 text-[13px] font-medium text-foreground"
                  title={u.full_name || u.username}
                >
                  {u.full_name || u.username}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground line-clamp-1">
                  @{u.username}
                </span>
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em]",
                  ROLE_COLORS[u.role],
                )}
              >
                {u.role}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {onUseOther ? (
        <button
          type="button"
          onClick={onUseOther}
          className="text-center text-[12px] text-muted-foreground hover:text-foreground transition-colors py-1 cursor-pointer"
        >
          Use a different account
        </button>
      ) : null}
    </div>
  )
}

export { initialsOf }
