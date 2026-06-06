-- ============================================================================
-- 043_ai_assistant.sql — register the assistant_chat feature so the
-- in-app AI concierge has its own privacy tier + provider override.
-- ============================================================================

INSERT OR IGNORE INTO ai_features
  (feature_id, display_name, description, enabled, privacy_tier, task_kind)
VALUES
  ('assistant_chat',
   'In-app AI assistant',
   'Conversational concierge — answers any question about Omnix, Kenyan SME compliance, or how to do things in the app. Streams responses.',
   1,
   'low',
   'text');
