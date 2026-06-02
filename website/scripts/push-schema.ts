/**
 * One-off schema sync. Runs Payload's `pushDevSchema` against DATABASE_URL.
 *
 * Why: Payload's @payloadcms/db-postgres only auto-pushes when
 * NODE_ENV !== 'production' (see node_modules/.../connect.js).
 * Vercel forces NODE_ENV=production, so production schema never auto-syncs.
 * This script bypasses that guard from a CI runner so newly added collections
 * get their tables/columns without needing a full migrations workflow.
 *
 * Run via the `db-push` GitHub Action.
 */
import { pushDevSchema } from '@payloadcms/drizzle'
import { getPayload } from 'payload'
import config from './src/payload.config.ts'

const main = async () => {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set')
    process.exit(1)
  }
  // Force-treat as a "dev push" environment for the schema sync only.
  // NODE_ENV stays whatever the runner set it to.
  console.log('Initialising Payload…')
  const payload = await getPayload({ config })
  console.log('Pushing schema…')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await pushDevSchema(payload.db as any)
  console.log('Done.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Schema push failed:', err)
  process.exit(1)
})
