import type { Metadata } from 'next'
import { buildAlternatesLanguages } from '@/lib/hreflang'
import { buildSocialMetadata } from '@/lib/seo-metadata'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const canonical = `${SITE_URL}/${locale}/developers`
  return {
    title: 'Developers — Omnix Public API',
    description: 'REST API for programmatic access to your machines, licenses, and product data on Omnix.',
    alternates: {
      canonical,
      languages: buildAlternatesLanguages('/developers'),
    },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'Omnix Public API',
      description: 'Read your machines, licenses, and product data from the Omnix REST API.',
      type: 'website',
    }),
  }
}

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/public/v1/health',
    scope: '(none)',
    description: 'Confirm your API key works. Returns owner id + granted scopes.',
  },
  {
    method: 'GET',
    path: '/api/public/v1/machines',
    scope: 'read:machines',
    description: 'List every machine registered under your account.',
  },
  {
    method: 'GET',
    path: '/api/public/v1/licenses',
    scope: 'read:licenses',
    description: 'List every license you own with current variant + status.',
  },
]

export default async function DevelopersPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  return (
    <div className="max-w-3xl mx-auto px-6 py-10 prose prose-neutral dark:prose-invert">
      <h1>Omnix Public API</h1>
      <p className="lead">
        Programmatic access to your Omnix account. Read your machines, licenses,
        and product data from Zapier, Make, or your own scripts.
      </p>

      <h2>Base URL</h2>
      <pre><code>https://omnix.co.ke/api/public/v1</code></pre>

      <h2>Authentication</h2>
      <p>
        All requests need an <code>X-Omnix-Api-Key</code> header (or an{' '}
        <code>Authorization: Bearer &lt;key&gt;</code> header — both work). API
        keys are issued per account on request — contact{' '}
        <a href={`/${locale}/support`}>Omnix support</a> to get yours.
      </p>
      <pre><code>{`curl https://omnix.co.ke/api/public/v1/health \\
  -H 'X-Omnix-Api-Key: YOUR_KEY_HERE'`}</code></pre>

      <h2>Rate limits</h2>
      <p>100 requests per minute per key. Exceeding returns HTTP 429 with a Retry-After header.</p>

      <h2>Scopes</h2>
      <p>Each API key is scoped. Available scopes:</p>
      <ul>
        <li><code>read:machines</code> — list machines</li>
        <li><code>read:licenses</code> — list licenses</li>
        <li><code>*</code> — everything above (owner-only, use with care)</li>
      </ul>

      <h2>Endpoints</h2>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Path</th>
            <th>Scope</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {ENDPOINTS.map((e) => (
            <tr key={e.path}>
              <td><code>{e.method}</code></td>
              <td><code>{e.path}</code></td>
              <td><code>{e.scope}</code></td>
              <td>{e.description}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Versioning</h2>
      <p>
        The current version is <code>v1</code>. Breaking changes ship under new
        version prefixes (<code>v2</code>, etc.). We keep the previous version
        alive for at least 6 months after a new version launches.
      </p>

      <h2>Coming soon</h2>
      <ul>
        <li><code>read:products</code> — product catalog</li>
        <li><code>read:customers</code> — customer list</li>
        <li><code>read:sales</code> — sales history</li>
        <li><code>read:inventory</code> — stock levels + valuation</li>
        <li>Webhooks for sale events, licence changes, telemetry updates</li>
      </ul>
    </div>
  )
}
