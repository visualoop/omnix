/**
 * Conversation compression — keeps long chats inside the model's context
 * window by collapsing older turns into a deterministic summary.
 *
 * Strategy (deliberately simple + offline):
 *   - Estimate tokens per message via a char/4 heuristic. Cheap and good
 *     enough for budget decisions; we never need exact tokenisation
 *     because the provider re-tokenises anyway.
 *   - If total estimated tokens stay under `threshold × budget`, do
 *     nothing.
 *   - Otherwise: preserve every `system` message verbatim, keep the last
 *     `keepTailTurns` user+assistant pairs verbatim, and replace the
 *     middle with one synthetic assistant note that lists the topics +
 *     a one-line digest per dropped turn.
 *
 * The summary is purely string manipulation — no extra LLM call. That
 * keeps compression free, offline-safe, and deterministic (testable).
 * The model still sees enough context to follow the thread; if the user
 * really needs the full transcript, the UI keeps the original.
 */
import type { ChatMessage } from "./types";

/** Rough chars-per-token (English, average). Slightly conservative. */
const CHARS_PER_TOKEN = 4;

/** Approximate per-message overhead the provider adds (role markers etc.). */
const MESSAGE_OVERHEAD_TOKENS = 5;

/** Token budget for one image part — used when we can't measure the model side. */
const IMAGE_TOKEN_COST = 1024;

/** Default fraction of the prompt budget at which we trigger compression. */
export const DEFAULT_COMPRESS_THRESHOLD = 0.75;

/** Default number of trailing turns (user+assistant pairs) we keep intact. */
export const DEFAULT_KEEP_TAIL_TURNS = 4;

/**
 * Estimate the token count of one message. Counts text content, image
 * placeholders, and a small per-message overhead so the total matches
 * provider accounting reasonably well.
 */
export function estimateMessageTokens(message: ChatMessage): number {
  let chars = 0;
  let imageCount = 0;

  if (typeof message.content === "string") {
    chars += message.content.length;
  } else {
    for (const part of message.content) {
      if (part.type === "text") chars += part.text.length;
      else if (part.type === "image_url") imageCount += 1;
    }
  }

  return Math.ceil(chars / CHARS_PER_TOKEN) + imageCount * IMAGE_TOKEN_COST + MESSAGE_OVERHEAD_TOKENS;
}

/** Sum of `estimateMessageTokens` over a conversation. */
export function estimateTokens(messages: ChatMessage[]): number {
  let total = 0;
  for (const m of messages) total += estimateMessageTokens(m);
  return total;
}

/**
 * Produce a short one-line digest of a message. Keeps the first
 * `maxChars` characters of text content, normalises whitespace, and
 * marks image attachments explicitly.
 */
export function digestMessage(message: ChatMessage, maxChars = 160): string {
  let text = "";
  let imageCount = 0;

  if (typeof message.content === "string") {
    text = message.content;
  } else {
    const buf: string[] = [];
    for (const part of message.content) {
      if (part.type === "text") buf.push(part.text);
      else if (part.type === "image_url") imageCount += 1;
    }
    text = buf.join(" ");
  }

  const normalised = text.replace(/\s+/g, " ").trim();
  const clipped = normalised.length > maxChars ? `${normalised.slice(0, maxChars - 1)}…` : normalised;
  if (imageCount > 0) {
    const imgTag = imageCount === 1 ? "[1 image]" : `[${imageCount} images]`;
    return clipped ? `${clipped} ${imgTag}` : imgTag;
  }
  return clipped;
}

export interface CompressionOptions {
  /** Token budget (usually `getPromptBudget(provider, model)`). */
  budget: number;
  /** Trigger fraction: compress if estimated tokens > threshold × budget. */
  threshold?: number;
  /** Number of trailing user+assistant turns to preserve verbatim. */
  keepTailTurns?: number;
}

export interface CompressionResult {
  /** The messages to send (may be the original array if no compression). */
  messages: ChatMessage[];
  /** True if any messages were collapsed. */
  compressed: boolean;
  /** Estimated tokens before compression. */
  originalTokens: number;
  /** Estimated tokens after compression. */
  finalTokens: number;
  /** Budget used for the decision. */
  budget: number;
  /** Count of messages that were dropped into the synthetic summary. */
  droppedMessageCount: number;
}

/**
 * Internal helper: split a conversation into [leadingSystem, body].
 * Any system messages that come after the first non-system message
 * stay in `body` (we'd rather summarise them than re-order).
 */
function splitLeadingSystem(messages: ChatMessage[]): { system: ChatMessage[]; body: ChatMessage[] } {
  const system: ChatMessage[] = [];
  let i = 0;
  while (i < messages.length && messages[i].role === "system") {
    system.push(messages[i]);
    i += 1;
  }
  return { system, body: messages.slice(i) };
}

/**
 * Build the synthetic "earlier conversation" assistant message that
 * replaces the dropped middle. We pick a small number of bullet-style
 * digests so the prompt stays cheap.
 */
function buildSummaryMessage(dropped: ChatMessage[]): ChatMessage {
  const bullets: string[] = [];
  for (const m of dropped) {
    const tag = m.role === "user" ? "user" : m.role === "assistant" ? "assistant" : m.role;
    const digest = digestMessage(m);
    if (!digest) continue;
    bullets.push(`- ${tag}: ${digest}`);
  }

  const summaryBody = bullets.length > 0
    ? bullets.join("\n")
    : `${dropped.length} earlier messages compacted to fit the model's context window.`;

  return {
    role: "assistant",
    content: `[Earlier conversation summary — ${dropped.length} messages compacted]\n${summaryBody}`,
  };
}

/**
 * Compress a conversation to fit within `budget` tokens.
 *
 * Compression order:
 *   1. If under threshold, return unchanged.
 *   2. Keep all leading system messages.
 *   3. Keep the trailing `keepTailTurns × 2` body messages verbatim.
 *   4. Summarise everything else into one synthetic assistant note.
 *   5. If still over budget after step 4, drop the oldest entries from
 *      the kept tail (one at a time) until we're under budget — we
 *      never drop system messages.
 */
export function compressMessages(
  messages: ChatMessage[],
  options: CompressionOptions,
): CompressionResult {
  const { budget } = options;
  const threshold = options.threshold ?? DEFAULT_COMPRESS_THRESHOLD;
  const keepTailMessages = (options.keepTailTurns ?? DEFAULT_KEEP_TAIL_TURNS) * 2;

  const originalTokens = estimateTokens(messages);
  const trigger = Math.max(1, Math.floor(budget * threshold));

  if (originalTokens <= trigger) {
    return {
      messages,
      compressed: false,
      originalTokens,
      finalTokens: originalTokens,
      budget,
      droppedMessageCount: 0,
    };
  }

  const { system, body } = splitLeadingSystem(messages);

  if (body.length <= keepTailMessages) {
    // Nothing to summarise — body already fits the "keep" window.
    return {
      messages,
      compressed: false,
      originalTokens,
      finalTokens: originalTokens,
      budget,
      droppedMessageCount: 0,
    };
  }

  const tailStart = body.length - keepTailMessages;
  const dropped = body.slice(0, tailStart);
  const tail = body.slice(tailStart);
  const summary = buildSummaryMessage(dropped);

  let working: ChatMessage[] = [...system, summary, ...tail];
  let finalTokens = estimateTokens(working);

  // Step 5 — if we're still over budget, shave off the oldest kept tail
  // messages until we fit. We never drop the summary or system messages.
  while (finalTokens > budget && working.length > system.length + 1) {
    // The first item after system+summary is the oldest tail entry.
    working = [...system, summary, ...working.slice(system.length + 2)];
    finalTokens = estimateTokens(working);
  }

  return {
    messages: working,
    compressed: true,
    originalTokens,
    finalTokens,
    budget,
    droppedMessageCount: dropped.length,
  };
}
