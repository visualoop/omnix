/**
 * Tool-result truncation — keeps the model's tool-call replies inside a
 * reasonable token budget without losing the full result for the UI.
 *
 * Problem: a tool like `searchProducts` or `getRecentSales` can return
 * thousands of rows. Feeding the full JSON back to the model both blows
 * the context window and burns tokens for content the model will just
 * summarise into a sentence. Worse, on free-tier models a 50 KB tool
 * result triggers a 429 on the very next request.
 *
 * Strategy:
 *   - Wrap every tool's `execute` so its return value gets serialised,
 *     measured, and clipped to `maxChars` (default 2000 ≈ ~500 tokens)
 *     before being handed back to the model.
 *   - Stash the full untruncated result in a `fullResults` map keyed by
 *     the AI SDK's `toolCallId` so the UI can still render it.
 *   - The truncation marker tells the model exactly how much was cut and
 *     reassures it the user UI has the full version.
 *
 * Why a side-channel map: the AI SDK's `tool-result` stream event uses
 * whatever value `execute` returned. To show the UI more than the model
 * sees, we have to capture the full result before returning the clipped
 * one — and we have to key it by `toolCallId` because the same tool can
 * fire multiple times in one assistant turn.
 */
import type { ToolSet } from "ai";

/** Default chars per truncated tool result (≈ 500 tokens). */
export const DEFAULT_TOOL_RESULT_MAX_CHARS = 2000;

/** Min chars worth truncating. Below this we just pass through. */
const MIN_TRUNCATION_CHARS = 200;

export interface TruncatedToolPayload {
  /** Always `true` so the model knows this is a clipped result. */
  truncated: true;
  /** Original serialised length in chars. */
  originalLength: number;
  /** Number of chars kept in `preview`. */
  previewLength: number;
  /** Head + tail of the original, joined by an explicit cut marker. */
  preview: string;
  /** Human note for the model. */
  note: string;
}

export interface ToolTruncationBundle {
  /** Wrapped tools to hand to `streamText({ tools })`. */
  tools: ToolSet;
  /** toolCallId → full untruncated result. Read in the stream-result handler. */
  fullResults: Map<string, unknown>;
}

/**
 * Wrap each tool in `tools` so its result is truncated for the model
 * but preserved verbatim in `fullResults`. If a tool has no `execute`
 * (rare — happens for tools that route through `onToolCall`), pass it
 * through unchanged.
 */
export function withTruncatedToolResults(
  tools: ToolSet,
  maxChars: number = DEFAULT_TOOL_RESULT_MAX_CHARS,
): ToolTruncationBundle {
  const fullResults = new Map<string, unknown>();
  const wrapped: ToolSet = {};

  for (const [name, raw] of Object.entries(tools)) {
    const t = raw as { execute?: (args: unknown, opts: { toolCallId?: string }) => unknown } & Record<string, unknown>;
    if (!t || typeof t.execute !== "function") {
      wrapped[name] = raw;
      continue;
    }

    const original = t.execute.bind(t);
    wrapped[name] = {
      ...t,
      async execute(args: unknown, options: { toolCallId?: string } = {}) {
        const result = await original(args, options);
        const callId = options.toolCallId;
        if (callId) fullResults.set(callId, result);
        return truncateToolResult(result, maxChars);
      },
    } as unknown as ToolSet[string];
  }

  return { tools: wrapped, fullResults };
}

/**
 * Serialise `result` and clip it if it exceeds `maxChars`. Strings are
 * preserved as strings; structured values are returned as a
 * `TruncatedToolPayload` so the model sees obvious "this was clipped"
 * shape rather than a half-cut JSON blob.
 */
export function truncateToolResult(result: unknown, maxChars: number): unknown {
  if (result === undefined || result === null) return result;

  const isString = typeof result === "string";
  const serialised = isString ? (result as string) : safeStringify(result);
  const length = serialised.length;

  if (length <= maxChars || maxChars < MIN_TRUNCATION_CHARS) {
    return result;
  }

  // Keep ~70% head + ~20% tail with a marker in between. The remaining
  // 10% is the marker itself + slack; we recompute the actual preview
  // length so the model gets accurate numbers.
  const headBudget = Math.max(MIN_TRUNCATION_CHARS / 2, Math.floor(maxChars * 0.7));
  const tailBudget = Math.max(MIN_TRUNCATION_CHARS / 4, Math.floor(maxChars * 0.2));
  const head = serialised.slice(0, headBudget);
  const tail = tailBudget > 0 ? serialised.slice(length - tailBudget) : "";
  const cutChars = length - head.length - tail.length;
  const marker = `\n\n[… ${cutChars.toLocaleString()} chars truncated for the model — full result is visible in the chat UI …]\n\n`;
  const preview = tail ? `${head}${marker}${tail}` : `${head}${marker}`;

  if (isString) {
    return preview;
  }

  return {
    truncated: true,
    originalLength: length,
    previewLength: preview.length,
    preview,
    note:
      "Result was truncated to keep within the model's context window. " +
      "The user sees the complete output in the UI; summarise it from the preview " +
      "and mention that the full data is available on screen if helpful.",
  } satisfies TruncatedToolPayload;
}

/**
 * `JSON.stringify` that survives circular refs and `BigInt`s without
 * throwing — falls back to `String(...)` on failure. Output is compact
 * (no whitespace) because every char counts against the budget.
 */
function safeStringify(value: unknown): string {
  try {
    const seen = new WeakSet<object>();
    return JSON.stringify(value, (_key, val) => {
      if (typeof val === "bigint") return val.toString();
      if (val && typeof val === "object") {
        if (seen.has(val as object)) return "[Circular]";
        seen.add(val as object);
      }
      return val;
    });
  } catch {
    return String(value);
  }
}
