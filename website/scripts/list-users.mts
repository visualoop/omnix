/**
 * Diagnostic: dump every user in the `users` collection with their id,
 * email, name, and role. Read-only — does not modify anything.
 */
import { getPayload } from 'payload'
import config from '../src/payload.config.ts'

async function main() {
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: 'users',
    limit: 200,
    overrideAccess: true,
    sort: 'createdAt',
  })
  console.log(`[users] found ${res.totalDocs} user(s):`)
  for (const u of res.docs as Array<{ id: string | number; email?: string; name?: string; role?: string; createdAt?: string }>) {
    console.log(
      `  - id=${u.id}  email=${u.email}  name=${u.name ?? '(no name)'}  role=${u.role ?? '?'}  created=${u.createdAt ?? '?'}`,
    )
  }
  process.exit(0)
}

main().catch((e) => {
  console.error('[users] FAILED:', e)
  process.exit(1)
})
