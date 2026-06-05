/**
 * One-shot: ensure there is at least one admin (owner-role) user in the
 * `users` collection so /admin login works on first-deploy.
 *
 * Idempotent and upgrade-aware:
 *   - If no user with the given email exists → creates one with role='owner'
 *   - If a user with the given email exists but role !== 'owner' → upgrades them
 *   - If they already exist as 'owner' → no-op
 *
 * If ADMIN_PASSWORD is provided, it is also (re)set on the user. Useful
 * to recover from a forgotten password.
 *
 * Usage:
 *   ADMIN_EMAIL=you@example.com \
 *   ADMIN_PASSWORD='strong-password' \
 *   ADMIN_NAME='Your Name' \
 *   pnpm exec tsx scripts/ensure-admin.mts
 */
import { getPayload } from 'payload'
import config from '../src/payload.config.ts'

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME ?? 'Admin'
  if (!email) {
    console.error('[admin] ADMIN_EMAIL env var is required')
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
    const current = existing.docs[0] as { id: string; role?: string }
    if (current.role === 'owner' && !password) {
      console.log(`[admin] user ${email} (id=${current.id}) already exists as owner. Nothing to do.`)
      process.exit(0)
    }
    const updateData: Record<string, unknown> = { role: 'owner' }
    if (password) updateData.password = password
    if (name) updateData.name = name
    await payload.update({
      collection: 'users',
      id: current.id,
      overrideAccess: true,
      data: updateData,
    })
    console.log(`[admin] upgraded ${email} (id=${current.id}) to owner${password ? ' + reset password' : ''}.`)
    process.exit(0)
  }

  if (!password) {
    console.error('[admin] ADMIN_PASSWORD env var is required when creating a new user')
    process.exit(1)
  }

  const created = await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: { email, password, name, role: 'owner' },
  })
  console.log(`[admin] created owner user ${email} (id=${created.id})`)
  process.exit(0)
}

main().catch((e) => {
  console.error('[admin] FAILED:', e)
  process.exit(1)
})
