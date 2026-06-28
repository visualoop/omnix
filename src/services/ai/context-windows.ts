/**
 * Context window registry — per-provider/model token budgets.
 *
 * Used by the auto-compression layer to decide when a conversation
 * needs to be compacted before being sent to the model. Token counts
 * are taken from each provider's published model card; where the
 * card lists "128k+" we use the conservative documented value.
 *
 * Lookup precedence inside `getContextWindow`:
 *   1. Exact provider+model match.
 *   2. Family prefix match within the provider (e.g. `gpt-4o`,
 *      `claude-3-5`, `llama-3`) — handy for `:free`, dated suffixes,
 *      and OpenRouter's `vendor/model:tag` slugs.
 *   3. Provider default.
 *   4. Hard floor (8192) so we never return 0 / NaN.
 *
 * Numbers are in tokens (the unit `max_tokens` and `total_tokens` are
 * already reported in). We deliberately under-state by a small margin
 * when the provider's published value is "up to N" — better to compress
 * one turn early than to blow past the budget.
 */
import type { ProviderId } from "./types";

/** Conservative fallback when nothing else matches. */
export const DEFAULT_CONTEXT_WINDOW = 8192;

/** Per-provider default — used when a model isn't in the table. */
const PROVIDER_DEFAULTS: Record<ProviderId, number> = {
  groq: 8192,            // Many Groq models are 8k; the big ones (llama-3.3-70b) get 128k via override.
  openrouter: 8192,      // Wildly variable; specific slugs override below.
  deepseek: 64_000,      // deepseek-chat 64k, deepseek-reasoner 64k.
  google: 1_000_000,     // Gemini 1.5/2.0 default to 1M.
  openai: 128_000,       // 4o family is 128k; o3-mini-256k overrides below.
  anthropic: 200_000,    // Claude 3.5 / 3.7 family is 200k.
  custom: 8192,          // Local Ollama/vLLM unknown — assume small.
};

/**
 * Exact model → window. Keys may be a bare model name (groq, openai,
 * anthropic style) or the OpenRouter `vendor/model:tag` slug.
 *
 * When a model has multiple known variants and we only want one entry,
 * prefer the smallest published window so the compressor errs on the
 * side of compressing too early rather than too late.
 */
const MODEL_WINDOWS: Record<string, number> = {
  // ── OpenAI ────────────────────────────────────────────────────────
  "gpt-4o": 128_000,
  "gpt-4o-mini": 128_000,
  "gpt-4-turbo": 128_000,
  "o3-mini": 200_000,
  "o1-mini": 128_000,
  "o1-preview": 128_000,
  "gpt-3.5-turbo": 16_385,

  // ── Anthropic ─────────────────────────────────────────────────────
  "claude-3-5-sonnet-20241022": 200_000,
  "claude-3-5-haiku-20241022": 200_000,
  "claude-3-opus-20240229": 200_000,
  "claude-3-sonnet-20240229": 200_000,
  "claude-3-haiku-20240307": 200_000,

  // ── Google ────────────────────────────────────────────────────────
  "gemini-1.5-flash": 1_000_000,
  "gemini-1.5-pro": 2_000_000,
  "gemini-2.0-flash-exp": 1_000_000,

  // ── DeepSeek ──────────────────────────────────────────────────────
  "deepseek-chat": 64_000,
  "deepseek-reasoner": 64_000,

  // ── Groq ──────────────────────────────────────────────────────────
  "llama-3.3-70b-versatile": 128_000,
  "llama-3.1-8b-instant": 128_000,
  "llama-3.2-90b-vision-preview": 8192,
  "llama-3.2-11b-vision-preview": 8192,
  "mixtral-8x7b-32768": 32_768,
  "qwen-qwq-32b": 32_768,
  "deepseek-r1-distill-llama-70b": 128_000,

  // ── OpenRouter (free-tier slugs used by the router fallback chain) ─
  "openai/gpt-oss-20b:free": 8192,
  "openai/gpt-oss-120b:free": 8192,
  "google/gemma-4-26b-a4b-it:free": 8192,
  "qwen/qwen3-coder:free": 32_768,
  "nvidia/nemotron-nano-9b-v2:free": 8192,
  "nvidia/nemotron-nano-12b-v2-vl:free": 8192,
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free": 8192,
  "meta-llama/llama-3.3-70b-instruct:free": 128_000,
  "meta-llama/llama-3.2-90b-vision-instruct:free": 8192,
  "z-ai/glm-4.5-air:free": 32_768,
};

/**
 * Family prefixes (provider-scoped) → window. Used for graceful matching
 * of dated suffixes, `:free` variants, and OpenRouter slugs that don't
 * appear in `MODEL_WINDOWS` verbatim.
 *
 * Each entry is `[provider, prefix, window]`. First match wins, so order
 * prefixes from most-specific to least-specific.
 */
const FAMILY_PREFIXES: Array<[ProviderId | "*", string, number]> = [
  // OpenAI
  ["openai", "gpt-4o", 128_000],
  ["openai", "o3-", 200_000],
  ["openai", "o1-", 128_000],
  ["openai", "gpt-4", 128_000],
  ["openai", "gpt-3.5", 16_385],

  // Anthropic — any claude-3.x is 200k
  ["anthropic", "claude-3", 200_000],
  ["anthropic", "claude-2", 100_000],

  // Google — gemini 1.5+ is 1M+
  ["google", "gemini-2", 1_000_000],
  ["google", "gemini-1.5", 1_000_000],
  ["google", "gemini-1", 32_768],

  // DeepSeek
  ["deepseek", "deepseek-r", 64_000],
  ["deepseek", "deepseek-", 64_000],

  // Groq — llama-3.x is 128k except vision; mixtral 32k
  ["groq", "llama-3.3", 128_000],
  ["groq", "llama-3.1", 128_000],
  ["groq", "llama-3.2-90b-vision", 8192],
  ["groq", "llama-3.2-11b-vision", 8192],
  ["groq", "llama-3", 128_000],
  ["groq", "mixtral-8x7b", 32_768],
  ["groq", "qwen", 32_768],
  ["groq", "deepseek-r1", 128_000],

  // OpenRouter slug families (vendor/model)
  ["openrouter", "openai/gpt-4o", 128_000],
  ["openrouter", "openai/gpt-4", 128_000],
  ["openrouter", "openai/o3", 200_000],
  ["openrouter", "openai/o1", 128_000],
  ["openrouter", "openai/gpt-oss", 8192],
  ["openrouter", "anthropic/claude-3", 200_000],
  ["openrouter", "google/gemini-2", 1_000_000],
  ["openrouter", "google/gemini-1.5", 1_000_000],
  ["openrouter", "google/gemma", 8192],
  ["openrouter", "meta-llama/llama-3.3", 128_000],
  ["openrouter", "meta-llama/llama-3.2-90b-vision", 8192],
  ["openrouter", "meta-llama/llama-3", 128_000],
  ["openrouter", "deepseek/deepseek-r", 64_000],
  ["openrouter", "deepseek/deepseek", 64_000],
  ["openrouter", "qwen/", 32_768],
  ["openrouter", "nvidia/nemotron", 8192],
  ["openrouter", "z-ai/glm", 32_768],
  ["openrouter", "mistralai/", 32_768],
];

/**
 * Resolve the context window (in tokens) for a given provider+model.
 * Always returns a positive integer ≥ `DEFAULT_CONTEXT_WINDOW`.
 */
export function getContextWindow(provider: ProviderId | string, model: string): number {
  if (!model) return PROVIDER_DEFAULTS[provider as ProviderId] ?? DEFAULT_CONTEXT_WINDOW;

  // 1. Exact match.
  const exact = MODEL_WINDOWS[model];
  if (typeof exact === "number") return exact;

  // 2. Family prefix match, scoped to this provider (or wildcard).
  for (const [p, prefix, window] of FAMILY_PREFIXES) {
    if (p !== "*" && p !== provider) continue;
    if (model.startsWith(prefix)) return window;
  }

  // 3. Provider default.
  const providerDefault = PROVIDER_DEFAULTS[provider as ProviderId];
  if (typeof providerDefault === "number") return providerDefault;

  // 4. Hard floor.
  return DEFAULT_CONTEXT_WINDOW;
}

/**
 * Compute the usable budget — context window minus a safety reserve for
 * the model's own response. Used by the compressor: we compress until
 * the remaining prompt fits within this budget.
 *
 * The reserve defaults to `min(maxTokens, 1024)` if known, else 1024.
 */
export function getPromptBudget(
  provider: ProviderId | string,
  model: string,
  reserveForCompletion = 1024,
): number {
  const total = getContextWindow(provider, model);
  // Always leave at least 512 tokens of headroom even on tiny windows.
  const reserve = Math.max(512, Math.min(reserveForCompletion, Math.floor(total / 2)));
  return Math.max(DEFAULT_CONTEXT_WINDOW - reserve, total - reserve);
}
