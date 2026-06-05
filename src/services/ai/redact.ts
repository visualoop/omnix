/**
 * PII redaction — minimal, conservative regex layer that runs over every
 * prompt before it leaves the device. Goal is "nothing identifying a real
 * person or business should ever ship to a third-party LLM provider."
 *
 * Patterns covered:
 *   - Kenyan phone numbers: 07xx, 01xx, +2547xx, 2547xx, etc.
 *   - Email addresses
 *   - KRA PIN format (A123456789B → 11 chars, alpha-num-alpha)
 *   - Kenyan ID numbers (8-digit standalone)
 *   - Bearer tokens / API keys (prefix-style sk-, gsk_, sk_, OMNIX-)
 *
 * Names are NOT auto-redacted (too many false positives on product names
 * like "Mama Wanjiru chai"); features that send customer-name fields must
 * pass `redactNames: true` explicitly via `redactText(text, {names: [...]})`.
 */

const PATTERNS: Array<[RegExp, string]> = [
  // Phone numbers (Kenya): +254XXXXXXXXX, 254XXXXXXXXX, 0XXXXXXXXX (10-13 digits)
  [/(?:\+?254|0)[17]\d{8}\b/g, "[PHONE]"],
  // Generic emails
  [/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[EMAIL]"],
  // KRA PIN: letter, 9 digits, letter (case-insensitive)
  [/\b[A-Za-z]\d{9}[A-Za-z]\b/g, "[KRA_PIN]"],
  // Kenyan national ID — standalone 7-9 digit run not preceded/followed by another digit
  [/(?<!\d)\d{7,9}(?!\d)/g, "[ID]"],
  // API keys with common prefixes
  [/\b(?:sk|gsk|pk)[_-][A-Za-z0-9]{20,}/g, "[API_KEY]"],
  // Omnix license keys
  [/\bOMNIX-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){2,}\b/g, "[LICENSE]"],
];

/** Redact in-place: take any string, return a redacted version. */
export function redact(text: string, extras: { names?: string[] } = {}): string {
  let out = text;
  for (const [re, repl] of PATTERNS) out = out.replace(re, repl);
  if (extras.names && extras.names.length > 0) {
    for (const name of extras.names) {
      if (!name || name.length < 2) continue;
      // Word-boundary, case-insensitive, escape regex specials
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "[NAME]");
    }
  }
  return out;
}

/** Convenience: redact every text field inside a chat-message array. */
export function redactMessages<T extends { content: unknown }>(messages: T[], extras?: { names?: string[] }): T[] {
  return messages.map((m) => {
    if (typeof m.content === "string") {
      return { ...m, content: redact(m.content, extras) };
    }
    if (Array.isArray(m.content)) {
      return {
        ...m,
        content: m.content.map((part) =>
          (part as { type: string }).type === "text"
            ? { ...(part as object), text: redact((part as { text: string }).text, extras) }
            : part,
        ),
      };
    }
    return m;
  });
}
