import { timingSafeEqual } from 'node:crypto'

/**
 * Verify the deployment-only bootstrap bearer token without ever accepting a
 * missing server secret or a missing request credential. Keeping this check in
 * one place prevents `undefined === undefined` from opening maintenance routes
 * when BOOTSTRAP_TOKEN was not configured.
 */
export function hasValidBootstrapToken(request: Request): boolean {
  const expected = process.env.BOOTSTRAP_TOKEN
  if (!expected) return false

  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return false

  const supplied = authorization.slice('Bearer '.length)
  if (!supplied || supplied.length !== expected.length) return false

  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
}
