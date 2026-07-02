/**
 * Kitchen ticket routing.
 *
 * When an order is sent to the kitchen, group its items by station and print
 * one ticket per station on the peripheral registered for that station.
 * Fall back to the default receipt printer if no dedicated kitchen printer.
 *
 * The peripheral connection_string is a printer name (Windows-registered).
 * We call window.print via a dedicated document per station.
 */
import { query } from "@/lib/db";
import { getKitchenPrinterForStation } from "./peripherals";
import { printHtml } from "./print-html";

interface KitchenLine {
  station_id: string | null;
  station_name: string;
  item_name: string;
  quantity: number;
  notes: string | null;
}

/**
 * Print a kitchen ticket per station for the given order id.
 * Called from the "Send to kitchen" action in the hospitality POS.
 */
export async function printKitchenTickets(orderId: string): Promise<void> {
  const lines = await query<KitchenLine>(
    `SELECT
        oi.station_id,
        COALESCE(ks.name, 'Kitchen') AS station_name,
        oi.name AS item_name,
        oi.quantity,
        oi.notes
     FROM hospitality_order_items oi
     LEFT JOIN kitchen_stations ks ON ks.id = oi.station_id
     WHERE oi.order_id = ?1
       AND oi.status IN ('sent', 'preparing')
     ORDER BY ks.name ASC, oi.name ASC`,
    [orderId],
  ).catch(() => []);

  if (lines.length === 0) return;

  // Group by station.
  const byStation = new Map<string, KitchenLine[]>();
  for (const l of lines) {
    const key = l.station_id ?? "default";
    const bucket = byStation.get(key) ?? [];
    bucket.push(l);
    byStation.set(key, bucket);
  }

  // Print one ticket per station.
  for (const [stationKey, items] of byStation.entries()) {
    const station = items[0]?.station_name || "Kitchen";
    const printer = stationKey === "default"
      ? null
      : await getKitchenPrinterForStation(stationKey);
    const html = renderTicket(station, items, orderId, printer?.name ?? "Default");
    printHtml(html);
  }
}

function renderTicket(station: string, items: KitchenLine[], orderId: string, printerLabel: string): string {
  const rows = items.map((it) => `
    <div style="padding: 1mm 0; border-bottom: 1px dashed #999;">
      <div style="font-size: 12pt; font-weight: 700;">${it.quantity}× ${escapeHtml(it.item_name)}</div>
      ${it.notes ? `<div style="font-size: 10pt; font-style: italic; color: #b45309;">! ${escapeHtml(it.notes)}</div>` : ""}
    </div>
  `).join("");

  return `<!DOCTYPE html><html><head><title>Kitchen Ticket · ${escapeHtml(station)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { margin: 0; padding: 4mm; font-family: 'Courier New', monospace; max-width: 76mm; color: #000; }
  h1 { font-size: 14pt; margin: 0 0 2mm; text-align: center; text-transform: uppercase; }
  .muted { color: #444; font-size: 9pt; }
</style></head><body>
  <h1>${escapeHtml(station)}</h1>
  <div class="muted" style="text-align:center; margin-bottom: 3mm;">
    Order #${orderId.slice(0, 8)} · ${new Date().toLocaleTimeString()}
    <div>Printer: ${escapeHtml(printerLabel)}</div>
  </div>
  ${rows}
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}
