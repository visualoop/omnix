/**
 * Quantity multiplier — tap a product, set how many to add.
 *
 * Touch-first: the dialog renders an inline 3×4 numeric pad (with ⌫ and
 * +/-) so the cashier can confirm the qty without ever touching a
 * keyboard. Comfortable mode keeps the keypad too — it's the right UX
 * for a quick numeric prompt regardless of pointer type.
 *
 * Keystrokes (1-9, 0, .) still work for power users who prefer the
 * keyboard. Enter commits; Esc cancels.
 */
import { useEffect, useState, useRef } from "react"
import {
  Backspace,
  Plus,
  Minus,
} from "@phosphor-icons/react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface Props {
  open: boolean
  onClose: () => void
  currentValue: number
  onSet: (value: number) => void
}

export function QtyMultiplierDialog({ open, onClose, currentValue, onSet }: Props) {
  const [value, setValue] = useState(String(currentValue))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setValue(String(currentValue))
  }, [open, currentValue])

  const submit = () => {
    const n = Math.max(1, Math.min(99, parseInt(value, 10) || 1))
    onSet(n)
  }

  const press = (k: string) => {
    if (k === "back") return setValue((v) => v.slice(0, -1) || "")
    if (k === "+") return setValue((v) => String(Math.min(99, (parseInt(v, 10) || 0) + 1)))
    if (k === "−") return setValue((v) => String(Math.max(1, (parseInt(v, 10) || 1) - 1)))
    setValue((v) => {
      const next = v === "0" || v === "" ? k : v + k
      const n = parseInt(next, 10)
      return n > 99 ? "99" : next
    })
  }

  const KEYS: Array<{ k: string; label: React.ReactNode }> = [
    { k: "1", label: "1" }, { k: "2", label: "2" }, { k: "3", label: "3" },
    { k: "4", label: "4" }, { k: "5", label: "5" }, { k: "6", label: "6" },
    { k: "7", label: "7" }, { k: "8", label: "8" }, { k: "9", label: "9" },
    { k: "−", label: <Minus className="size-5" /> },
    { k: "0", label: "0" },
    { k: "back", label: <Backspace className="size-5" /> },
  ]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm gap-0 p-0 overflow-hidden">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>Set quantity</DialogTitle>
          <DialogDescription>The next item added will use this quantity (1–99).</DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* Big readout */}
          <div className="flex items-baseline justify-center rounded-md border border-border bg-muted/30 px-6 py-5">
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "")
                setValue(v.slice(0, 2))
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit()
              }}
              autoFocus
              inputMode="numeric"
              className="w-full bg-transparent text-center text-[56px] font-mono font-medium tabular-nums tracking-tight outline-none"
              placeholder="1"
            />
            <span className="text-[14px] font-mono text-muted-foreground ml-1">×</span>
          </div>

          {/* Inline pad */}
          <div className="grid grid-cols-3 gap-2">
            {KEYS.map(({ k, label }) => (
              <button
                key={k}
                type="button"
                onClick={() => press(k)}
                className="flex h-14 items-center justify-center rounded-md border border-border bg-card text-[20px] font-medium hover:bg-accent active:translate-y-px"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Plus accelerator on a separate row, full-width — POS staff
              tap this when they want to bump from 5 → 10. */}
          <Button
            variant="outline"
            size="lg"
            onClick={() => press("+")}
            className="w-full"
          >
            <Plus className="size-4" />
            Add one
          </Button>
        </div>

        <div className="flex items-center gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" size="lg" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button size="lg" onClick={submit} className="flex-[2]">
            Set ×{Math.max(1, parseInt(value, 10) || 1)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
