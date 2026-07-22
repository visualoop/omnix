/**
 * Drizzle clients — Neon.
 *
 * `db` is the shared Neon **HTTP** adapter used for one-shot reads/writes
 * across the app (imports * from the schema barrel so every helper, page, and
 * route handler sees identical types and the Better Auth Drizzle adapter can
 * join across all relations). The HTTP driver cannot open transactions, so
 * flows that need a real BEGIN/COMMIT (the Paystack webhook settlement) use
 * `withDbTransaction`, which opens a short-lived Neon **serverless**
 * (WebSocket) pool. See {@link withDbTransaction}.
 *
 * Connection string lives in DATABASE_URL (Vercel env var, also set in
 * .env.local for local dev). Falls back to POSTGRES_URL since that's what
 * Payload's vercelPostgresAdapter used. Either works.
 */
import { neon, Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { drizzle as drizzleServerless, type NeonDatabase } from 'drizzle-orm/neon-serverless'
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

/**
 * A transaction handle bound to our full schema. Same query surface as `db`,
 * but every statement runs inside the enclosing BEGIN/COMMIT.
 */
export type DbTx = Parameters<Parameters<NeonDatabase<typeof schema>['transaction']>[0]>[0]

/**
 * Run `fn` inside a real interactive Postgres transaction.
 *
 * The shared `db` above uses the Neon **HTTP** driver, which cannot open a
 * transaction (`db.transaction()` throws "No transactions support in
 * neon-http driver") — every statement is its own autocommit round-trip.
 * That is fine for one-shot reads/writes but unsafe for the payment
 * webhook, which must claim a row (`SELECT … FOR UPDATE`) and mutate several
 * tables atomically so a mid-flight crash can never leave a settled payment
 * without its entitlement.
 *
 * For those flows we open a short-lived WebSocket `Pool` (the Neon
 * **serverless** driver, which does support BEGIN/COMMIT/ROLLBACK), run the
 * work, and close the pool afterwards. If `fn` throws, the transaction rolls
 * back and the error propagates so the caller can retry.
 */
export async function withDbTransaction<T>(fn: (tx: DbTx) => Promise<T>): Promise<T> {
  // Load the WebSocket-over-proxy patch lazily so it only affects the
  // transactional path (dev sandbox); a no-op on Vercel where HTTPS_PROXY is
  // unset, and it never enters the import graph of the HTTP-only `db`.
  await import('@/lib/neon-proxy')
  const pool = new Pool({ connectionString: connectionString || 'postgres://stub@localhost/stub' })
  try {
    const txClient = drizzleServerless({ client: pool, schema })
    return await txClient.transaction((tx) => fn(tx))
  } finally {
    // Always release the socket — serverless invocations must not leak pools.
    await pool.end()
  }
}

export * from './schema'
