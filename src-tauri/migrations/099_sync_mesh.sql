-- ============================================================================
-- 099_sync_mesh.sql
-- Offline multi-branch synchronization and Omnix Private Mesh metadata.
--
-- SECURITY: this schema stores public keys, key identifiers, digests, and
-- opaque OS-keystore references only. WireGuard/signing private keys,
-- preshared keys, and plaintext enrollment secrets must never enter SQLite.
-- ============================================================================

-- Persisted installation identities and their signing-key authorization state.
CREATE TABLE sync_nodes (
    id TEXT PRIMARY KEY CHECK (length(id) = 36 AND lower(id) = id),
    branch_id TEXT NOT NULL REFERENCES branches(id),
    display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 128),
    role TEXT NOT NULL CHECK (role IN ('hq', 'branch', 'workstation', 'android')),
    signing_key_id TEXT NOT NULL UNIQUE CHECK (length(signing_key_id) BETWEEN 1 AND 128),
    signing_public_key TEXT NOT NULL CHECK (length(signing_public_key) BETWEEN 32 AND 4096),
    signing_algorithm TEXT NOT NULL CHECK (signing_algorithm IN ('ed25519', 'rsa-pss-sha256')),
    key_status TEXT NOT NULL DEFAULT 'active' CHECK (key_status IN ('active', 'rotation_pending', 'retired', 'revoked')),
    created_at TEXT NOT NULL,
    last_seen_at TEXT,
    revoked_at TEXT,
    deleted_at TEXT,
    CHECK ((key_status = 'revoked') = (revoked_at IS NOT NULL))
);
CREATE INDEX idx_sync_nodes_branch_active
    ON sync_nodes(branch_id, key_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_sync_nodes_revocation
    ON sync_nodes(signing_key_id, revoked_at) WHERE revoked_at IS NOT NULL;

-- Exactly one current HQ/branch fence per branch. Epochs only move forward.
CREATE TABLE sync_epochs (
    branch_id TEXT PRIMARY KEY REFERENCES branches(id),
    hq_epoch INTEGER NOT NULL CHECK (hq_epoch >= 1),
    branch_epoch INTEGER NOT NULL CHECK (branch_epoch >= 1),
    changed_by_node_id TEXT NOT NULL REFERENCES sync_nodes(id),
    control_event_id TEXT UNIQUE CHECK (control_event_id IS NULL OR (length(control_event_id) = 36 AND lower(control_event_id) = control_event_id)),
    changed_at TEXT NOT NULL,
    reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 512)
);
CREATE INDEX idx_sync_epochs_fence ON sync_epochs(branch_id, hq_epoch, branch_epoch);

-- A source allocates sequence numbers inside one branch/fence. next_sequence is
-- updated in the same transaction as the business mutation and outbox insert.
CREATE TABLE sync_sequences (
    source_node_id TEXT NOT NULL REFERENCES sync_nodes(id),
    branch_id TEXT NOT NULL REFERENCES branches(id),
    hq_epoch INTEGER NOT NULL CHECK (hq_epoch >= 1),
    branch_epoch INTEGER NOT NULL CHECK (branch_epoch >= 1),
    next_sequence INTEGER NOT NULL DEFAULT 1 CHECK (next_sequence >= 1),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (source_node_id, branch_id, hq_epoch, branch_epoch)
) WITHOUT ROWID;

CREATE TABLE sync_outbox (
    event_id TEXT PRIMARY KEY CHECK (length(event_id) = 36 AND lower(event_id) = event_id),
    source_node_id TEXT NOT NULL REFERENCES sync_nodes(id),
    destination_node_id TEXT REFERENCES sync_nodes(id),
    branch_id TEXT NOT NULL REFERENCES branches(id),
    hq_epoch INTEGER NOT NULL CHECK (hq_epoch >= 1),
    branch_epoch INTEGER NOT NULL CHECK (branch_epoch >= 1),
    source_sequence INTEGER NOT NULL CHECK (source_sequence >= 1),
    protocol_version INTEGER NOT NULL CHECK (protocol_version >= 1),
    entity_type TEXT NOT NULL CHECK (length(entity_type) BETWEEN 1 AND 128),
    entity_id TEXT NOT NULL CHECK (length(entity_id) BETWEEN 1 AND 128),
    operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete', 'command')),
    payload_media_type TEXT NOT NULL CHECK (length(payload_media_type) BETWEEN 1 AND 128),
    payload_schema_version INTEGER NOT NULL CHECK (payload_schema_version >= 1),
    payload BLOB NOT NULL CHECK (length(payload) <= 16777216),
    payload_sha256 BLOB NOT NULL CHECK (length(payload_sha256) = 32),
    signing_key_id TEXT NOT NULL REFERENCES sync_nodes(signing_key_id),
    signature_algorithm TEXT NOT NULL CHECK (signature_algorithm IN ('ed25519', 'rsa-pss-sha256')),
    signature BLOB NOT NULL CHECK (length(signature) BETWEEN 64 AND 512),
    state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'leased', 'awaiting_receipt', 'delivered', 'dead_lettered')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 65535),
    not_before TEXT NOT NULL,
    emitted_at TEXT NOT NULL,
    expires_at TEXT,
    sent_at TEXT,
    receipt_deadline TEXT,
    delivered_at TEXT,
    remote_contiguous_sequence INTEGER CHECK (remote_contiguous_sequence IS NULL OR remote_contiguous_sequence >= 0),
    last_error_class TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (source_node_id, branch_id, hq_epoch, branch_epoch, source_sequence),
    CHECK (expires_at IS NULL OR expires_at > emitted_at),
    CHECK ((state = 'delivered') = (delivered_at IS NOT NULL))
);
CREATE INDEX idx_sync_outbox_dispatch
    ON sync_outbox(state, not_before, branch_id, source_sequence)
    WHERE state IN ('pending', 'leased', 'awaiting_receipt');
CREATE INDEX idx_sync_outbox_destination
    ON sync_outbox(destination_node_id, state, branch_id, source_sequence);
CREATE INDEX idx_sync_outbox_entity ON sync_outbox(entity_type, entity_id, emitted_at);

-- Lease generations fence stale dispatcher workers. One row survives retries so
-- generation can only increase for an outbox event.
CREATE TABLE sync_outbox_leases (
    outbox_event_id TEXT PRIMARY KEY REFERENCES sync_outbox(event_id) ON DELETE CASCADE,
    lease_owner_node_id TEXT NOT NULL REFERENCES sync_nodes(id),
    generation INTEGER NOT NULL CHECK (generation >= 1),
    acquired_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    released_at TEXT,
    CHECK (expires_at > acquired_at),
    CHECK (released_at IS NULL OR released_at >= acquired_at)
);
CREATE INDEX idx_sync_outbox_leases_expiry
    ON sync_outbox_leases(expires_at, lease_owner_node_id) WHERE released_at IS NULL;

-- Inbox rows are immutable identity records after completion/dead-letter.
CREATE TABLE sync_inbox (
    event_id TEXT PRIMARY KEY CHECK (length(event_id) = 36 AND lower(event_id) = event_id),
    source_node_id TEXT NOT NULL REFERENCES sync_nodes(id),
    receiver_node_id TEXT NOT NULL REFERENCES sync_nodes(id),
    branch_id TEXT NOT NULL REFERENCES branches(id),
    hq_epoch INTEGER NOT NULL CHECK (hq_epoch >= 1),
    branch_epoch INTEGER NOT NULL CHECK (branch_epoch >= 1),
    source_sequence INTEGER NOT NULL CHECK (source_sequence >= 1),
    payload_sha256 BLOB NOT NULL CHECK (length(payload_sha256) = 32),
    state TEXT NOT NULL CHECK (state IN ('received', 'validated', 'applied', 'receipt_ready', 'completed', 'dead_lettered')),
    received_at TEXT NOT NULL,
    validated_at TEXT,
    applied_at TEXT,
    completed_at TEXT,
    application_result TEXT,
    UNIQUE (source_node_id, branch_id, hq_epoch, branch_epoch, source_sequence),
    CHECK (validated_at IS NULL OR validated_at >= received_at),
    CHECK (applied_at IS NULL OR (validated_at IS NOT NULL AND applied_at >= validated_at)),
    CHECK (completed_at IS NULL OR (applied_at IS NOT NULL AND completed_at >= applied_at))
);
CREATE INDEX idx_sync_inbox_apply ON sync_inbox(state, received_at) WHERE state IN ('received', 'validated');
CREATE INDEX idx_sync_inbox_source_sequence
    ON sync_inbox(source_node_id, branch_id, hq_epoch, branch_epoch, source_sequence);

CREATE TABLE sync_receipts (
    event_id TEXT PRIMARY KEY REFERENCES sync_inbox(event_id) ON DELETE RESTRICT,
    receiver_node_id TEXT NOT NULL REFERENCES sync_nodes(id),
    hq_epoch INTEGER NOT NULL CHECK (hq_epoch >= 1),
    branch_epoch INTEGER NOT NULL CHECK (branch_epoch >= 1),
    source_sequence INTEGER NOT NULL CHECK (source_sequence >= 1),
    contiguous_sequence INTEGER NOT NULL CHECK (contiguous_sequence >= 0),
    outcome TEXT NOT NULL CHECK (outcome IN ('applied', 'duplicate', 'rejected')),
    conflict_class TEXT,
    receipt_sha256 BLOB NOT NULL CHECK (length(receipt_sha256) = 32),
    recorded_at TEXT NOT NULL,
    CHECK ((outcome = 'rejected') = (conflict_class IS NOT NULL))
);
CREATE INDEX idx_sync_receipts_receiver_sequence
    ON sync_receipts(receiver_node_id, hq_epoch, branch_epoch, contiguous_sequence);

CREATE TABLE sync_cursors (
    receiver_node_id TEXT NOT NULL REFERENCES sync_nodes(id),
    source_node_id TEXT NOT NULL REFERENCES sync_nodes(id),
    branch_id TEXT NOT NULL REFERENCES branches(id),
    hq_epoch INTEGER NOT NULL CHECK (hq_epoch >= 1),
    branch_epoch INTEGER NOT NULL CHECK (branch_epoch >= 1),
    contiguous_sequence INTEGER NOT NULL DEFAULT 0 CHECK (contiguous_sequence >= 0),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (receiver_node_id, source_node_id, branch_id, hq_epoch, branch_epoch)
) WITHOUT ROWID;
CREATE INDEX idx_sync_cursors_lookup
    ON sync_cursors(source_node_id, branch_id, hq_epoch, branch_epoch, contiguous_sequence);

-- These are observed out-of-order sequences, not missing sequence numbers.
CREATE TABLE sync_cursor_gaps (
    receiver_node_id TEXT NOT NULL,
    source_node_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    hq_epoch INTEGER NOT NULL,
    branch_epoch INTEGER NOT NULL,
    observed_sequence INTEGER NOT NULL CHECK (observed_sequence >= 1),
    observed_at TEXT NOT NULL,
    PRIMARY KEY (receiver_node_id, source_node_id, branch_id, hq_epoch, branch_epoch, observed_sequence),
    FOREIGN KEY (receiver_node_id, source_node_id, branch_id, hq_epoch, branch_epoch)
        REFERENCES sync_cursors(receiver_node_id, source_node_id, branch_id, hq_epoch, branch_epoch)
        ON DELETE CASCADE
) WITHOUT ROWID;
CREATE INDEX idx_sync_cursor_gaps_next
    ON sync_cursor_gaps(receiver_node_id, source_node_id, branch_id, hq_epoch, branch_epoch, observed_sequence);

CREATE TABLE sync_conflicts (
    id TEXT PRIMARY KEY CHECK (length(id) = 36 AND lower(id) = id),
    event_id TEXT NOT NULL REFERENCES sync_inbox(event_id),
    class TEXT NOT NULL CHECK (class IN ('concurrent_update', 'entity_deleted', 'unique_constraint', 'referential_integrity', 'fiscal_period_closed', 'compliance_immutable', 'epoch_fenced', 'schema_mismatch', 'receipt_mismatch')),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    local_digest BLOB CHECK (local_digest IS NULL OR length(local_digest) = 32),
    remote_digest BLOB CHECK (remote_digest IS NULL OR length(remote_digest) = 32),
    detail TEXT NOT NULL CHECK (length(detail) <= 4096),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'rejected')),
    created_at TEXT NOT NULL,
    resolved_at TEXT,
    resolved_by_user_id TEXT REFERENCES users(id),
    resolution TEXT,
    CHECK ((status = 'open') = (resolved_at IS NULL))
);
CREATE INDEX idx_sync_conflicts_unresolved
    ON sync_conflicts(created_at, class) WHERE status = 'open';
CREATE INDEX idx_sync_conflicts_entity ON sync_conflicts(entity_type, entity_id, created_at);

CREATE TABLE sync_dead_letters (
    id TEXT PRIMARY KEY CHECK (length(id) = 36 AND lower(id) = id),
    direction TEXT NOT NULL CHECK (direction IN ('outbox', 'inbox')),
    event_id TEXT NOT NULL,
    class TEXT NOT NULL,
    retryable INTEGER NOT NULL CHECK (retryable IN (0, 1)),
    attempts INTEGER NOT NULL CHECK (attempts >= 0),
    payload_sha256 BLOB CHECK (payload_sha256 IS NULL OR length(payload_sha256) = 32),
    diagnostic TEXT NOT NULL CHECK (length(diagnostic) <= 4096),
    failed_at TEXT NOT NULL,
    reviewed_at TEXT,
    reviewed_by_user_id TEXT REFERENCES users(id),
    disposition TEXT CHECK (disposition IN ('retry', 'discard', 'resolved')),
    UNIQUE (direction, event_id)
);
CREATE INDEX idx_sync_dead_letters_review
    ON sync_dead_letters(failed_at, retryable) WHERE reviewed_at IS NULL;

CREATE TABLE sync_snapshots (
    id TEXT PRIMARY KEY CHECK (length(id) = 36 AND lower(id) = id),
    branch_id TEXT NOT NULL REFERENCES branches(id),
    created_by_node_id TEXT NOT NULL REFERENCES sync_nodes(id),
    hq_epoch INTEGER NOT NULL CHECK (hq_epoch >= 1),
    branch_epoch INTEGER NOT NULL CHECK (branch_epoch >= 1),
    schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
    byte_length INTEGER NOT NULL CHECK (byte_length >= 1),
    chunk_count INTEGER NOT NULL CHECK (chunk_count >= 1),
    sha256 BLOB NOT NULL CHECK (length(sha256) = 32),
    signature_key_id TEXT NOT NULL REFERENCES sync_nodes(signing_key_id),
    signature BLOB NOT NULL CHECK (length(signature) BETWEEN 64 AND 512),
    storage_ref TEXT NOT NULL CHECK (length(storage_ref) BETWEEN 1 AND 1024),
    state TEXT NOT NULL CHECK (state IN ('creating', 'ready', 'superseded', 'invalid')),
    created_at TEXT NOT NULL,
    verified_at TEXT
);
CREATE INDEX idx_sync_snapshots_restore
    ON sync_snapshots(branch_id, hq_epoch, branch_epoch, created_at DESC) WHERE state = 'ready';

CREATE TABLE sync_snapshot_cursors (
    snapshot_id TEXT NOT NULL REFERENCES sync_snapshots(id) ON DELETE CASCADE,
    source_node_id TEXT NOT NULL REFERENCES sync_nodes(id),
    contiguous_sequence INTEGER NOT NULL CHECK (contiguous_sequence >= 0),
    PRIMARY KEY (snapshot_id, source_node_id)
) WITHOUT ROWID;

CREATE TABLE sync_recoveries (
    id TEXT PRIMARY KEY CHECK (length(id) = 36 AND lower(id) = id),
    snapshot_id TEXT NOT NULL REFERENCES sync_snapshots(id),
    requested_by_node_id TEXT NOT NULL REFERENCES sync_nodes(id),
    target_branch_id TEXT NOT NULL REFERENCES branches(id),
    target_hq_epoch INTEGER NOT NULL CHECK (target_hq_epoch >= 1),
    target_branch_epoch INTEGER NOT NULL CHECK (target_branch_epoch >= 1),
    mode TEXT NOT NULL CHECK (mode IN ('replace_from_snapshot', 'verify_only')),
    state TEXT NOT NULL CHECK (state IN ('requested', 'snapshot_verified', 'snapshot_restored', 'replaying', 'complete', 'aborted')),
    pre_restore_backup_ref TEXT,
    requested_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    failure_detail TEXT,
    CHECK ((state = 'complete') = (completed_at IS NOT NULL))
);
CREATE INDEX idx_sync_recoveries_active
    ON sync_recoveries(target_branch_id, requested_at) WHERE state NOT IN ('complete', 'aborted');

-- Private Mesh control-plane metadata. No secret-key material is represented.
CREATE TABLE mesh_sites (
    id TEXT PRIMARY KEY CHECK (length(id) = 36 AND lower(id) = id),
    branch_id TEXT NOT NULL UNIQUE REFERENCES branches(id),
    site_number INTEGER NOT NULL UNIQUE CHECK (site_number BETWEEN 0 AND 254),
    role TEXT NOT NULL CHECK (role IN ('hq', 'branch')),
    ipv4_pool TEXT NOT NULL CHECK (length(ipv4_pool) BETWEEN 9 AND 18),
    state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'suspended', 'retired')),
    created_at TEXT NOT NULL,
    deleted_at TEXT,
    CHECK ((role = 'hq') = (site_number = 0))
);
CREATE INDEX idx_mesh_sites_active ON mesh_sites(state, site_number) WHERE deleted_at IS NULL;

CREATE TABLE mesh_allocations (
    id TEXT PRIMARY KEY CHECK (length(id) = 36 AND lower(id) = id),
    site_id TEXT NOT NULL REFERENCES mesh_sites(id),
    node_id TEXT NOT NULL UNIQUE REFERENCES sync_nodes(id),
    ipv4_address TEXT NOT NULL UNIQUE,
    prefix_length INTEGER NOT NULL DEFAULT 32 CHECK (prefix_length BETWEEN 0 AND 32),
    host_number INTEGER NOT NULL CHECK (host_number BETWEEN 1 AND 254),
    state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('reserved', 'active', 'released')),
    allocated_at TEXT NOT NULL,
    released_at TEXT,
    UNIQUE (site_id, host_number),
    CHECK ((state = 'released') = (released_at IS NOT NULL))
);
CREATE INDEX idx_mesh_allocations_site_state ON mesh_allocations(site_id, state, host_number);

CREATE TABLE mesh_endpoint_observations (
    id TEXT PRIMARY KEY CHECK (length(id) = 36 AND lower(id) = id),
    node_id TEXT NOT NULL REFERENCES sync_nodes(id),
    endpoint_host TEXT NOT NULL CHECK (length(endpoint_host) BETWEEN 1 AND 253),
    endpoint_port INTEGER NOT NULL CHECK (endpoint_port BETWEEN 1 AND 65535),
    endpoint_class TEXT NOT NULL CHECK (endpoint_class IN ('direct_lan', 'direct_public', 'nat_traversal', 'relay_required', 'unreachable')),
    nat_class TEXT NOT NULL CHECK (nat_class IN ('open_internet', 'full_cone', 'address_restricted', 'port_restricted', 'symmetric', 'carrier_grade', 'unknown')),
    observed_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
    CHECK (expires_at > observed_at)
);
CREATE INDEX idx_mesh_endpoints_current
    ON mesh_endpoint_observations(node_id, expires_at DESC, verified);

-- enrollment_secret_hash is a one-way digest; plaintext enrollment material is
-- forbidden. request_nonce is public anti-replay metadata.
CREATE TABLE mesh_enrollments (
    id TEXT PRIMARY KEY CHECK (length(id) = 36 AND lower(id) = id),
    node_id TEXT NOT NULL REFERENCES sync_nodes(id),
    requested_site_id TEXT NOT NULL REFERENCES mesh_sites(id),
    requested_allocation_id TEXT REFERENCES mesh_allocations(id),
    wireguard_key_id TEXT NOT NULL UNIQUE CHECK (length(wireguard_key_id) BETWEEN 1 AND 128),
    wireguard_public_key TEXT NOT NULL UNIQUE CHECK (length(wireguard_public_key) = 44),
    signing_key_id TEXT NOT NULL REFERENCES sync_nodes(signing_key_id),
    request_nonce TEXT NOT NULL UNIQUE CHECK (length(request_nonce) BETWEEN 32 AND 256),
    enrollment_secret_hash BLOB NOT NULL CHECK (length(enrollment_secret_hash) >= 32),
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'consumed', 'revoked')),
    requested_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    approved_at TEXT,
    approved_by_user_id TEXT REFERENCES users(id),
    consumed_at TEXT,
    CHECK (expires_at > requested_at),
    CHECK (status NOT IN ('approved', 'consumed') OR approved_at IS NOT NULL),
    CHECK (consumed_at IS NULL OR (approved_at IS NOT NULL AND consumed_at >= approved_at))
);
CREATE INDEX idx_mesh_enrollments_pending
    ON mesh_enrollments(status, expires_at, requested_site_id) WHERE status = 'pending';

-- key_custody_ref is an opaque locator into DPAPI/Android Keystore. This table
-- contains public keys only and deliberately has no private/preshared-key field.
CREATE TABLE mesh_peer_keys (
    key_id TEXT PRIMARY KEY CHECK (length(key_id) BETWEEN 1 AND 128),
    node_id TEXT NOT NULL REFERENCES sync_nodes(id),
    public_key TEXT NOT NULL UNIQUE CHECK (length(public_key) = 44),
    key_custody TEXT NOT NULL CHECK (key_custody IN ('windows_dpapi_machine', 'android_keystore')),
    key_custody_ref TEXT NOT NULL UNIQUE CHECK (length(key_custody_ref) BETWEEN 1 AND 512),
    status TEXT NOT NULL CHECK (status IN ('current', 'next', 'retired', 'revoked')),
    activated_at TEXT,
    rotate_at TEXT,
    retired_at TEXT,
    created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_mesh_peer_keys_one_current
    ON mesh_peer_keys(node_id) WHERE status = 'current';
CREATE UNIQUE INDEX idx_mesh_peer_keys_one_next
    ON mesh_peer_keys(node_id) WHERE status = 'next';
CREATE INDEX idx_mesh_peer_keys_status ON mesh_peer_keys(node_id, status, rotate_at);

CREATE TABLE mesh_key_rotations (
    id TEXT PRIMARY KEY CHECK (length(id) = 36 AND lower(id) = id),
    node_id TEXT NOT NULL REFERENCES sync_nodes(id),
    current_key_id TEXT NOT NULL REFERENCES mesh_peer_keys(key_id),
    next_key_id TEXT NOT NULL REFERENCES mesh_peer_keys(key_id),
    status TEXT NOT NULL CHECK (status IN ('pending', 'overlap', 'completed', 'expired', 'cancelled')),
    requested_at TEXT NOT NULL,
    overlap_started_at TEXT,
    deadline TEXT NOT NULL,
    completed_at TEXT,
    CHECK (current_key_id <> next_key_id),
    CHECK (deadline > requested_at)
);
CREATE UNIQUE INDEX idx_mesh_rotations_active
    ON mesh_key_rotations(node_id) WHERE status IN ('pending', 'overlap');
CREATE INDEX idx_mesh_rotations_deadline ON mesh_key_rotations(status, deadline);

CREATE TABLE mesh_revocations (
    id TEXT PRIMARY KEY CHECK (length(id) = 36 AND lower(id) = id),
    node_id TEXT NOT NULL REFERENCES sync_nodes(id),
    key_id TEXT NOT NULL REFERENCES mesh_peer_keys(key_id),
    reason TEXT NOT NULL CHECK (reason IN ('device_lost', 'device_replaced', 'compromised', 'authorization_removed', 'administrative')),
    revoked_by_user_id TEXT REFERENCES users(id),
    control_event_id TEXT NOT NULL UNIQUE CHECK (length(control_event_id) = 36 AND lower(control_event_id) = control_event_id),
    revoked_at TEXT NOT NULL,
    UNIQUE (node_id, key_id)
);
CREATE INDEX idx_mesh_revocations_check ON mesh_revocations(key_id, revoked_at);

CREATE TABLE mesh_control_acknowledgements (
    control_event_id TEXT NOT NULL,
    node_id TEXT NOT NULL REFERENCES sync_nodes(id),
    hq_epoch INTEGER NOT NULL CHECK (hq_epoch >= 1),
    branch_epoch INTEGER NOT NULL CHECK (branch_epoch >= 1),
    acknowledged_at TEXT NOT NULL,
    PRIMARY KEY (control_event_id, node_id)
) WITHOUT ROWID;
CREATE INDEX idx_mesh_control_ack_node
    ON mesh_control_acknowledgements(node_id, hq_epoch, branch_epoch, acknowledged_at);
