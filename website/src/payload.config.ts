import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { resendAdapter } from '@payloadcms/email-resend'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Customers } from './collections/Customers'
import { Licenses } from './collections/Licenses'
import { Machines } from './collections/Machines'
import { Activations } from './collections/Activations'
import { Releases } from './collections/Releases'
import { TelemetryEvents } from './collections/TelemetryEvents'
import { Payments } from './collections/Payments'
import { SupportTickets } from './collections/SupportTickets'
import { Pages } from './collections/Pages'
import { BlogPosts } from './collections/BlogPosts'
import { Modules } from './collections/Modules'
import { Media } from './collections/Media'

import { Settings } from './globals/Settings'
import { Pricing } from './globals/Pricing'
import { LandingPage } from './globals/LandingPage'

import { customEndpoints } from './endpoints'
import { BRAND_NAME } from './lib/brand'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const useR2 = Boolean(
  process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_ENDPOINT &&
    process.env.R2_MEDIA_BUCKET,
)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: { titleSuffix: ` — ${BRAND_NAME} admin` },
  },
  collections: [
    Users,
    Customers,
    Licenses,
    Machines,
    Activations,
    Releases,
    TelemetryEvents,
    Payments,
    SupportTickets,
    Pages,
    BlogPosts,
    Modules,
    Media,
  ],
  globals: [Settings, Pricing, LandingPage],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL || '' },
    // Auto-sync schema. Acceptable while the product is pre-1.0 and we're still
    // adding collections rapidly; revisit with proper migrations before scale.
    push: true,
  }),
  sharp,
  endpoints: customEndpoints,
  /* ── Email via Resend (no-ops if RESEND_API_KEY missing) ── */
  email: process.env.RESEND_API_KEY
    ? resendAdapter({
        apiKey: process.env.RESEND_API_KEY,
        defaultFromAddress: process.env.RESEND_FROM_EMAIL || 'noreply@omnix.co.ke',
        defaultFromName: BRAND_NAME,
      })
    : undefined,
  /* ── Storage: Cloudflare R2 in prod, local disk in dev ── */
  plugins: [
    ...(useR2
      ? [
          s3Storage({
            collections: { media: { prefix: 'media' } },
            bucket: process.env.R2_MEDIA_BUCKET!,
            config: {
              endpoint: process.env.R2_ENDPOINT!,
              region: 'auto',
              credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID!,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
              },
              forcePathStyle: true,
            },
          }),
        ]
      : []),
  ],
  cors: '*',
  csrf: [
    ...(process.env.NEXT_PUBLIC_SITE_URL ? [process.env.NEXT_PUBLIC_SITE_URL] : []),
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],
})
