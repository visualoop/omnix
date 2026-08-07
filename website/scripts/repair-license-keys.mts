/**
 * Canonicalise legacy compact licence keys without changing any other column.
 *
 * Dry-run (default): DATABASE_URL=... pnpm exec tsx scripts/repair-license-keys.mts
 * Apply:             DATABASE_URL=... pnpm exec tsx scripts/repair-license-keys.mts --apply
 */

import { Pool, neonConfig, type PoolClient } from '@neondatabase/serverless'
import { writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ws from 'ws'
import {
  buildLicenseKeyRepairPlan,
  type LicenseKeyRepairChange,
  type LicenseKeyRepairRow,
} from '../src/lib/license-key-repair'

neonConfig.webSocketConstructor = ws

function printPlan(plan: readonly LicenseKeyRepairChange[]) {
  if (plan.length === 0) {
    console.log('[repair-license-keys] no non-canonical licence keys found')
    return
  }
  console.table(
    plan.map((change) => ({
      id: change.id,
      variant: change.variant,
      'old key': change.oldKey,
      'new key': change.newKey ?? '<unrecognised — skipped>',
      issue: change.issue ?? '',
    })),
  )
}

async function writeMapping(plan: readonly LicenseKeyRepairChange[]): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputPath = join(dirname(fileURLToPath(import.meta.url)), `license-key-repair-${timestamp}.json`)
  await writeFile(
    outputPath,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), changes: plan }, null, 2)}\n`,
    { flag: 'wx' },
  )
  return outputPath
}

async function readRows(queryable: { query: (sql: string) => Promise<{ rows: unknown[] }> }, lock = false) {
  const result = await queryable.query(
    `SELECT "id", "variant", "license_key" AS "licenseKey"
       FROM "licenses"
      ORDER BY "id"${lock ? ' FOR UPDATE' : ''};`,
  )
  return result.rows as LicenseKeyRepairRow[]
}

export async function runLicenseKeyRepair(apply: boolean): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')

  const pool = new Pool({ connectionString: url })
  let client: PoolClient | undefined
  try {
    if (!apply) {
      const plan = buildLicenseKeyRepairPlan(await readRows(pool))
      printPlan(plan)
      if (plan.length > 0) {
        const mappingPath = await writeMapping(plan)
        console.log(`[repair-license-keys] reversal mapping: ${mappingPath}`)
      }
      console.log(`[repair-license-keys] final count: 0 updated (${plan.length} would change; DRY-RUN)`)
      return
    }

    client = await pool.connect()
    await client.query('BEGIN')
    const plan = buildLicenseKeyRepairPlan(await readRows(client, true))
    printPlan(plan)

    if (plan.length === 0) {
      await client.query('COMMIT')
      console.log('[repair-license-keys] final count: 0 updated')
      return
    }

    const mappingPath = await writeMapping(plan)
    console.log(`[repair-license-keys] reversal mapping: ${mappingPath}`)

    const unsafe = plan.filter((change) => change.issue || !change.newKey)
    if (unsafe.length > 0) {
      await client.query('ROLLBACK')
      throw new Error(`refusing to apply: ${unsafe.length} row(s) are invalid, mismatched, or collide`)
    }

    let updated = 0
    for (const change of plan) {
      const result = await client.query(
        `UPDATE "licenses" SET "license_key" = $1
          WHERE "id" = $2 AND "license_key" = $3;`,
        [change.newKey, change.id, change.oldKey],
      )
      if (result.rowCount !== 1) {
        throw new Error(`row ${change.id} changed concurrently; rolling back`)
      }
      updated += result.rowCount
    }
    await client.query('COMMIT')
    console.log(`[repair-license-keys] final count: ${updated} updated`)
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined)
    if (apply) console.log('[repair-license-keys] final count: 0 updated (rolled back)')
    throw error
  } finally {
    client?.release()
    await pool.end()
  }
}

const isMain = Boolean(
  process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url,
)
if (isMain) {
  runLicenseKeyRepair(process.argv.includes('--apply')).catch((error) => {
    console.error('[repair-license-keys] FAILED:', error)
    process.exitCode = 1
  })
}
