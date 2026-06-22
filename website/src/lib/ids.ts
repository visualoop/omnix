/**
 * createId() — short URL-safe random ID for Drizzle primary keys.
 *
 * Uses crypto.randomUUID() prefixed/sliced for compactness. Replace
 * with `nanoid` if we want shorter IDs across the board.
 */
export function createId(): string {
  // crypto.randomUUID is available in Node 19+ and all modern browsers.
  // Returns 36-char UUID. We strip the dashes to get 32 hex chars.
  return crypto.randomUUID().replace(/-/g, '')
}
