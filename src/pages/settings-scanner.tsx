/**
 * Scanner test panel — Settings → POS → Scanner.
 *
 * USB HID barcode scanners present themselves to the OS as keyboards,
 * so there's no reliable "detect scanner" API. What we CAN do is
 * verify the scanner is working, capture the terminator character
 * (Enter / Tab / newline / nothing), and store user preferences so
 * scans across the app behave consistently.
 *
 * Flow:
 *   1. Owner opens Settings → POS → Scanner
 *   2. Focuses the test input
 *   3. Scans any barcode
 *   4. The panel echoes what was captured + times it (fast burst = a
 *      scanner, slow character-by-character = hand typing)
 *   5. Saves the detected terminator + auto-focus preference
 */
import { useEffect, useRef, useState } from "react"
import { Barcode, CheckCircle } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { query, execute } from "@/lib/db"
import { toast } from "sonner"

interface ScannerSettings {
  auto_focus: boolean
  terminator: "enter" | "tab" | "newline" | "none"
  min_burst_ms: number
}

const DEFAULTS: ScannerSettings = {
  auto_focus: true,
  terminator: "enter",
  min_burst_ms: 50,
}

interface Sample {
  text: string
  timestamps: number[]
  terminator: ScannerSettings["terminator"]
}

export function ScannerSettingsPage() {
  const [settings, setSettings] = useState<ScannerSettings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [sample, setSample] = useState<Sample | null>(null)
  const testRef = useRef<HTMLInputElement>(null)
  const bufferRef = useRef<Sample>({ text: "", timestamps: [], terminator: "none" })

  useEffect(() => {
    query<{ key: string; value: string }>(
      `SELECT key, value FROM settings WHERE key LIKE 'scanner.%'`,
    )
      .then((rows) => {
        const map = new Map(rows.map((r) => [r.key.replace(/^scanner\./, ""), r.value]))
        const merged: ScannerSettings = {
          auto_focus: (map.get("auto_focus") ?? (DEFAULTS.auto_focus ? "1" : "0")) === "1",
          terminator: (map.get("terminator") as ScannerSettings["terminator"] | undefined) ?? DEFAULTS.terminator,
          min_burst_ms: Number(map.get("min_burst_ms") ?? DEFAULTS.min_burst_ms),
        }
        setSettings(merged)
      })
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    for (const [k, v] of Object.entries(settings)) {
      await execute(
        `INSERT INTO settings (key, value, category) VALUES (?1, ?2, 'scanner')
         ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = datetime('now')`,
        [`scanner.${k}`, String(v)],
      )
    }
    toast.success("Scanner settings saved")
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = performance.now()
    const buf = bufferRef.current

    if (e.key === "Enter") {
      e.preventDefault()
      buf.terminator = "enter"
      commit()
      return
    }
    if (e.key === "Tab") {
      e.preventDefault()
      buf.terminator = "tab"
      commit()
      return
    }
    if (e.key.length === 1) {
      buf.text += e.key
      buf.timestamps.push(now)
    }
  }

  const commit = () => {
    const finalised: Sample = { ...bufferRef.current }
    setSample(finalised)
    // Auto-persist the detected terminator to make the setting sticky
    // — the operator doesn't need to click a dropdown afterwards.
    setSettings((s) => ({ ...s, terminator: finalised.terminator }))
    // Reset for next scan
    bufferRef.current = { text: "", timestamps: [], terminator: "none" }
    if (testRef.current) testRef.current.value = ""
  }

  const scannerLikeSpeed = sample && sample.timestamps.length > 1
    ? (() => {
        const gaps = sample.timestamps
          .slice(1)
          .map((t, i) => t - sample.timestamps[i])
        const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length
        return { avgMs: Math.round(avg), fast: avg < 20 }
      })()
    : null

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Barcode className="size-4" />
          Test your scanner
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Click the input below and scan any barcode. We echo what was captured
          and detect the terminator character your scanner sends after each
          scan (Enter is standard on most keyboard-emulating scanners).
        </p>
        <div className="mt-4 rounded-md border border-dashed border-border p-4 space-y-3">
          <input
            ref={testRef}
            onKeyDown={onKeyDown}
            placeholder="Focus here and scan a barcode…"
            className="w-full h-11 px-3 rounded-md border border-input bg-background text-sm font-mono outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {sample ? (
            <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs space-y-1">
              <div className="flex items-center gap-2 font-medium text-emerald-700">
                <CheckCircle className="size-4" weight="fill" />
                Captured
              </div>
              <div className="font-mono text-[13px] text-foreground break-all">
                {sample.text || <em className="text-muted-foreground">(empty)</em>}
              </div>
              <div className="text-muted-foreground">
                Terminator: <strong>{sample.terminator}</strong>
                {scannerLikeSpeed ? (
                  <>
                    {" · "}avg keystroke: <strong>{scannerLikeSpeed.avgMs}ms</strong>{" "}
                    ({scannerLikeSpeed.fast ? "looks like a scanner" : "looks like typing"})
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium">Behaviour</h3>
        <div className="mt-4 space-y-4">
          <label className="flex items-start justify-between gap-4 cursor-pointer">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground">Auto-focus search on POS load</div>
              <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Keeps the search input focused so scans always land in the right place.
              </div>
            </div>
            <Switch
              checked={settings.auto_focus}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, auto_focus: v }))}
            />
          </label>

          <div className="space-y-1">
            <div className="text-sm font-medium text-foreground">Detected terminator</div>
            <div className="text-xs text-muted-foreground">
              Set automatically during the scan test above. Change here only if
              your scanner mis-detects.
            </div>
            <div className="mt-2 inline-flex gap-2">
              {(["enter", "tab", "newline", "none"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSettings((s) => ({ ...s, terminator: t }))}
                  className={`px-3 py-1.5 rounded-md border text-xs font-medium transition ${
                    settings.terminator === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save}>Save scanner settings</Button>
      </div>
    </div>
  )
}
