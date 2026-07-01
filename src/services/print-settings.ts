/**
 * Print settings — one place the operator sets how Omnix prints.
 *
 * Values are stored in the `settings` key/value table under the
 * `printing` category, so they persist across restarts and LAN sync.
 *
 * Every print-emitting surface (POS receipt, kitchen ticket, delivery
 * note, invoice, statement, Z-report, dispense label) reads via
 * `getPrintSettings()` and honours the `auto_*` toggles.
 */
import { query, execute } from "@/lib/db"

export interface PrintSettings {
  /** Automatically print a receipt after every completed sale. */
  auto_print_receipt: boolean
  /** Automatically print a kitchen ticket when an order is sent to kitchen. */
  auto_print_kitchen: boolean
  /** Automatically print a delivery note when a hardware quote is dispatched. */
  auto_print_delivery: boolean
  /** Automatically print a dispense label when a pharmacy prescription is dispensed. */
  auto_print_dispense_label: boolean
  /** When a manual print is requested, open the OS print dialog first
   *  (true = prompt) or silently send to the default printer (false). */
  prompt_before_print: boolean
  /** Kick the cash-drawer open on a cash sale completion. Requires
   *  ESC/POS-compatible printer with pass-through drawer support. */
  drawer_kick_on_cash: boolean
  /** Preferred receipt printer name — matches the OS printer label
   *  ("EPSON TM-T20III Receipt", etc.). Empty = use OS default. */
  receipt_printer_name: string
  /** Preferred kitchen-station printer (if not overridden by the station). */
  kitchen_printer_name: string
  /** Preferred label printer for pharmacy dispense labels. */
  label_printer_name: string
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  auto_print_receipt: true,
  auto_print_kitchen: true,
  auto_print_delivery: false,
  auto_print_dispense_label: true,
  prompt_before_print: false,
  drawer_kick_on_cash: false,
  receipt_printer_name: "",
  kitchen_printer_name: "",
  label_printer_name: "",
}

const KEY_ORDER = Object.keys(DEFAULT_PRINT_SETTINGS) as Array<keyof PrintSettings>

/** Read every `printing.*` row and merge onto the defaults. */
export async function getPrintSettings(): Promise<PrintSettings> {
  const rows = await query<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key LIKE 'printing.%'`,
  )
  const map = new Map(rows.map((r) => [r.key.replace(/^printing\./, ""), r.value]))
  const out: PrintSettings = { ...DEFAULT_PRINT_SETTINGS }
  for (const k of KEY_ORDER) {
    const v = map.get(k)
    if (v === undefined) continue
    const defaultValue = DEFAULT_PRINT_SETTINGS[k]
    if (typeof defaultValue === "boolean") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (out as any)[k] = v === "1" || v === "true"
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (out as any)[k] = v
    }
  }
  return out
}

/** Save a single print-setting key. */
export async function setPrintSetting<K extends keyof PrintSettings>(
  key: K,
  value: PrintSettings[K],
): Promise<void> {
  const stored = typeof value === "boolean" ? (value ? "1" : "0") : String(value)
  await execute(
    `INSERT INTO settings (key, value, category) VALUES (?1, ?2, 'printing')
     ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = datetime('now')`,
    [`printing.${key}`, stored],
  )
}

/** Save the full settings object at once (for the form save button). */
export async function savePrintSettings(next: PrintSettings): Promise<void> {
  for (const k of KEY_ORDER) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await setPrintSetting(k, (next as any)[k])
  }
}
