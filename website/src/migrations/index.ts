// Auto-managed by Payload (`payload migrate:create` writes migration files
// here and updates this index). Initial migration generated in CI on first run.

export const migrations: Array<{
  up: (args: import('@payloadcms/db-vercel-postgres').MigrateUpArgs) => Promise<void>
  down: (args: import('@payloadcms/db-vercel-postgres').MigrateDownArgs) => Promise<void>
  name: string
}> = []
