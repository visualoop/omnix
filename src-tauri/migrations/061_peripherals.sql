-- ============================================================================
-- 061_peripherals.sql — Explicit device registry for cash drawer, weight scale,
-- kitchen printer, card reader, and any future USB/serial peripheral.
-- Complements the receipt-printer + barcode scanner + customer-display flows
-- that were previously ad-hoc.
-- ============================================================================

CREATE TABLE IF NOT EXISTS peripherals (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,            -- 'cash_drawer' | 'weight_scale' | 'kitchen_printer' | 'card_reader'
  name TEXT NOT NULL,            -- e.g. "Cash drawer at till 1"
  driver TEXT NOT NULL,          -- 'usb' | 'serial' | 'network' | 'printer_kick' (piggyback on receipt printer)
  connection_string TEXT,        -- "COM3" / "USB:0483:5741" / "192.168.1.50:9100"
  station_id TEXT,               -- kitchen_stations.id when kind='kitchen_printer'
  station_scope TEXT,            -- 'shared' | 'till'  where till = current till only
  enabled INTEGER NOT NULL DEFAULT 1,
  last_test_at TEXT,
  last_test_ok INTEGER,
  metadata TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_peripherals_kind ON peripherals(kind, enabled);
CREATE INDEX IF NOT EXISTS idx_peripherals_station ON peripherals(station_id) WHERE kind = 'kitchen_printer';
