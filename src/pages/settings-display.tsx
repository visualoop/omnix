/**
 * Settings → Display & Touch.
 *
 * Lets the operator pick UI density:
 *   - Auto (default) — detects coarse pointer + viewport, picks touch
 *     on a tablet or POS terminal and comfortable on a desktop.
 *   - Comfortable — desktop sizing, ~32px row height, 13px body.
 *   - Touch — ≥44px targets, 15px body, on-screen keypad on numerics.
 *
 * The choice persists in `settings.ui.density`. Touch mode unlocks the
 * TouchKeypad component on numeric inputs in dialogs that opt in
 * (Receive Stock, Qty Multiplier, Cash Open/Close, Petty Cash, …).
 */
import { useEffect, useState } from "react"
import { Check, DeviceMobile, Monitor, MagicWand as Wand } from "@phosphor-icons/react"
import { PageHeader } from "@/components/layout/page-header"
import { useDensityStore, type Density } from "@/stores/density"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

type Mode = Density | "auto"

const OPTIONS: Array<{
  id: Mode
  title: string
  description: string
  Icon: typeof DeviceMobile
}> = [
  {
    id: "auto",
    title: "Auto — match the device",
    description:
      "Picks Touch on tablets and POS terminals (coarse pointer, narrow viewport), Comfortable elsewhere. Reactive to plug-in mice.",
    Icon: Wand,
  },
  {
    id: "comfortable",
    title: "Comfortable",
    description:
      "Desktop sizing — 32px controls, 13px body. Best when you have a real keyboard and trackpad.",
    Icon: Monitor,
  },
  {
    id: "touch",
    title: "Touch",
    description:
      "≥44px targets, 15px body, on-screen keypad on numeric fields. Use this on every POS / tablet install.",
    Icon: DeviceMobile,
  },
]

export function SettingsDisplayPage() {
  const density = useDensityStore((s) => s.density)
  const explicit = useDensityStore((s) => s.explicit)
  const setDensity = useDensityStore((s) => s.setDensity)
  const [active, setActive] = useState<Mode>(explicit ? density : "auto")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setActive(explicit ? density : "auto")
  }, [explicit, density])

  const choose = async (m: Mode) => {
    setBusy(true)
    try {
      await setDensity(m)
      setActive(m)
      toast.success(
        m === "auto" ? "Reverted to auto-detect" : `Display set to ${m === "touch" ? "Touch" : "Comfortable"}`,
      )
    } catch (e) {
      toast.error(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <PageHeader
        eyebrow="Settings"
        title="Display & Touch"
        description={
          density === "touch"
            ? `You're in Touch mode right now. ${explicit ? "(explicit choice)" : "(auto-detected)"}`
            : `You're in Comfortable mode. ${explicit ? "(explicit choice)" : "(auto-detected)"}`
        }
      />

      <ul className="flex flex-col gap-2">
        {OPTIONS.map((opt) => {
          const isActive = active === opt.id
          return (
            <li key={opt.id}>
              <button
                type="button"
                onClick={() => choose(opt.id)}
                disabled={busy}
                className={`flex w-full items-start gap-4 rounded-md border p-4 text-left transition-colors ${
                  isActive
                    ? "border-foreground/40 bg-foreground/[0.03]"
                    : "border-foreground/10 bg-foreground/[0.01] hover:bg-foreground/[0.03]"
                }`}
              >
                <opt.Icon className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <span className="font-medium text-[14px] flex items-center gap-2">
                    {opt.title}
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/70">
                        <Check className="size-3" />
                        Active
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[12px] text-muted-foreground leading-relaxed">{opt.description}</span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      {/* Live preview row */}
      <section className="rounded-md border border-foreground/10 bg-foreground/[0.02] p-4 space-y-3">
        <header className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Preview
        </header>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input placeholder="Sample input" className="sm:flex-1" />
          <Button variant="outline">Sample outline</Button>
          <Button>Primary action</Button>
        </div>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          Pick a mode above and watch the input + buttons resize live. The same tokens drive every dialog and form in the
          app, so what you see here is what you get.
        </p>
      </section>
    </div>
  )
}
