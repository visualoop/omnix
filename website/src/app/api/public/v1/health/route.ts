/**
 * GET /api/public/v1/health
 *
 * Simple heartbeat endpoint. Requires a valid API key but returns no data
 * beyond OK + your key's owner + scopes. Callers use this to confirm the
 * key is live before making bigger requests.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireApiKey } from '@/lib/public-api-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req)
  if (!auth.ok) return auth.response
  return NextResponse.json({
    ok: true,
    caller: {
      owner_user_id: auth.caller.ownerUserId,
      scopes: auth.caller.scopes,
    },
    version: 'v1',
    timestamp: new Date().toISOString(),
  })
}
