import { headers } from 'next/headers'
import { db, telemetryEvents } from '@/db'
import { lt } from 'drizzle-orm'

/**
 * Vercel Cron — runs daily at 03:00 UTC.
 * Drops telemetry rows older than RETENTION_DAYS (default 90). Keeps
 * the table from ballooning into the millions of rows.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  const reqHeaders = await headers()
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret) {
    const auth = reqHeaders.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  const retentionDays = Number(process.env.TELEMETRY_RETENTION_DAYS ?? '90')
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

  const deleted = await db
    .delete(telemetryEvents)
    .where(lt(telemetryEvents.createdAt, cutoff))
    .returning({ id: telemetryEvents.id })

  return Response.json({
    ok: true,
    runAt: new Date().toISOString(),
    deletedCount: deleted.length,
    cutoff: cutoff.toISOString(),
  })
}
