/**
 * Neon serverless driver proxy bridge.
 *
 * The Neon serverless driver talks to Postgres over a WebSocket via the
 * `ws` package. In sandboxed dev environments raw `ws` connections bypass
 * HTTPS_PROXY and fail with ENOTFOUND. Setting `pipelineConnect = false`
 * and `pipelineTLS = false` lets TLS-over-proxy work without races.
 *
 * Production (Vercel): HTTPS_PROXY is unset, so this module is a no-op.
 */
import '@vercel/postgres'
import { neonConfig } from '@neondatabase/serverless'

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY

declare global {
  // eslint-disable-next-line no-var
  var __omnixNeonProxyPatched: boolean | undefined
}

if (proxyUrl && !globalThis.__omnixNeonProxyPatched) {
  neonConfig.pipelineConnect = false
  neonConfig.pipelineTLS = false
  globalThis.__omnixNeonProxyPatched = true
}
