/**
 * Print settings — Settings → Printing.
 *
 * Single place the operator configures how Omnix prints:
 *   - Auto-print toggles per document type (receipt / kitchen ticket /
 *     delivery note / dispense label)
 *   - Prompt-before-print for manual prints
 *   - Cash-drawer kick on cash sale
 *   - Preferred printer names per stream (receipt / kitchen / label)
 *
 * All values persist through the `settings` KV table under the
 * `printing` category and are read at print time by `services/receipt`
 * and the KOT + delivery-note + label services.
 */
import { useEffect, useState } from "react"
import { Printer } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import {
  DEFAULT_PRINT_SETTINGS,
  getPrintSettings,
  savePrintSettings,
  type PrintSettings,
} from "@/services/print-settings"

export function PrintSettingsPage() {
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getPrintSettings()
      .then(setSettings)
      .finally(() => setLoading(false))
  }, [])

  const set = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }))

  const save = async () => {
    setSaving(true)
    try {
      await savePrintSettings(settings)
      toast.success("Print settings saved")
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return <div className="text-sm text-muted-foreground">Loading print settings…</div>

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Printer className="size-4" />
          Auto-print
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Print the moment the corresponding event fires. Turn off if your
          cashier prefers to print on demand.
        </p>
        <div className="mt-4 space-y-4">
          <ToggleRow
            label="Print receipt on sale completion"
            help="Sends the receipt to the receipt printer as soon as a sale is completed."
            value={settings.auto_print_receipt}
            onChange={(v) => set("auto_print_receipt", v)}
          />
          <ToggleRow
            label="Print kitchen ticket on send-to-kitchen"
            help="Hospitality: prints the KOT at the assigned kitchen station when a waiter fires an order."
            value={settings.auto_print_kitchen}
            onChange={(v) => set("auto_print_kitchen", v)}
          />
          <ToggleRow
            label="Print delivery note on dispatch"
            help="Hardware: prints a delivery note when a quotation moves to dispatched."
            value={settings.auto_print_delivery}
            onChange={(v) => set("auto_print_delivery", v)}
          />
          <ToggleRow
            label="Print dispense label on dispense"
            help="Pharmacy: prints a per-item label after a prescription is dispensed."
            value={settings.auto_print_dispense_label}
            onChange={(v) => set("auto_print_dispense_label", v)}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium">Manual printing</h3>
        <div className="mt-4 space-y-4">
          <ToggleRow
            label="Prompt before printing"
            help="When on, the OS print dialog opens for every manual print. Turn off to print silently to the default printer."
            value={settings.prompt_before_print}
            onChange={(v) => set("prompt_before_print", v)}
          />
          <ToggleRow
            label="Kick cash drawer on cash sale"
            help="Sends the ESC/POS cash-drawer pulse to the receipt printer when a sale is settled in cash. Requires a compatible printer + drawer."
            value={settings.drawer_kick_on_cash}
            onChange={(v) => set("drawer_kick_on_cash", v)}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium">Preferred printers</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Type the OS printer name exactly as it appears in your Windows
          Printers list. Leave blank to use the default printer.
        </p>
        <div className="mt-4 space-y-3">
          <InputRow
            label="Receipt printer"
            placeholder="e.g. EPSON TM-T20III Receipt"
            value={settings.receipt_printer_name}
            onChange={(v) => set("receipt_printer_name", v)}
          />
          <InputRow
            label="Kitchen printer (fallback)"
            placeholder="e.g. XPRINTER XP-T80 Kitchen"
            help="Individual kitchen stations can override this in Hospitality → Stations."
            value={settings.kitchen_printer_name}
            onChange={(v) => set("kitchen_printer_name", v)}
          />
          <InputRow
            label="Label printer"
            placeholder="e.g. Zebra ZD230 Label"
            value={settings.label_printer_name}
            onChange={(v) => set("label_printer_name", v)}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save print settings"}
        </Button>
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  help,
  value,
  onChange,
}: {
  label: string
  help?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {help ? (
          <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{help}</div>
        ) : null}
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </label>
  )
}

function InputRow({
  label,
  placeholder,
  value,
  onChange,
  help,
}: {
  label: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  help?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {help ? <div className="text-xs text-muted-foreground">{help}</div> : null}
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-mono text-xs"
      />
    </div>
  )
}
