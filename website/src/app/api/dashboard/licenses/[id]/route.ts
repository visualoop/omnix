/**
 * DELETE /api/dashboard/licenses/[id] — release a licence the user owns.
 *
 * Constraints:
 *   - Only TRIAL licences can be released this way. Active / paid
 *     licences need a refund flow (refund-policy.tsx) and can't be
 *     deleted by the user — too much downstream data depends on them.
 *   - User must own the licence (license.userId === session.user.id).
 *   - The licence row is hard-deleted; the cascade removes activations
 *     and any payment rows that link to it (payments.licenseId is
 *     ON DELETE SET NULL — we keep the audit trail).
 *
 * Used by the dashboard "Release this licence" button so customers can
 * clean up trial keys they no longer want (e.g. Justine has three
 * leftover trials from the testing phase and wants the slate clean).
 */
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db, licenses } from '@/db'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Not signed in' }, { status: 401 })
  }

  const rows = await db
    .select()
    .from(licenses)
    .where(and(eq(licenses.id, id), eq(licenses.userId, session.user.id)))
    .limit(1)
  const lic = rows[0]
  if (!lic) {
    return NextResponse.json({ ok: false, error: 'Licence not found on your account' }, { status: 404 })
  }
  if (lic.status !== 'trial') {
    return NextResponse.json(
      {
        ok: false,
        error: 'Active or paid licences can\'t be self-released. Contact support if you need a refund.',
      },
      { status: 403 },
    )
  }

  await db.delete(licenses).where(eq(licenses.id, id))
  return NextResponse.json({ ok: true })
}
