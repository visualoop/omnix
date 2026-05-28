import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@/payload.config'

/**
 * Vercel Cron — runs every 6 hours.
 * Deletes telemetry events older than 90 days for severity in (debug, info)
 * and older than 365 days for everything else.
 *
 * In vercel.json:
 *   { "crons": [{ "path": "/api/cron/telemetry-retention", "schedule": "0 *\/6 * * *" }] }
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

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()

  // Delete debug + info events older than 90 days
  const lowSev = await payload.delete({
    collection: 'telemetry-events',
    where: {
      and: [
        { severity: { in: ['debug', 'info'] } },
        { createdAt: { less_than: ninetyDaysAgo } },
      ],
    },
    overrideAccess: true,
  })

  // Delete error / fatal older than 1 year
  const highSev = await payload.delete({
    collection: 'telemetry-events',
    where: {
      and: [
        { severity: { in: ['warn', 'error', 'fatal', 'crash', 'panic'] as never } },
        { createdAt: { less_than: oneYearAgo } },
      ],
    },
    overrideAccess: true,
  })

  return Response.json({
    ok: true,
    ranAt: new Date().toISOString(),
    deleted: {
      lowSev: (lowSev as { docs?: unknown[] }).docs?.length ?? 0,
      highSev: (highSev as { docs?: unknown[] }).docs?.length ?? 0,
    },
  })
}
