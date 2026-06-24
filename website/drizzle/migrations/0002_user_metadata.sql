-- Adds a metadata JSONB column to user for ancillary profile fields
-- (KRA PIN, county, town, physical address, business type, team size,
-- WhatsApp number, newsletter preference). First-class fields like
-- phone and business name remain in their own columns.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;
