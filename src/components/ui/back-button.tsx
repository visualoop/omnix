import { ArrowLeft } from "@phosphor-icons/react"
import { useNavigate, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Props {
  /** Where to land if there's no router history (e.g. user opened the page from a deep link). */
  fallback?: string
  /** Override the default "Back" label. e.g. "Back to Reports". */
  label?: string
  className?: string
}

/**
 * BackButton — universal one-click "go back" affordance for every
 * detail / drilled page in the desktop app.
 *
 * Behavior:
 *   - If we have router history (the user clicked here from a list),
 *     navigate(-1) returns to that list with scroll position preserved.
 *   - If there's no history (deep link, fresh tab, refresh), navigates
 *     to `fallback` instead.
 *
 * Render:
 *   - Hairline button with a left arrow + label
 *   - Sits flush left at the top of the page content (above the page
 *     heading), aligned with the rest of the editorial type rhythm.
 *
 * Usage:
 *   <BackButton fallback="/reports" label="Back to reports" />
 *   <BackButton fallback="/inventory" />
 *   <BackButton />  // generic "Back", history-only
 */
export function BackButton({ fallback, label = "Back", className }: Props) {
  const navigate = useNavigate()
  const location = useLocation()

  // history.length === 1 means this tab opened straight to this page
  // (no prior route). Prefer the fallback in that case so the user
  // doesn't end up on a blank-history scroll position.
  const hasHistory = typeof window !== "undefined" && window.history.length > 1

  function go() {
    if (hasHistory) {
      navigate(-1)
    } else if (fallback) {
      navigate(fallback)
    } else {
      navigate("/")
    }
  }

  // Don't render if we're already at the root — there's no useful "back".
  if (location.pathname === "/" || location.pathname === fallback) {
    return null
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={go}
      className={cn(
        "h-8 -ml-2 mb-3 inline-flex items-center gap-1.5 px-2 text-[12px] text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] rounded-md cursor-pointer",
        className,
      )}
      aria-label={label}
    >
      <ArrowLeft className="h-3.5 w-3.5" weight="regular" />
      <span>{label}</span>
    </Button>
  )
}
