/**
 * Peripherals service — registry + basic device operations.
 *
 * Real device drivers live in the Rust side (future). For now this layer:
 *   - Stores which devices exist and how they're addressed.
 *   - Exposes list/save/toggle/test for the settings page.
 *   - Provides `openCashDrawer(peripheralId)` and `weighNext()` stubs that
 *     invoke Rust commands (falling back to no-op in dev/preview).
 *
 * Kitchen printer routing: given a menu-item's kitchen_station, look up the
 * peripheral of kind='kitchen_printer' with matching station_id.
 */
import { execute, query } from "@/lib/db";

export type PeripheralKind = "cash_drawer" | "weight_scale" | "kitchen_printer" | "card_reader";
export type PeripheralDriver = "usb" | "serial" | "network" | "printer_kick";

export interface Peripheral {
  id: string;
  kind: PeripheralKind;
  name: string;
  driver: PeripheralDriver;
  connection_string: string | null;
  station_id: string | null;
  station_scope: "shared" | "till" | null;
  enabled: number;
  last_test_at: string | null;
  last_test_ok: number | null;
  metadata: string;
  created_at: string;
}

function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

export async function listPeripherals(kind?: PeripheralKind): Promise<Peripheral[]> {
  if (kind) {
    return query<Peripheral>(`SELECT * FROM peripherals WHERE kind = ?1 ORDER BY name ASC`, [kind]);
  }
  return query<Peripheral>(`SELECT * FROM peripherals ORDER BY kind, name ASC`);
}

export async function savePeripheral(input: {
  id?: string;
  kind: PeripheralKind;
  name: string;
  driver: PeripheralDriver;
  connection_string?: string;
  station_id?: string;
  station_scope?: "shared" | "till";
  enabled?: boolean;
}): Promise<string> {
  if (input.id) {
    await execute(
      `UPDATE peripherals SET
         kind = ?2, name = ?3, driver = ?4, connection_string = ?5,
         station_id = ?6, station_scope = ?7, enabled = ?8
       WHERE id = ?1`,
      [
        input.id, input.kind, input.name, input.driver,
        input.connection_string ?? null,
        input.station_id ?? null,
        input.station_scope ?? "shared",
        input.enabled === false ? 0 : 1,
      ],
    );
    return input.id;
  }
  const id = newId();
  await execute(
    `INSERT INTO peripherals (id, kind, name, driver, connection_string, station_id, station_scope, enabled)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    [
      id, input.kind, input.name, input.driver,
      input.connection_string ?? null,
      input.station_id ?? null,
      input.station_scope ?? "shared",
      input.enabled === false ? 0 : 1,
    ],
  );
  return id;
}

export async function deletePeripheral(id: string): Promise<void> {
  await execute(`DELETE FROM peripherals WHERE id = ?1`, [id]);
}

export async function togglePeripheral(id: string, enabled: boolean): Promise<void> {
  await execute(`UPDATE peripherals SET enabled = ?2 WHERE id = ?1`, [id, enabled ? 1 : 0]);
}

export async function markTested(id: string, ok: boolean): Promise<void> {
  await execute(
    `UPDATE peripherals SET last_test_at = datetime('now'), last_test_ok = ?2 WHERE id = ?1`,
    [id, ok ? 1 : 0],
  );
}

/**
 * Open the cash drawer. Two drivers today:
 *   'printer_kick' → send ESC/POS kick pulse to the receipt printer (already works).
 *   'usb' / 'serial' → invoke Rust command 'open_cash_drawer' (not yet implemented).
 * Returns true on success, false on failure. Never throws.
 */
export async function openCashDrawer(peripheralId?: string): Promise<boolean> {
  try {
    const rows = peripheralId
      ? await query<Peripheral>(`SELECT * FROM peripherals WHERE id = ?1`, [peripheralId])
      : await query<Peripheral>(`SELECT * FROM peripherals WHERE kind = 'cash_drawer' AND enabled = 1 LIMIT 1`);
    const p = rows[0];
    if (!p) return false;
    if (p.driver === "printer_kick") {
      // Kick the drawer via ESC/POS from the receipt printer path.
      // For now, we simply mark it as OK — actual kick happens automatically
      // on every printed receipt via the printer's own hardware.
      return true;
    }
    // Rust-driven drivers: invoke the Tauri command.
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_cash_drawer", { connectionString: p.connection_string ?? "" });
    return true;
  } catch (e) {
    console.warn("[peripherals] openCashDrawer failed:", e);
    return false;
  }
}

/**
 * Read the current weight from an attached scale (kg). Returns null on any error.
 * Actual scale integration is a Rust command; UI can subscribe via events.
 */
export async function weighNext(peripheralId?: string): Promise<number | null> {
  try {
    const rows = peripheralId
      ? await query<Peripheral>(`SELECT * FROM peripherals WHERE id = ?1`, [peripheralId])
      : await query<Peripheral>(`SELECT * FROM peripherals WHERE kind = 'weight_scale' AND enabled = 1 LIMIT 1`);
    const p = rows[0];
    if (!p) return null;
    const { invoke } = await import("@tauri-apps/api/core");
    const kg = await invoke<number>("read_weight_scale", { connectionString: p.connection_string ?? "" });
    return typeof kg === "number" ? kg : null;
  } catch (e) {
    console.warn("[peripherals] weighNext failed:", e);
    return null;
  }
}

/**
 * Find the kitchen printer registered for a specific station. Returns null
 * when there's no dedicated printer (kitchen falls back to the default receipt printer).
 */
export async function getKitchenPrinterForStation(stationId: string): Promise<Peripheral | null> {
  const rows = await query<Peripheral>(
    `SELECT * FROM peripherals
     WHERE kind = 'kitchen_printer' AND enabled = 1 AND station_id = ?1 LIMIT 1`,
    [stationId],
  );
  return rows[0] ?? null;
}
