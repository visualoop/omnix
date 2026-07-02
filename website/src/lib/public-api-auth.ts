/**
 * Public API auth — validates X-Omnix-Api-Key header against api_tokens table.
 *
 * Rate limits: 100 requests/minute per key. Tracked in-memory (per-instance),
 * good enough until we need distributed rate limiting.
 *
 * All /api/public/v1/* routes call requireApiKey() as their first line.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db, apiTokens } from '@/db'
import { eq } from 'drizzle-orm'
import crypto from 'node:crypto'

interface RateWindow {
  hits: number
  reset_at: number
}
const rateBuckets = new Map<string, RateWindow>()
const RATE_LIMIT_PER_MIN = 100

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

export interface ApiCaller {
  keyId: string
  ownerUserId: string | null
  scopes: string[]
}

export async function requireApiKey(req: NextRequest): Promise<
  | { ok: true; caller: ApiCaller }
  | { ok: false; response: NextResponse }
> {
  const raw = req.headers.get('x-omnix-api-key') ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!raw) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'API key required (X-Omnix-Api-Key header or Bearer token)' },
        { status: 401 },
      ),
    }
  }

  const hash = hashKey(raw.trim())
  const rows = await db.select().from(apiTokens).where(eq(apiTokens.tokenHash, hash)).limit(1).catch(() => [])
  const token = rows[0]
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid API key' }, { status: 401 }),
    }
  }
  if (token.revokedAt) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'API key revoked' }, { status: 401 }),
    }
  }

  // Rate limit: 100/min per key
  const now = Date.now()
  let window = rateBuckets.get(hash)
  if (!window || window.reset_at < now) {
    window = { hits: 0, reset_at: now + 60_000 }
    rateBuckets.set(hash, window)
  }
  window.hits++
  if (window.hits > RATE_LIMIT_PER_MIN) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Rate limit exceeded (100/min)' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((window.reset_at - now) / 1000)) } },
      ),
    }
  }

  return {
    ok: true,
    caller: {
      keyId: token.id,
      ownerUserId: token.userId ?? null,
      scopes: (token.scopes ?? '').split(',').filter(Boolean),
    },
  }
}
