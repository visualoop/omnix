import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db, auditLog } from '@/db'
import { createId } from '@/lib/ids'
import { setSetting, SETTING_DEFINITIONS, type SettingKey } from '@/lib/platform-settings'

export const dynamic = 'force-dynamic'

/**
 * One-shot helper: copy whatever values exist in process.env (legacy
 * Vercel env vars) into the platform_settings DB rows. Lets the admin
 * see everything pre-populated in /admin/settings without typing it.
 *
 * Idempotent: re-running overwrites with the current env value.
 */
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return Response.json({ error: 'unauthenticated' }, { status: 401 })
  if (session.user.role !== 'platform_admin') return Response.json({ error: 'forbidden' }, { status: 403 })

  const imported: string[] = []
  const skipped: string[] = []

  for (const def of SETTING_DEFINITIONS) {
    if (!def.envFallback) {
      skipped.push(`${def.key} (no env fallback)`)
      continue
    }
    const v = process.env[def.envFallback]
    if (!v) {
      skipped.push(`${def.key} (env not set)`)
      continue
    }
    await setSetting(def.key as SettingKey, v, session.user.id)
    imported.push(def.key)
  }

  await db.insert(auditLog).values({
    id: createId(),
    actorId: session.user.id,
    action: 'platform_setting.bulk_import_from_env',
    resource: 'settings',
    metadata: { imported, skipped },
  })

  return Response.json({ ok: true, imported, skipped })
}
