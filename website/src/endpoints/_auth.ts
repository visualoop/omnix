/**
 * Auth helpers shared across custom endpoints.
 *
 * Three identity tiers:
 *   1. system    — request bears X-System-Token matching env. Used by CI.
 *   2. machine   — request bears Authorization: Bearer <machineToken>. Desktop app.
 *   3. customer  — request bears Payload customer auth cookie. Dashboard.
 */

import { createHash, timingSafeEqual } from 'crypto'
import type { PayloadRequest } from 'payload'

export function isSystem(req: PayloadRequest): boolean {
  const token = req.headers?.get?.('x-system-token') ?? null
  const expected = process.env.PAYLOAD_SYSTEM_TOKEN ?? ''
  if (!token || !expected) return false
  // Constant-time compare to prevent timing attacks
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function getBearerToken(req: PayloadRequest): string | null {
  const auth = req.headers?.get?.('authorization') ?? ''
  if (!auth.toLowerCase().startsWith('bearer ')) return null
  return auth.slice(7).trim() || null
}

/**
 * Hash a machine auth token before storing or comparing.
 * Uses SHA-256 — the raw token is high-entropy (32 random bytes) so SHA-256
 * is sufficient and dodges the database write-cost of bcrypt on every heartbeat.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Look up a machine by its bearer token. Returns the machine doc + license, or null.
 */
export async function authenticateMachine(req: PayloadRequest) {
  const token = getBearerToken(req)
  if (!token) return null
  const tokenHash = hashToken(token)
  const result = await req.payload.find({
    collection: 'machines',
    where: { authToken: { equals: tokenHash } },
    limit: 1,
    depth: 1,
  })
  return result.docs[0] ?? null
}

export function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

export function errorResponse(message: string, status = 400): Response {
  return Response.json({ error: message }, { status })
}

/** Read the request body as JSON safely. */
export async function readJson<T = Record<string, unknown>>(req: PayloadRequest): Promise<T | null> {
  try {
    if (req.json) return (await req.json()) as T
  } catch {
    // ignore
  }
  return null
}
