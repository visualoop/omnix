/**
 * Streaming AI router — built on Vercel AI SDK's `streamText` for token-by-token
 * delivery, layered on top of our existing provider chain (config.ts) so we
 * keep the priority + rate-limit-aware fallback we already have.
 *
 * Public surface mirrors invoke():
 *   - streamInvoke(featureId, messages, opts) → AsyncIterable<string>
 *
 * Each yielded string is a delta (token chunk) — caller appends to a buffer.
 * Audit + cache are skipped here (streaming bypasses cache; audit happens
 * once at end with totals).
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, stepCountIs, type ModelMessage, type ToolSet } from "ai";
import { listProviders, getFeature, loadSettings, setProviderRuntimeState } from "./config";
import { recordCall } from "./audit";
import { redactMessages } from "./redact";
import { AiError, type AiFeature, type AiProvider, type ChatMessage, type InvokeOptions, type TaskKind } from "./types";

interface ResolvedRoute {
  provider: AiProvider;
  model: string;
}

const FALLBACK_MODELS: Record<string, Partial<Record<TaskKind, string[]>>> = {
  openrouter: {
    text: [
      "openai/gpt-oss-20b:free",
      "google/gemma-4-26b-a4b-it:free",
      "qwen/qwen3-coder:free",
      "nvidia/nemotron-nano-9b-v2:free",
      "meta-llama/llama-3.3-70b-instruct:free",
    ],
    vision: ["meta-llama/llama-3.2-90b-vision-instruct:free"],
    reasoning: ["z-ai/glm-4.5-air:free", "openai/gpt-oss-120b:free"],
  },
  groq: {
    text: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    vision: ["llama-3.2-90b-vision-preview"],
    reasoning: ["qwen-qwq-32b"],
  },
};

function modelForTask(p: AiProvider, kind: TaskKind): string | null {
  if (kind === "vision") return p.preferred_vision_model;
  if (kind === "reasoning") return p.preferred_reasoning_model;
  return p.preferred_text_model;
}

function modelsForProviderTask(p: AiProvider, kind: TaskKind): string[] {
  const primary = modelForTask(p, kind);
  const fallbacks = FALLBACK_MODELS[p.id]?.[kind] ?? [];
  const out: string[] = [];
  if (primary) out.push(primary);
  for (const m of fallbacks) if (!out.includes(m)) out.push(m);
  return out;
}

async function resolveCandidates(feature: AiFeature, freeOnly: boolean): Promise<ResolvedRoute[]> {
  const all = await listProviders();
  const enabled = all.filter((p) => p.enabled && p.api_key_encrypted);
  const out: ResolvedRoute[] = [];
  for (const p of enabled) {
    if (p.rate_limited_until && new Date(p.rate_limited_until) > new Date()) continue;
    for (const model of modelsForProviderTask(p, feature.task_kind)) {
      if (freeOnly && !model.endsWith(":free") && !["groq", "google", "custom"].includes(p.id)) continue;
      if (out.some((r) => r.provider.id === p.id && r.model === model)) continue;
      out.push({ provider: p, model });
    }
  }
  return out;
}

/** Convert our ChatMessage format to AI SDK's ModelMessage format. */
function toModelMessages(messages: ChatMessage[]): ModelMessage[] {
  return messages.map((m) => {
    if (typeof m.content === "string") {
      return { role: m.role, content: m.content } as ModelMessage;
    }
    // Multi-part: pass through, AI SDK handles {type:"text"|"image_url"} parts
    return { role: m.role, content: m.content as never } as ModelMessage;
  });
}

export interface StreamProgress {
  text: string;            // accumulated full text so far
  delta: string;           // newly-streamed chunk this tick
  done: boolean;           // true on the final tick (delta='')
  provider?: string;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  /** Tool call requested by the model. Emitted as soon as the model starts a tool call. */
  toolCall?: { id: string; name: string; args: Record<string, unknown> };
  /** Result returned to the model after a tool call. */
  toolResult?: { id: string; name: string; result: unknown };
}

/**
 * Stream a chat completion. Yields a StreamProgress object on each delta,
 * and one final {done:true} object with usage data. Walks the provider
 * fallback chain on initial-call errors only — once a stream starts we
 * commit to that provider.
 *
 * Pass `tools` to give the model agent capabilities. The function will
 * loop up to `maxSteps` times: streamText handles tool execution + result
 * forwarding internally.
 */
export async function* streamInvoke(
  featureId: string,
  messages: ChatMessage[],
  opts: InvokeOptions & { tools?: ToolSet; maxSteps?: number } = {},
): AsyncGenerator<StreamProgress, void, undefined> {
  const feature = await getFeature(featureId);
  if (!feature) throw new AiError("error", `Unknown feature ${featureId}`);
  if (!feature.enabled) throw new AiError("error", `Feature ${featureId} is disabled`);

  const settings = await loadSettings();
  const privacyTier = opts.privacyTier ?? feature.privacy_tier;

  if (privacyTier === "high" && !settings.high_tier_optin) {
    await recordCall({
      featureId, providerId: "none", model: "", userId: null,
      request: { messages }, response: null, privacyTier,
      status: "blocked_privacy", errorMessage: "Privacy tier requires opt-in",
    });
    throw new AiError("blocked_privacy", "AI access blocked by privacy settings");
  }

  const safeMessages = redactMessages(messages);
  const candidates = await resolveCandidates(feature, settings.free_models_only);
  if (candidates.length === 0) {
    throw new AiError("no_provider", "No AI provider configured. Add a key in Settings → AI.");
  }

  let lastError: Error | null = null;
  for (const route of candidates) {
    const baseUrl = route.provider.base_url.replace(/\/$/, "");
    const apiKey = route.provider.api_key_encrypted ?? "";
    try {
      const provider = createOpenAICompatible({
        name: route.provider.id,
        baseURL: baseUrl,
        apiKey,
        headers:
          route.provider.id === "openrouter"
            ? { "HTTP-Referer": "https://omnix.co.ke", "X-Title": "Omnix" }
            : undefined,
      });

      const result = streamText({
        model: provider(route.model),
        messages: toModelMessages(safeMessages),
        temperature: 0.4,
        ...(opts.tools ? { tools: opts.tools, stopWhen: stepCountIs(opts.maxSteps ?? 5) } : {}),
      });

      // Reset runtime state — successful stream start
      await setProviderRuntimeState(route.provider.id, { rateLimitedUntil: null, lastError: null });

      const t0 = performance.now();
      let acc = "";
      // Use fullStream so we can emit tool-call + tool-result deltas in
      // addition to plain text deltas. textStream alone hides tool events.
      for await (const part of result.fullStream) {
        if (part.type === "text-delta") {
          const delta = (part as unknown as { text: string }).text;
          acc += delta;
          yield { text: acc, delta, done: false, provider: route.provider.id, model: route.model };
        } else if (part.type === "tool-call") {
          const tc = part as unknown as { toolCallId: string; toolName: string; input: Record<string, unknown> };
          yield {
            text: acc,
            delta: "",
            done: false,
            provider: route.provider.id,
            model: route.model,
            toolCall: { id: tc.toolCallId, name: tc.toolName, args: tc.input },
          };
        } else if (part.type === "tool-result") {
          const tr = part as unknown as { toolCallId: string; toolName: string; output: unknown };
          yield {
            text: acc,
            delta: "",
            done: false,
            provider: route.provider.id,
            model: route.model,
            toolResult: { id: tr.toolCallId, name: tr.toolName, result: tr.output },
          };
        }
      }

      // Final usage + audit
      const usage = await result.usage;
      const finishReason = await result.finishReason;
      void finishReason;
      yield {
        text: acc,
        delta: "",
        done: true,
        provider: route.provider.id,
        model: route.model,
        tokensIn: usage?.inputTokens,
        tokensOut: usage?.outputTokens,
      };

      await recordCall({
        featureId,
        providerId: route.provider.id,
        model: route.model,
        userId: null,
        request: { messages: safeMessages },
        response: {
          text: acc,
          json: null,
          provider: route.provider.id,
          model: route.model,
          tokens_in: usage?.inputTokens ?? 0,
          tokens_out: usage?.outputTokens ?? 0,
          cost_usd: 0,
          latency_ms: Math.round(performance.now() - t0),
          cache_hit: false,
        },
        privacyTier,
        status: "ok",
      });
      return;
    } catch (e) {
      lastError = e as Error;
      const msg = lastError.message ?? "";
      const isRateLimit = msg.includes("429") || msg.toLowerCase().includes("rate");
      if (isRateLimit) {
        const cooldown = new Date(Date.now() + 60_000).toISOString();
        await setProviderRuntimeState(route.provider.id, { rateLimitedUntil: cooldown, lastError: msg });
      } else {
        await setProviderRuntimeState(route.provider.id, { rateLimitedUntil: null, lastError: msg });
      }
    }
  }

  await recordCall({
    featureId, providerId: "none", model: "", userId: null,
    request: { messages: safeMessages }, response: null, privacyTier,
    status: "error", errorMessage: lastError?.message ?? "All providers failed",
  });
  throw new AiError("error", lastError?.message ?? "All providers failed");
}
