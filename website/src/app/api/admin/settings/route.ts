import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db, auditLog } from '@/db'
import { createId } from '@/lib/ids'
import { listSettings, setSetting, invalidateSettingsCache, type SettingKey, SETTING_DEFINITIONS } from '@/lib/platform-settings'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return { ok: false as const, status: 401, body: { error: 'unauthenticated' } }
  if (session.user.role !== 'platform_admin') return { ok: false as const, status: 403, body: { error: 'forbidden' } }
  return { ok: true as const, session }
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json(auth.body, { status: auth.status })
  return Response.json({ settings: await listSettings() })
}

export async function PATCH(req: Request) {
  const a = await requireAdmin()
  if (!a.ok) return Response.json(a.body, { status: a.status })

  const body = (await req.json().catch(() => null)) as { key?: string; value?: string } | null
  if (!body?.key) return Response.json({ error: 'key required' }, { status: 400 })

  const def = SETTING_DEFINITIONS.find((d) => d.key === body.key)
  if (!def) return Response.json({ error: `unknown key: ${body.key}` }, { status: 400 })

  const value = (body.value ?? '').trim()
  if (!value) return Response.json({ error: 'value cannot be empty' }, { status: 400 })

  await setSetting(body.key as SettingKey, value, a.session.user.id)
  invalidateSettingsCache(body.key)

  await db.insert(auditLog).values({
    id: createId(),
    actorId: a.session.user.id,
    action: 'platform_setting.update',
    resource: `setting:${body.key}`,
    metadata: { key: body.key, sensitive: def.sensitive },
  })

  return Response.json({ ok: true })
}
