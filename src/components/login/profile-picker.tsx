/**
 * Login profile picker.
 *
 * On app start (or after logout) we render one row per active user instead of
 * an empty username field. The user clicks their row, types the password, and
 * signs in.
 *
 * Design: a compact, scrollable list (not big cards) so it stays tidy whether
 * there are 2 users or 20. Neutral, theme-driven surfaces — no per-role accent
 * colours — so it inherits whatever palette the install runs (per the
 * frontend-design skill: spend boldness elsewhere, keep sign-in quiet).
 *
 * If there are 0 users → caller falls through to the setup flow.
 * If there's exactly 1 user → caller can auto-pick on mount.
 * If there are 2+ users → render the list.
 */
import { CaretRight } from "@phosphor-icons/react"
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
          Pick your profile — you&rsquo;ll enter your password next.
        </p>
      </div>

      <ul
        className="flex flex-col gap-0.5 max-h-[320px] overflow-y-auto -mx-1 px-1"
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
                "group flex w-full items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors cursor-pointer",
                "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <span
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] text-foreground/80 text-[13px] font-medium"
                aria-hidden
              >
                {initialsOf(u.full_name || u.username, u.username)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-foreground" title={u.full_name || u.username}>
                  {u.full_name || u.username}
                </span>
                <span className="block truncate font-mono text-[11px] text-muted-foreground">@{u.username}</span>
              </span>
              <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{u.role}</span>
              <CaretRight className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
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
