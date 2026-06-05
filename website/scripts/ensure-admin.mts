/**
 * One-shot: ensure there is at least one admin (owner-role) user in the
 * `users` collection so /admin login works on first-deploy.
 *
 * Usage:
 *   ADMIN_EMAIL=you@example.com \
 *   ADMIN_PASSWORD='strong-password' \
 *   ADMIN_NAME='Your Name' \
 *   pnpm exec tsx scripts/ensure-admin.mts
 *
 * Idempotent: skips creation if a `users` row with the given email already
 * exists. Safe to re-run.
 */
import { getPayload } from 'payload'
import config from '../src/payload.config.ts'

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME ?? 'Admin'
  if (!email || !password) {
    console.error('[admin] ADMIN_EMAIL and ADMIN_PASSWORD env vars are required')
    process.exit(1)
  }

  const payload = await getPayload({ config })

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })

  if (existing.docs[0]) {
    console.log(`[admin] user ${email} already exists (id=${existing.docs[0].id}). Nothing to do.`)
    process.exit(0)
  }

  const created = await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: {
      email,
      password,
      name,
      role: 'owner',
    },
  })

  console.log(`[admin] created owner user ${email} (id=${created.id})`)
  process.exit(0)
}

main().catch((e) => {
  console.error('[admin] FAILED:', e)
  process.exit(1)
})
