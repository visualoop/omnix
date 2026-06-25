-- Multi-licence per machine — additive migration.
-- Lets a single physical PC hold multiple active licences (Dawa + Retail,
-- etc.) by switching the source of truth from `machines.license_id` to
-- the `activations` join table. Old single-licence rows keep working;
-- `machines.license_id` becomes a hint pointing at the "primary" /
-- first-activated licence.

-- 1. licenses.origin — track where each licence came from. Lets us
--    distinguish Paystack purchases from Payload-era keys we recreate
--    server-side via the sync endpoint.
ALTER TABLE "licenses" ADD COLUMN IF NOT EXISTS "origin" text DEFAULT 'paystack' NOT NULL;
--> statement-breakpoint

-- 2. activations gets a unique constraint on (license_id, machine_id)
--    so re-activating the same key on the same PC is idempotent. The
--    column already exists; we just lock the pair.
CREATE UNIQUE INDEX IF NOT EXISTS "activations_license_machine_uidx"
  ON "activations" ("license_id", "machine_id")
  WHERE "machine_id" IS NOT NULL;
--> statement-breakpoint

-- 3. license_sync_log — every desktop-initiated /api/licensing/sync POST
--    leaves a row per key. The desktop sees verified | foreign |
--    orphan_payload | seat_taken | recreated. Admin can replay any flow.
CREATE TABLE IF NOT EXISTS "license_sync_log" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "machine_id" text,
  "license_key" text NOT NULL,
  "status" text NOT NULL,
  "message" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "license_sync_log_user_idx" ON "license_sync_log" ("user_id");
--> statement-breakpoint
