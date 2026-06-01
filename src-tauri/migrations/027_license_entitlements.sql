-- License entitlements (v2): paid modules, seat count, and online-activation token.
-- Added as nullable columns so existing v1 activations keep working.

ALTER TABLE license ADD COLUMN modules_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE license ADD COLUMN max_devices INTEGER NOT NULL DEFAULT 1;
-- Server-issued, machine-bound activation token (online activation). NULL until activated online.
ALTER TABLE license ADD COLUMN activation_token TEXT;
-- 1 = activated online and server-validated; 0 = signed-key-only, awaiting server validation.
ALTER TABLE license ADD COLUMN server_validated INTEGER NOT NULL DEFAULT 0;
ALTER TABLE license ADD COLUMN last_server_check_at TEXT;
