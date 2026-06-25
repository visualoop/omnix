/**
 * TouchKeypad — slide-up numeric panel for tablet/touch POS terminals.
 *
 * Usage:
 *   const ref = useRef<HTMLInputElement>(null)
 *   <Input ref={ref} … />
 *   <TouchKeypad inputRef={ref} mode="currency" onCommit={() => save()} />
 *
 * Renders only when `useIsTouch()` is true. The panel:
 *   - Anchors to the bottom of the viewport with a 1px hairline rule
 *   - Wide 56-pixel keys (Apple HIG min 44, we go bigger because POS
 *     staff often wear gloves or work fast)
 *   - Numeric, currency (adds 00/000), quantity (adds +1/+5/+10/×2)
 *   - ⌫ deletes the last char; long-press not supported (kept simple)
 *   - Enter calls onCommit (typically save())
 *
 * The panel pushes content via a 280px bottom-padding spacer when open,
 * so the focused input is never hidden by the keypad on small screens.
 */
import { useEffect, useRef } from "react"
import { useIsTouch } from "@/stores/density"
import { cn } from "@/lib/utils"
import { Backspace, ArrowElbowDownLeft } from "@phosphor-icons/react"

export type KeypadMode = "number" | "currency" | "quantity"

interface Props {
  /** The input the keypad writes into. */
  inputRef: React.RefObject<HTMLInputElement | null>
  /** Open state — typically tied to whether the input is focused. */
  open: boolean
  /** Called when the user taps Enter. */
  onCommit?: () => void
  /** Called when the user taps anywhere outside the panel. */
  onDismiss?: () => void
  mode?: KeypadMode
  /** Hide the panel entirely (e.g. on a desktop overlay test). */
  forceHidden?: boolean
}

const NUMERIC_ROWS: string[][] = [
  ["7", "8", "9"],
  ["4", "5", "6"],
  ["1", "2", "3"],
  ["0", ".", "back"],
]

const CURRENCY_EXTRAS = ["00", "000"]
const QUANTITY_EXTRAS = ["+1", "+5", "+10", "×2"]

function setInputValue(input: HTMLInputElement, value: string) {
  // React tracks the input value via its internal valueTracker; using
  // the native setter + bubbling an `input` event makes React notice
  // the change and re-run the onChange handler.
  const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")
  desc?.set?.call(input, value)
  input.dispatchEvent(new Event("input", { bubbles: true }))
}

export function TouchKeypad({
  inputRef,
  open,
  onCommit,
  onDismiss,
  mode = "number",
  forceHidden = false,
}: Props) {
  const touch = useIsTouch()
  const panelRef = useRef<HTMLDivElement>(null)

  // Add a spacer below the page content so the keypad doesn't cover
  // the focused input. We only push when the keypad is actually shown.
  useEffect(() => {
    if (!touch || !open || forceHidden) return
    document.body.style.paddingBottom = "300px"
    return () => {
      document.body.style.paddingBottom = ""
    }
  }, [touch, open, forceHidden])

  if (!touch || !open || forceHidden) return null

  const press = (key: string) => {
    const input = inputRef.current
    if (!input) return
    const current = input.value
    let next = current
    if (key === "back") {
      next = current.slice(0, -1)
    } else if (key === "enter") {
      onCommit?.()
      return
    } else if (key === "×2") {
      const n = Number(current)
      next = Number.isFinite(n) ? String(n * 2) : current
    } else if (key.startsWith("+")) {
      const delta = Number(key.slice(1))
      const n = Number(current) || 0
      next = String(n + delta)
    } else if (key === ".") {
      if (current.includes(".")) return
      next = current + "."
    } else {
      next = current + key
    }
    setInputValue(input, next)
    input.focus()
  }

  const extras = mode === "currency" ? CURRENCY_EXTRAS : mode === "quantity" ? QUANTITY_EXTRAS : []

  return (
    <>
      {/* click-outside dismiss layer */}
      <div
        className="fixed inset-0 bottom-[280px] z-40"
        onClick={() => onDismiss?.()}
        aria-hidden
      />
      <div
        ref={panelRef}
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background shadow-[0_-4px_24px_rgb(0_0_0_/_0.08)]"
        role="dialog"
        aria-label="On-screen keypad"
      >
        <div className="mx-auto max-w-md p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {NUMERIC_ROWS.flat().map((k) => (
              <KeypadKey key={k} value={k} onPress={() => press(k)}>
                {k === "back" ? <Backspace className="size-5" /> : k}
              </KeypadKey>
            ))}
          </div>
          {extras.length > 0 ? (
            <div className={cn("grid gap-2", extras.length === 2 ? "grid-cols-2" : "grid-cols-4")}>
              {extras.map((k) => (
                <KeypadKey key={k} value={k} onPress={() => press(k)}>
                  {k}
                </KeypadKey>
              ))}
            </div>
          ) : null}
          {onCommit ? (
            <button
              type="button"
              onClick={() => press("enter")}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 text-[15px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <ArrowElbowDownLeft className="size-5" />
              Enter
            </button>
          ) : null}
        </div>
      </div>
    </>
  )
}

function KeypadKey({
  value,
  onPress,
  children,
}: {
  value: string
  onPress: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      data-value={value}
      className="flex h-14 items-center justify-center rounded-md border border-border bg-card text-[18px] font-medium text-foreground transition-colors hover:bg-accent active:bg-accent/70 active:translate-y-px"
    >
      {children}
    </button>
  )
}
