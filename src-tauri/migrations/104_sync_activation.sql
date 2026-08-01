-- ============================================================================
-- 104_sync_activation.sql
-- Activates durable branch mutation capture and LAN transport routing.
--
-- Private signing, WireGuard and snapshot-encryption keys are intentionally
-- absent. Only public routing/custody metadata belongs in SQLite.
-- ============================================================================

-- One enabled route identifies the authoritative local branch hub and its HQ
-- destination. HQ-originated control traffic uses the same table in reverse.
CREATE TABLE sync_branch_routes (
    branch_id TEXT PRIMARY KEY REFERENCES branches(id),
    local_node_id TEXT NOT NULL REFERENCES sync_nodes(id),
    destination_node_id TEXT NOT NULL REFERENCES sync_nodes(id),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (local_node_id <> destination_node_id)
);
CREATE INDEX idx_sync_branch_routes_destination
    ON sync_branch_routes(destination_node_id, enabled, branch_id);

-- LAN HTTP is the first transport. The endpoint is public routing metadata;
-- the transport authenticates bounded envelopes and receipts cryptographically.
CREATE TABLE sync_peer_routes (
    destination_node_id TEXT PRIMARY KEY REFERENCES sync_nodes(id),
    transport_kind TEXT NOT NULL CHECK (transport_kind IN ('lan_http', 'private_mesh')),
    endpoint_url TEXT NOT NULL CHECK (length(endpoint_url) BETWEEN 8 AND 1024),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    updated_at TEXT NOT NULL
);
CREATE INDEX idx_sync_peer_routes_enabled
    ON sync_peer_routes(enabled, transport_kind, destination_node_id);

-- Every branch-owned SQLite mutation first lands here from a persistent trigger.
-- This row and its audit_log row share the business statement's transaction.
-- The dispatcher later materializes the current row, allocates a fenced source
-- sequence, signs it using an external key provider, and promotes it to
-- sync_outbox. Trigger installation is idempotent and performed at DB startup.
CREATE TABLE sync_domain_outbox (
    capture_id TEXT PRIMARY KEY CHECK (length(capture_id) = 36 AND lower(capture_id) = capture_id),
    branch_id TEXT NOT NULL REFERENCES branches(id),
    entity_type TEXT NOT NULL CHECK (length(entity_type) BETWEEN 1 AND 128),
    entity_id TEXT NOT NULL CHECK (length(entity_id) BETWEEN 1 AND 256),
    operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
    state TEXT NOT NULL DEFAULT 'pending'
        CHECK (state IN ('pending', 'leased', 'promoted', 'dead_lettered')),
    lease_owner TEXT,
    lease_generation INTEGER NOT NULL DEFAULT 0 CHECK (lease_generation >= 0),
    lease_expires_at TEXT,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 65535),
    promoted_event_id TEXT UNIQUE REFERENCES sync_outbox(event_id),
    last_error TEXT CHECK (last_error IS NULL OR length(last_error) <= 4096),
    captured_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (state <> 'promoted' OR promoted_event_id IS NOT NULL)
);
CREATE INDEX idx_sync_domain_outbox_dispatch
    ON sync_domain_outbox(state, captured_at, branch_id)
    WHERE state IN ('pending', 'leased');
CREATE INDEX idx_sync_domain_outbox_entity
    ON sync_domain_outbox(branch_id, entity_type, entity_id, captured_at);

-- Read model populated only by verified replication. Applying remote events to a
-- projection instead of branch operational tables prevents re-capture loops and
-- preserves the rule that each branch hub owns its SQLite database.
CREATE TABLE sync_entity_state (
    branch_id TEXT NOT NULL REFERENCES branches(id),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    source_node_id TEXT NOT NULL REFERENCES sync_nodes(id),
    hq_epoch INTEGER NOT NULL CHECK (hq_epoch >= 1),
    branch_epoch INTEGER NOT NULL CHECK (branch_epoch >= 1),
    source_sequence INTEGER NOT NULL CHECK (source_sequence >= 1),
    event_id TEXT NOT NULL UNIQUE REFERENCES sync_inbox(event_id),
    row_json TEXT CHECK (row_json IS NULL OR json_valid(row_json)),
    deleted INTEGER NOT NULL CHECK (deleted IN (0, 1)),
    applied_at TEXT NOT NULL,
    PRIMARY KEY (branch_id, entity_type, entity_id),
    CHECK ((deleted = 1) = (row_json IS NULL))
) WITHOUT ROWID;
CREATE INDEX idx_sync_entity_state_branch_type
    ON sync_entity_state(branch_id, entity_type, deleted, source_sequence);

-- Recovery puts only the affected replicated branch projection into read-only
-- mode; local operational writes remain owned by their branch hub.
CREATE TABLE sync_recovery_fences (
    branch_id TEXT PRIMARY KEY REFERENCES branches(id),
    recovery_id TEXT NOT NULL UNIQUE REFERENCES sync_recoveries(id),
    read_only INTEGER NOT NULL CHECK (read_only IN (0, 1)),
    fenced_at TEXT NOT NULL,
    released_at TEXT,
    CHECK ((read_only = 1) = (released_at IS NULL))
);

-- Explicitly assert that this migration did not introduce secret-key custody.
-- Future migrations must keep this invariant and use OS-protected providers.
CREATE VIEW sync_secret_free_schema AS
SELECT name, sql
FROM sqlite_schema
WHERE type = 'table'
  AND name LIKE 'sync_%'
  AND lower(sql) NOT LIKE '%private_key%'
  AND lower(sql) NOT LIKE '%preshared_key%';
