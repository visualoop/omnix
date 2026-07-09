/**
 * wipe-transactional.mts — reset purchases + activity to a clean slate,
 * KEEPING user accounts + org + site config + release catalog.
 *
 * KEEP: user, session, account, verification, organization, member,
 *       invitation, team, team_member, platform_settings, platform_media,
 *       releases (product catalog — repopulates from GitHub on sync).
 * WIPE: everything a user "purchased" or generated — licences, payments,
 *       activations, machines, sync logs, reseller/affiliate records,
 *       support tickets, cloud backups, api tokens, telemetry, audit log.
 *
 * Usage:
 *   pnpm exec tsx --env-file=.env.local scripts/wipe-transactional.mts count   # read-only
 *   pnpm exec tsx --env-file=.env.local scripts/wipe-transactional.mts wipe    # destructive
 */
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.ts'
import {
  activations, licenseSyncLog, payments, resellerCommissions, affiliateCredits,
  supportMessages, licenses, machines, supportTickets, resellers, affiliates,
  cloudBackups, apiTokens, telemetryEvents, auditLog,
} from '../src/db/schema/index.ts'

// Child-first order so foreign keys never block a delete.
const ORDER: Array<[string, any]> = [
  ['activations', activations],
  ['license_sync_log', licenseSyncLog],
  ['payments', payments],
  ['reseller_commissions', resellerCommissions],
  ['affiliate_credits', affiliateCredits],
  ['support_messages', supportMessages],
  ['licenses', licenses],
  ['machines', machines],
  ['support_tickets', supportTickets],
  ['resellers', resellers],
  ['affiliates', affiliates],
  ['cloud_backups', cloudBackups],
  ['api_tokens', apiTokens],
  ['telemetry_events', telemetryEvents],
  ['audit_log', auditLog],
]

const mode = process.argv[2] ?? 'count'

async function count(table: any): Promise<number> {
  const [row] = await db.select({ c: sql<number>`count(*)` }).from(table)
  return Number(row?.c ?? 0)
}

async function main() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    console.error('[wipe] no DATABASE_URL — aborting'); process.exit(1)
  }
  console.log(`[wipe] mode=${mode}`)
  let total = 0
  for (const [name, table] of ORDER) {
    const before = await count(table)
    total += before
    if (mode === 'wipe' && before > 0) {
      await db.delete(table)
      const after = await count(table)
      console.log(`  ${name.padEnd(22)} ${before} -> ${after}`)
    } else {
      console.log(`  ${name.padEnd(22)} ${before}`)
    }
  }
  console.log(`[wipe] ${mode === 'wipe' ? 'wiped' : 'total rows'}: ${total}`)
  console.log('[wipe] KEPT: users, sessions, accounts, org/teams, platform settings/media, releases')
  process.exit(0)
}
main().catch((e) => { console.error('[wipe] failed:', e); process.exit(1) })
