-- ============================================================================
-- 074_audit_log_view.sql — unified audit feed
--
-- /audit currently merges 3 different tables (license_activations, sales-void
-- events, audit_log) in JavaScript with per-table hard LIMIT 100. That means:
--   1. The page can miss the newest activity because each source is capped.
--   2. Pagination is impossible — the merge happens client-side.
--
-- This view UNIONs the three sources into one shape so pageAuditLog (in
-- src/services/paged.ts) can paginate the merged feed with real LIMIT/OFFSET.
--
-- Source column tells the JS layer how to render the row (icon + colour).
-- description is pre-formatted so pagination doesn't force the JS layer to
-- know per-source rendering rules.
-- ============================================================================

DROP VIEW IF EXISTS audit_log_unified;

CREATE VIEW audit_log_unified AS
  SELECT
    'perm-' || id                                                     AS id,
    'permission'                                                      AS kind,
    outcome                                                           AS event,
    (CASE outcome WHEN 'denied' THEN 'Blocked' ELSE 'Allowed' END)
      || ': ' || permission_key
      || COALESCE(' on ' || entity_type
        || COALESCE(' ' || entity_id, ''), '')
      || ' (' || risk_level || ')'                                    AS description,
    user_name                                                         AS user,
    NULL                                                              AS metadata,
    created_at
  FROM audit_log

  UNION ALL

  SELECT
    'lic-' || id                                                      AS id,
    'license'                                                         AS kind,
    event,
    (CASE event
      WHEN 'activated'   THEN 'License activated: '        || license_kid
      WHEN 'verified'    THEN 'License verified: '         || license_kid
      WHEN 'deactivated' THEN 'License deactivated: '      || license_kid
      WHEN 'failed'      THEN 'License verification failed: ' || COALESCE(error_message, 'unknown')
      ELSE                    'License event: ' || event
    END)                                                              AS description,
    NULL                                                              AS user,
    machine_fingerprint                                               AS metadata,
    created_at
  FROM license_activations

  UNION ALL

  SELECT
    'sale-' || s.id                                                   AS id,
    (CASE WHEN s.status = 'voided' THEN 'void' ELSE 'sale' END)       AS kind,
    (CASE WHEN s.status = 'voided' THEN 'voided' ELSE 'completed' END) AS event,
    (CASE
      WHEN s.status = 'voided' THEN 'Sale #' || s.sale_number || ' voided (' || printf('%.2f', s.total) || ')'
      ELSE                          'Sale #' || s.sale_number || ' (' || printf('%.2f', s.total) || ')'
    END)                                                              AS description,
    u.full_name                                                       AS user,
    NULL                                                              AS metadata,
    s.created_at
  FROM sales s
  LEFT JOIN users u ON u.id = s.user_id
  WHERE s.status != 'held';
