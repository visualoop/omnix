-- ============================================================================
-- 042_ai.sql — AI integration (multi-provider abstraction).
--
-- Five tables:
--   ai_providers — one row per provider (openrouter / openai / deepseek / groq /
--                  google / anthropic / custom). API keys stored encrypted (key
--                  derived from device-bound secret); never plaintext on disk.
--   ai_features  — per-feature toggle, privacy tier, optional model override.
--   ai_cache     — deterministic prompt-hash → response cache with TTL.
--   ai_calls     — full audit log: redacted prompt/response, tokens, cost, ms.
--   ai_settings  — master key/value (free-models-only flag, spend cap, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_providers (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  api_key_encrypted TEXT,
  base_url TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  preferred_text_model TEXT,
  preferred_vision_model TEXT,
  preferred_reasoning_model TEXT,
  daily_call_count INTEGER NOT NULL DEFAULT 0,
  daily_window_start TEXT,
  rate_limited_until TEXT,
  last_error TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_features (
  feature_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  privacy_tier TEXT NOT NULL DEFAULT 'low'
    CHECK (privacy_tier IN ('low','medium','high')),
  task_kind TEXT NOT NULL
    CHECK (task_kind IN ('text','vision','reasoning')),
  preferred_provider TEXT,
  preferred_model TEXT
);

CREATE TABLE IF NOT EXISTS ai_cache (
  cache_key TEXT PRIMARY KEY,
  feature_id TEXT NOT NULL,
  model TEXT NOT NULL,
  response_json TEXT NOT NULL,
  tokens_in INTEGER,
  tokens_out INTEGER,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_cache_feature ON ai_cache(feature_id);

CREATE TABLE IF NOT EXISTS ai_calls (
  id TEXT PRIMARY KEY,
  feature_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  model TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  prompt_redacted TEXT NOT NULL,
  response_redacted TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost_usd REAL,
  cache_hit INTEGER NOT NULL DEFAULT 0,
  privacy_tier TEXT NOT NULL,
  latency_ms INTEGER,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_calls_created ON ai_calls(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_calls_feature ON ai_calls(feature_id);
CREATE INDEX IF NOT EXISTS idx_ai_calls_status ON ai_calls(status);

CREATE TABLE IF NOT EXISTS ai_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Seed default providers (all disabled until user pastes a key) ──────────

INSERT OR IGNORE INTO ai_providers
  (id, display_name, enabled, base_url, priority, preferred_text_model, preferred_vision_model, preferred_reasoning_model, notes)
VALUES
  ('groq', 'Groq', 0, 'https://api.groq.com/openai/v1', 10,
   'llama-3.3-70b-versatile', 'llama-3.2-90b-vision-preview', 'qwen-qwq-32b',
   'Generous free tier with very fast inference. Sign up at console.groq.com.'),
  ('openrouter', 'OpenRouter', 0, 'https://openrouter.ai/api/v1', 20,
   'openai/gpt-oss-20b:free', 'meta-llama/llama-3.2-90b-vision-instruct:free', 'z-ai/glm-4.5-air:free',
   'Aggregator with free-tier models from many providers. Sign up at openrouter.ai.'),
  ('deepseek', 'DeepSeek', 0, 'https://api.deepseek.com/v1', 30,
   'deepseek-chat', NULL, 'deepseek-reasoner',
   'Cheap models, $5 sign-up credit. Sign up at platform.deepseek.com.'),
  ('google', 'Google AI Studio', 0, 'https://generativelanguage.googleapis.com/v1beta/openai', 40,
   'gemini-1.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro',
   'Free tier with rate limits. Sign up at aistudio.google.com.'),
  ('openai', 'OpenAI', 0, 'https://api.openai.com/v1', 50,
   'gpt-4o-mini', 'gpt-4o-mini', 'o3-mini',
   'Industry-standard. $5 trial credit. Sign up at platform.openai.com.'),
  ('anthropic', 'Anthropic (Claude)', 0, 'https://api.anthropic.com/v1', 60,
   'claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-20241022',
   'Strong reasoning + safety. $5 trial credit. Sign up at console.anthropic.com.'),
  ('custom', 'Custom (Ollama / vLLM / LM Studio)', 0, 'http://localhost:11434/v1', 100,
   'llama3.1', 'llava', 'llama3.1',
   'Any OpenAI-compatible endpoint — point at your local model server.');

-- ─── Seed Tier-1 features (enabled by default) ──────────────────────────────

INSERT OR IGNORE INTO ai_features (feature_id, display_name, description, enabled, privacy_tier, task_kind) VALUES
  ('normalize_import',  'Normalize import',     'Maps messy CSV / PDF / Excel columns into Omnix product fields',                                                          1, 'low',    'text'),
  ('enrich_product',    'Enrich product',       'Auto-fills category, unit, tax rate, suggested barcode from a product name',                                              1, 'low',    'text'),
  ('explain_etims',     'Explain eTIMS error',  'Translates KRA eTIMS error codes to plain English and suggests fixes',                                                    1, 'low',    'text'),
  ('docs_qa',           'In-app help Q&A',      'Answers cashier / owner questions from the built-in documentation',                                                       1, 'low',    'text'),
  ('setup_assist',      'Setup wizard assist',  'Suggests sensible defaults during first-run setup based on your business description',                                    1, 'low',    'text'),
  ('receipt_ocr',       'Receipt / invoice OCR','Extracts line items from a photo of a supplier invoice or competitor receipt',                                            1, 'low',    'vision'),
  ('anomaly_narrate',   'Anomaly narrator',     'Explains sales / stock anomalies in plain English (Tuesday revenue dropped 40%, etc.)',                                   1, 'medium', 'text'),
  ('slow_mover',        'Slow-mover insights',  'Highlights stock that hasn''t moved with a suggested action',                                                             1, 'medium', 'text'),
  ('drug_enrich',       'Drug enrichment',      'Suggests active ingredient, schedule, NHIF code, dosage form for a pharmacy product',                                     1, 'low',    'text'),
  ('hsn_suggest',       'HSN / tax suggestion', 'Suggests the correct KRA HSN code and tax rate for a product',                                                            1, 'low',    'text'),
  ('menu_describe',     'Menu description',     'Writes a polished menu item description from a brief',                                                                    1, 'low',    'text'),
  ('recipe_suggest',    'Recipe suggester',     'Suggests recipe ingredients and quantities for a menu item',                                                              1, 'low',    'text'),
  ('bom_generate',      'BOM generator',        'Generates a building-materials list from a project description',                                                          1, 'low',    'text'),
  ('command_palette',   'Smart commands',       'Turns natural language into POS / inventory actions in the command palette',                                              0, 'medium', 'reasoning'),
  ('draft_message',     'Customer message',     'Drafts an invoice reminder / receipt acknowledgement / support reply',                                                    0, 'high',   'text'),
  ('translate_receipt', 'Receipt translation',  'Translates printed receipts between English and Swahili',                                                                 1, 'low',    'text'),
  ('zreport_summary',   'Z-report summary',     'Turns end-of-day numbers into a 3-sentence shift summary',                                                                1, 'medium', 'text'),
  ('stock_take_help',   'Stock-take helper',    'Reconciles count input against system stock and flags suspicious gaps',                                                   1, 'medium', 'text');

-- ─── Seed master settings ───────────────────────────────────────────────────

INSERT OR IGNORE INTO ai_settings (key, value) VALUES
  ('free_models_only',     '1'),
  ('show_preview',         '1'),
  ('cache_enabled',        '1'),
  ('cache_ttl_days',       '30'),
  ('monthly_spend_cap_usd','5'),
  ('preview_dismiss_count','0'),
  ('high_tier_optin',      '0');
