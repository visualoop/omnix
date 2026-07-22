/**
 * /payroll-pack was a legacy feature landing that carried acquisition-facing
 * trial CTAs. Payroll (P9, P10, payslips, statutory batches) is part of the
 * Core that ships with every product, so this route no longer renders a
 * standalone sales page. It permanently (308) redirects to the product
 * catalogue, preserving the active locale and any safe query. Security-
 * sensitive params are dropped.
 */
import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'
import { preserveSafeQuery, type RedirectSearchParams } from '@/lib/redirect-query'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return {
    title: 'Omnix products',
    alternates: { canonical: `${SITE_URL}/${locale}/modules` },
    robots: { index: false, follow: true },
  }
}

export default async function PayrollPackPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<RedirectSearchParams>
}) {
  const [{ locale }, queryValues] = await Promise.all([params, searchParams])
  const suffix = preserveSafeQuery(queryValues)
  permanentRedirect(`/${locale}/modules${suffix}`)
}
