import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { renderEmail, sendEmail } from '@/lib/emails'

/**
 * Vercel Cron — runs daily at 02:00 UTC.
 * 1. Sweep trial licences whose trialEndsAt has passed → mark 'lapsed'
 * 2. Send maintenance-ending reminders (30 / 7 / 1 day before)
 * 3. Send trial-ending reminders (7 / 1 day before)
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

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const now = new Date()
  const inDays = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000)

  let trialLapsed = 0
  let trialEndingSoonSent = 0
  let maintenanceEndingSoonSent = 0

  // 1. Sweep expired trials
  const expiredTrials = await payload.find({
    collection: 'licenses',
    where: {
      and: [
        { status: { equals: 'trial' } },
        { trialEndsAt: { less_than: now.toISOString() } },
      ],
    },
    limit: 200,
    depth: 1,
  })
  for (const lic of expiredTrials.docs) {
    const license = lic as unknown as {
      id: string | number
      customer?: { email?: string; fullName?: string }
    }
    await payload.update({
      collection: 'licenses',
      id: license.id,
      data: { status: 'lapsed' },
      overrideAccess: true,
    })
    trialLapsed += 1

    if (license.customer?.email) {
      await sendEmail({
        payload,
        to: license.customer.email,
        subject: 'Your Duka trial ended — pay to keep going',
        html: await renderEmail('TrialEnded', {
          name: license.customer.fullName ?? 'there',
        }),
      })
    }
  }

  // 2. Trial ending in 1 day or 7 days
  for (const days of [7, 1] as const) {
    const target = inDays(days)
    const start = new Date(target.getTime() - 12 * 60 * 60 * 1000)
    const end = new Date(target.getTime() + 12 * 60 * 60 * 1000)
    const soon = await payload.find({
      collection: 'licenses',
      where: {
        and: [
          { status: { equals: 'trial' } },
          { trialEndsAt: { greater_than: start.toISOString() } },
          { trialEndsAt: { less_than: end.toISOString() } },
        ],
      },
      limit: 200,
      depth: 1,
    })
    for (const lic of soon.docs) {
      const license = lic as unknown as {
        customer?: { email?: string; fullName?: string }
      }
      if (!license.customer?.email) continue
      await sendEmail({
        payload,
        to: license.customer.email,
        subject: `Your Duka trial ends in ${days} day${days === 1 ? '' : 's'}`,
        html: await renderEmail('TrialEndingSoon', {
          name: license.customer.fullName ?? 'there',
          days,
        }),
      })
      trialEndingSoonSent += 1
    }
  }

  // 3. Maintenance expiring in 30 / 7 / 1 days
  for (const days of [30, 7, 1] as const) {
    const target = inDays(days)
    const start = new Date(target.getTime() - 12 * 60 * 60 * 1000)
    const end = new Date(target.getTime() + 12 * 60 * 60 * 1000)
    const soon = await payload.find({
      collection: 'licenses',
      where: {
        and: [
          { status: { equals: 'active' } },
          { maintenanceUntil: { greater_than: start.toISOString() } },
          { maintenanceUntil: { less_than: end.toISOString() } },
        ],
      },
      limit: 200,
      depth: 1,
    })
    for (const lic of soon.docs) {
      const license = lic as unknown as {
        customer?: { email?: string; fullName?: string }
      }
      if (!license.customer?.email) continue
      await sendEmail({
        payload,
        to: license.customer.email,
        subject: `Maintenance renewal in ${days} day${days === 1 ? '' : 's'}`,
        html: await renderEmail('MaintenanceEndingSoon', {
          name: license.customer.fullName ?? 'there',
          days,
        }),
      })
      maintenanceEndingSoonSent += 1
    }
  }

  return Response.json({
    ok: true,
    ranAt: now.toISOString(),
    trialLapsed,
    trialEndingSoonSent,
    maintenanceEndingSoonSent,
  })
}
