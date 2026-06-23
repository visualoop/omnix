import { headers } from 'next/headers'
import crypto from 'node:crypto'
import { auth } from '@/lib/auth'
import { db, auditLog } from '@/db'
import { createId } from '@/lib/ids'
import { setSetting, type SettingKey } from '@/lib/platform-settings'

export const dynamic = 'force-dynamic'

/**
 * Auto-generate a fresh value for opaque secrets.
 *
 * Currently supports cron.secret — generates a 32-byte base64url
 * string and stores it. The admin doesn't need to know or type it.
 *
 *   POST { key: 'cron.secret' }
 */
const GENERATABLE: Set<SettingKey> = new Set([
  'cron.secret',
])

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return Response.json({ error: 'unauthenticated' }, { status: 401 })
  if (session.user.role !== 'platform_admin') return Response.json({ error: 'forbidden' }, { status: 403 })

  const body = (await req.json().catch(() => null)) as { key?: string } | null
  if (!body?.key) return Response.json({ error: 'key required' }, { status: 400 })
  if (!GENERATABLE.has(body.key as SettingKey)) {
    return Response.json({ error: `cannot auto-generate ${body.key}` }, { status: 400 })
  }

  const value = crypto.randomBytes(32).toString('base64url')
  await setSetting(body.key as SettingKey, value, session.user.id)

  await db.insert(auditLog).values({
    id: createId(),
    actorId: session.user.id,
    action: 'platform_setting.generate',
    resource: `setting:${body.key}`,
    metadata: { key: body.key },
  })

  return Response.json({ ok: true, generated: true })
}
