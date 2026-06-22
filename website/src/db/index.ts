/**
 * Drizzle client — Neon HTTP serverless adapter.
 *
 * Single instance shared across the app. Imports * from the schema barrel
 * so every helper, page, and route handler sees identical types and the
 * Better Auth Drizzle adapter can join across all relations.
 *
 * Connection string lives in DATABASE_URL (Vercel env var, also set in
 * .env.local for local dev). Falls back to POSTGRES_URL since that's what
 * Payload's vercelPostgresAdapter used. Either works.
 */
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

const connectionString =
  process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? ''

if (!connectionString && process.env.NODE_ENV !== 'test') {
  console.warn(
    '[db] no DATABASE_URL or POSTGRES_URL set — db queries will fail',
  )
}

const sql = neon(connectionString || 'postgres://stub@localhost/stub')

export const db = drizzle({ client: sql, schema })

export type Db = typeof db
export * from './schema'
