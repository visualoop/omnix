import { headers } from 'next/headers'
import { db, licenses, user } from '@/db'
import { and, eq, lt } from 'drizzle-orm'
import { sendMagicLinkEmail } from '@/lib/email'

/**
 * Vercel Cron — runs daily at 02:00 UTC.
 *   1. Sweep trial licences whose trialEndsAt has passed → mark 'lapsed'
 *   2. (Future) Send maintenance-ending + trial-ending reminders
 *
 * Configure in vercel.json:
 *   { "crons": [{ "path": "/api/cron/daily", "schedule": "0 2 * * *" }] }
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

  const now = new Date()
  let trialLapsed = 0

  // 1. Sweep expired trials → status='lapsed'
  const result = await db
    .update(licenses)
    .set({ status: 'lapsed', updatedAt: now })
    .where(and(eq(licenses.status, 'trial'), lt(licenses.trialEndsAt, now)))
    .returning({ id: licenses.id, userId: licenses.userId })

  trialLapsed = result.length

  // 2. Reminders deferred — wire after the renewal-radar dashboard ships
  //    in v0.8.6/.7. For now we just sweep statuses so the dashboard
  //    shows the right state.
  void user // shake unused-import lint
  void sendMagicLinkEmail // ditto

  return Response.json({
    ok: true,
    runAt: now.toISOString(),
    trialLapsed,
    trialEndingSoonSent: 0,
    maintenanceEndingSoonSent: 0,
  })
}
