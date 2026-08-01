# Legacy trusted-LAN SQL compatibility

`POST /api/db/query` and `POST /api/db/execute` are not part of the production command API. They remain temporarily for existing paired desktop tills whose older UI still sends domain SQL. They are disabled unless the master database setting `network.legacy_trusted_lan` is exactly `1`.

Migration 102 preserves already-paired shops by initializing the flag to `1` only when an unrevoked paired token already exists. Fresh masters default to `0`. An operator must explicitly enable **Legacy paired till compatibility** in Settings → Network before pairing an old desktop till. Disable it after all tills have upgraded to typed commands.

Even when enabled, the routes require all of the following: a private or loopback source address supplied by the socket listener; no browser `Origin` or Fetch Metadata headers; a non-revoked token matched by SHA-256 hash in the distinct `legacy_trusted_lan` scope; per-source request limiting; bounded request bodies; a five-second timeout; and metadata-only audit records. SQL text and bind values are never written to the audit log.

These controls contain compatibility risk; they do not make caller-supplied SQL safe. Android, browser, WAN, and mesh clients must use `/api/v1/commands/*` and `/api/v1/reads/*`. The raw routes can be deleted once the remaining generic desktop callers are migrated and all legacy tokens are revoked.
