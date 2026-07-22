import { headers } from 'next/headers'
import { db, licenses, user } from '@/db'
import { and, eq, lt, gte, isNotNull, sql } from 'drizzle-orm'
import {
  sendTrialEndingEmail,
  sendMaintenanceEndingEmail,
  sendMaintenanceLapsedEmail,
  sendCloudBackupEndingEmail,
} from '@/lib/email'
import { getSetting } from '@/lib/platform-settings'

/**
 * Vercel Cron — runs daily at 02:00 UTC.
 *
 *   1. Sweep expired trials → status='lapsed'
 *   2. Send trial-ending reminders at T-7, T-3, T-1 days
 *   3. Send maintenance-ending reminders at T-30, T-14, T-7 days
 *   4. Send maintenance-lapsed notification on the day it expires
 *   5. Send cloud-backup-ending reminders at T-7, T-1 days
 *
 * Reminders are de-duplicated via a JSON `metadata.remindersSent` array
 * on each licence row, so the same milestone never triggers twice.
 *
 * Configure in vercel.json:
 *   { "crons": [{ "path": "/api/cron/daily", "schedule": "0 2 * * *" }] }
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TRIAL_MILESTONES_DAYS = [7, 3, 1]
const MAINTENANCE_MILESTONES_DAYS = [30, 14, 7]
const CLOUD_BACKUP_MILESTONES_DAYS = [7, 1]

interface LicenseMetadata {
  remindersSent?: string[]
}

export async function GET() {
  const reqHeaders = await headers()
  const cronSecret = await getSetting('cron.secret')

  if (!cronSecret) {
    return Response.json({ error: 'cron_not_configured' }, { status: 503 })
  }

  const auth = reqHeaders.get('authorization')
  if (auth !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const now = new Date()
  const today = startOfDay(now)
  let trialLapsed = 0
  let trialEndingSent = 0
  let maintEndingSent = 0
  let maintLapsedSent = 0
  let cloudEndingSent = 0

  // ── 1. Sweep expired trials → status='lapsed' ────────────
  const lapsedResult = await db
    .update(licenses)
    .set({ status: 'lapsed', updatedAt: now })
    .where(and(eq(licenses.status, 'trial'), lt(licenses.trialEndsAt, now)))
    .returning({ id: licenses.id, userId: licenses.userId })
  trialLapsed = lapsedResult.length

  // ── 2. Trial-ending reminders ───────────────────────────
  for (const days of TRIAL_MILESTONES_DAYS) {
    const target = addDays(today, days)
    const next = addDays(target, 1)
    const milestoneKey = `trial-${days}d`

    const due = await db
      .select({
        licenseId: licenses.id,
        userId: licenses.userId,
        variant: licenses.variant,
        trialEndsAt: licenses.trialEndsAt,
        metadata: licenses.metadata,
        email: user.email,
        name: user.name,
      })
      .from(licenses)
      .leftJoin(user, eq(licenses.userId, user.id))
      .where(
        and(
          eq(licenses.status, 'trial'),
          isNotNull(licenses.trialEndsAt),
          gte(licenses.trialEndsAt, target),
          lt(licenses.trialEndsAt, next),
        ),
      )

    for (const row of due) {
      if (!row.email) continue
      const meta = (row.metadata ?? {}) as LicenseMetadata
      if (meta.remindersSent?.includes(milestoneKey)) continue
      try {
        await sendTrialEndingEmail({
          to: row.email,
          customerName: row.name ?? row.email.split('@')[0],
          variant: row.variant ?? 'pro',
          daysLeft: days,
          buyUrl: `https://omnix.co.ke/buy?licenseId=${row.licenseId}&purpose=license_fee`,
        })
        await markReminderSent(row.licenseId, meta, milestoneKey)
        trialEndingSent++
      } catch (e) {
        console.error(`[cron] trial-${days}d reminder failed for license ${row.licenseId}:`, e instanceof Error ? e.name : 'unknown')
      }
    }
  }

  // ── 3. Maintenance-ending reminders ─────────────────────
  for (const days of MAINTENANCE_MILESTONES_DAYS) {
    const target = addDays(today, days)
    const next = addDays(target, 1)
    const milestoneKey = `maint-${days}d`

    const due = await db
      .select({
        licenseId: licenses.id,
        userId: licenses.userId,
        variant: licenses.variant,
        maintenanceUntil: licenses.maintenanceUntil,
        metadata: licenses.metadata,
        email: user.email,
        name: user.name,
      })
      .from(licenses)
      .leftJoin(user, eq(licenses.userId, user.id))
      .where(
        and(
          eq(licenses.status, 'active'),
          isNotNull(licenses.maintenanceUntil),
          gte(licenses.maintenanceUntil, target),
          lt(licenses.maintenanceUntil, next),
        ),
      )

    for (const row of due) {
      if (!row.email || !row.maintenanceUntil) continue
      const meta = (row.metadata ?? {}) as LicenseMetadata
      if (meta.remindersSent?.includes(milestoneKey)) continue
      try {
        await sendMaintenanceEndingEmail({
          to: row.email,
          customerName: row.name ?? row.email.split('@')[0],
          variant: row.variant ?? 'pro',
          daysLeft: days,
          expiresOn: new Date(row.maintenanceUntil).toISOString().slice(0, 10),
          renewUrl: `https://omnix.co.ke/buy?licenseId=${row.licenseId}&purpose=maintenance_renewal`,
        })
        await markReminderSent(row.licenseId, meta, milestoneKey)
        maintEndingSent++
      } catch (e) {
        console.error(`[cron] maint-${days}d reminder failed for license ${row.licenseId}:`, e instanceof Error ? e.name : 'unknown')
      }
    }
  }

  // ── 4. Maintenance-lapsed notification (T-0) ────────────
  {
    const lastWeek = addDays(today, -7)
    const due = await db
      .select({
        licenseId: licenses.id,
        userId: licenses.userId,
        variant: licenses.variant,
        maintenanceUntil: licenses.maintenanceUntil,
        metadata: licenses.metadata,
        email: user.email,
        name: user.name,
      })
      .from(licenses)
      .leftJoin(user, eq(licenses.userId, user.id))
      .where(
        and(
          eq(licenses.status, 'active'),
          isNotNull(licenses.maintenanceUntil),
          lt(licenses.maintenanceUntil, today),
          gte(licenses.maintenanceUntil, lastWeek), // recent expiries only
        ),
      )

    for (const row of due) {
      if (!row.email || !row.maintenanceUntil) continue
      const meta = (row.metadata ?? {}) as LicenseMetadata
      const milestoneKey = 'maint-lapsed'
      if (meta.remindersSent?.includes(milestoneKey)) continue
      try {
        await sendMaintenanceLapsedEmail({
          to: row.email,
          customerName: row.name ?? row.email.split('@')[0],
          variant: row.variant ?? 'pro',
          expiredOn: new Date(row.maintenanceUntil).toISOString().slice(0, 10),
          renewUrl: `https://omnix.co.ke/buy?licenseId=${row.licenseId}&purpose=maintenance_renewal`,
        })
        await markReminderSent(row.licenseId, meta, milestoneKey)
        maintLapsedSent++
      } catch (e) {
        console.error(`[cron] maint-lapsed notification failed for license ${row.licenseId}:`, e instanceof Error ? e.name : 'unknown')
      }
    }
  }

  // ── 5. Cloud-backup-ending reminders ────────────────────
  for (const days of CLOUD_BACKUP_MILESTONES_DAYS) {
    const target = addDays(today, days)
    const next = addDays(target, 1)
    const milestoneKey = `cloud-${days}d`

    const due = await db
      .select({
        licenseId: licenses.id,
        userId: licenses.userId,
        cloudBackupExpiresAt: licenses.cloudBackupExpiresAt,
        metadata: licenses.metadata,
        email: user.email,
        name: user.name,
      })
      .from(licenses)
      .leftJoin(user, eq(licenses.userId, user.id))
      .where(
        and(
          eq(licenses.cloudBackupEnabled, true),
          isNotNull(licenses.cloudBackupExpiresAt),
          gte(licenses.cloudBackupExpiresAt, target),
          lt(licenses.cloudBackupExpiresAt, next),
        ),
      )

    for (const row of due) {
      if (!row.email || !row.cloudBackupExpiresAt) continue
      const meta = (row.metadata ?? {}) as LicenseMetadata
      if (meta.remindersSent?.includes(milestoneKey)) continue
      try {
        await sendCloudBackupEndingEmail({
          to: row.email,
          customerName: row.name ?? row.email.split('@')[0],
          daysLeft: days,
          expiresOn: new Date(row.cloudBackupExpiresAt).toISOString().slice(0, 10),
          renewUrl: `https://omnix.co.ke/buy?licenseId=${row.licenseId}&purpose=cloud_backup`,
        })
        await markReminderSent(row.licenseId, meta, milestoneKey)
        cloudEndingSent++
      } catch (e) {
        console.error(`[cron] cloud-${days}d reminder failed for license ${row.licenseId}:`, e instanceof Error ? e.name : 'unknown')
      }
    }
  }

  return Response.json({
    ok: true,
    runAt: now.toISOString(),
    trialLapsed,
    trialEndingSoonSent: trialEndingSent,
    maintenanceEndingSoonSent: maintEndingSent,
    maintenanceLapsedSent: maintLapsedSent,
    cloudBackupEndingSoonSent: cloudEndingSent,
  })
}

async function markReminderSent(licenseId: string, current: LicenseMetadata, milestone: string) {
  const next: LicenseMetadata = {
    ...current,
    remindersSent: [...(current.remindersSent ?? []), milestone],
  }
  await db.update(licenses).set({ metadata: next, updatedAt: new Date() }).where(eq(licenses.id, licenseId))
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + days)
  return x
}

void sql // satisfy import
