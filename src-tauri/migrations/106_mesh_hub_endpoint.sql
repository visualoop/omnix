-- ============================================================================
-- 106_mesh_hub_endpoint.sql
-- Public WireGuard endpoint advertised by the HQ node.
--
-- SECURITY: endpoint host/port and publication time are public routing metadata.
-- Private and preshared keys remain exclusively in OS-protected custody.
-- ============================================================================

ALTER TABLE sync_nodes ADD COLUMN mesh_endpoint_host TEXT
    CHECK (mesh_endpoint_host IS NULL OR length(mesh_endpoint_host) BETWEEN 1 AND 253);
ALTER TABLE sync_nodes ADD COLUMN mesh_endpoint_port INTEGER
    CHECK (mesh_endpoint_port IS NULL OR mesh_endpoint_port BETWEEN 1 AND 65535);
ALTER TABLE sync_nodes ADD COLUMN mesh_endpoint_published_at TEXT;

-- Populated only by a trusted, internet-side observation. It is nullable so a
-- configured endpoint never masquerades as proof of public reachability.
ALTER TABLE mesh_endpoint_observations ADD COLUMN observed_public_address TEXT
    CHECK (observed_public_address IS NULL OR length(observed_public_address) BETWEEN 7 AND 15);

CREATE INDEX idx_sync_nodes_mesh_endpoint
    ON sync_nodes(role, mesh_endpoint_host, mesh_endpoint_port)
    WHERE deleted_at IS NULL AND mesh_endpoint_host IS NOT NULL;
