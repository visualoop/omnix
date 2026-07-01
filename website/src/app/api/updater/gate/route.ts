/**
 * POST /api/updater/gate
 *
 * Pre-flight check before the desktop's Tauri updater fires check().
 *
 * Body: { machineId: string, currentVersion?: string }
 * Returns: { allowed: boolean, channel: 'stable'|'beta'|'nightly', reason?: string }
 *
 * How admin uses it:
 *   1. Flip a machine's update_channel to 'canary' (in /admin/machines/[id])
 *      → that machine becomes a canary. It will pull whatever release is
 *      published on the 'beta' channel.
 *   2. Set a machine's auto_update_enabled to false → it never auto-updates
 *      (owner can still manually check for updates from settings).
 *   3. Publish a release with channel='beta'. Canary machines pull it
 *      automatically. Everyone else stays on the latest 'stable' release.
 *   4. After canaries verify the release, admin flips the release row's
 *      channel to 'stable' → all remaining machines pull it on next check.
 *
 * Machines that don't exist in the DB yet (fresh installs, or activation
 * in progress) get: { allowed: true, channel: 'stable' } — the safe default.
 */
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, machines } from '@/db'
import { ensureMigrated } from '@/lib/auto-migrate'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Body {
  machineId?: string
  currentVersion?: string
}

export async function POST(req: NextRequest) {
  await ensureMigrated().catch(() => { /* non-fatal */ })

  const body = (await req.json().catch(() => null)) as Body | null
  if (!body?.machineId) {
    return NextResponse.json({ allowed: true, channel: 'stable' })
  }

  const rows = await db
    .select({
      updateChannel: machines.updateChannel,
      autoUpdateEnabled: machines.autoUpdateEnabled,
      status: machines.status,
    })
    .from(machines)
    .where(eq(machines.machineId, body.machineId))
    .limit(1)

  const m = rows[0]
  if (!m) {
    // Machine hasn't registered yet or is a fresh install — allow update on stable channel.
    return NextResponse.json({ allowed: true, channel: 'stable' })
  }

  if (m.status === 'revoked') {
    return NextResponse.json({ allowed: false, channel: 'stable', reason: 'machine revoked' })
  }

  // Text column stores 'true'/'false' — canonicalize.
  const autoUpdate = m.autoUpdateEnabled !== 'false'
  if (!autoUpdate) {
    return NextResponse.json({ allowed: false, channel: m.updateChannel, reason: 'auto-update disabled by admin' })
  }

  // Canary channel triggers beta-channel releases; stable is the default.
  const channel = m.updateChannel === 'canary' ? 'beta' : m.updateChannel
  return NextResponse.json({ allowed: true, channel })
}
