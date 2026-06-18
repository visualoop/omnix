// MUST be the first import — patches neonConfig before any DB connection.
// No-op in production (HTTPS_PROXY unset on Vercel).
import './lib/neon-proxy'

import { vercelPostgresAdapter } from '@payloadcms/db-vercel-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { resendAdapter } from '@payloadcms/email-resend'
import { s3Storage } from '@payloadcms/storage-s3'
import { seoPlugin } from '@payloadcms/plugin-seo'
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
import { CloudBackups } from './collections/CloudBackups'

import { Settings } from './globals/Settings'
import { Pricing } from './globals/Pricing'
import { LandingPage } from './globals/LandingPage'
import { HomeContent } from './globals/HomeContent'
import { ContactContent } from './globals/ContactContent'
import { FooterContent } from './globals/FooterContent'
import { TradeLandings } from './globals/TradeLandings'

import { customEndpoints } from './endpoints'
import { BRAND_NAME } from './lib/brand'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const useS3 = Boolean(
  process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY &&
    process.env.S3_ENDPOINT &&
    process.env.S3_BUCKET,
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
    CloudBackups,
  ],
  globals: [Settings, Pricing, LandingPage, HomeContent, ContactContent, FooterContent, TradeLandings],
  localization: {
    // Same locale codes as next-intl's routing config — keep in sync.
    locales: [
      { label: 'English', code: 'en' },
      { label: 'Kiswahili', code: 'sw' },
      { label: 'Français', code: 'fr' },
      { label: 'Português', code: 'pt' },
      { label: 'Español', code: 'es' },
      { label: 'العربية', code: 'ar', rtl: true },
    ],
    defaultLocale: 'en',
    fallback: true, // empty translations fall back to default locale
  },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: vercelPostgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL || '' },
    migrationDir: path.resolve(dirname, 'migrations'),
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
  /* ── Storage: Cloudflare R2 (via S3 API) in prod, local disk in dev ──
     Plugin is ALWAYS registered (with enabled toggled by env-var presence)
     so the generated importMap is deterministic — otherwise local
     `generate:importmap` runs without S3 env vars produce a map missing
     `S3ClientUploadHandler`, and the admin crashes at runtime when env
     vars ARE present. */
  plugins: [
    s3Storage({
      enabled: useS3,
      alwaysInsertFields: true,
      collections: { media: { prefix: 'media' } },
      bucket: process.env.S3_BUCKET || 'placeholder',
      config: {
        endpoint: process.env.S3_ENDPOINT || 'https://placeholder.example.com',
        region: process.env.S3_REGION || 'auto',
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID || 'placeholder',
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'placeholder',
        },
        forcePathStyle: true,
      },
    }),
    seoPlugin({
      collections: ['pages', 'blog-posts', 'modules'],
      uploadsCollection: 'media',
      generateTitle: ({ doc }: { doc?: Record<string, unknown> }) =>
        doc?.title ? `${doc.title as string} · ${BRAND_NAME}` : BRAND_NAME,
      generateDescription: ({ doc }: { doc?: Record<string, unknown> }) =>
        (doc?.excerpt as string) || (doc?.summary as string) || 'The operating system for Kenyan SMEs.',
    }),
  ],
  cors: [
    ...(process.env.NEXT_PUBLIC_SITE_URL ? [process.env.NEXT_PUBLIC_SITE_URL] : []),
    'https://omnix.co.ke',
    'https://www.omnix.co.ke',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],
  csrf: [
    ...(process.env.NEXT_PUBLIC_SITE_URL ? [process.env.NEXT_PUBLIC_SITE_URL] : []),
    'https://omnix.co.ke',
    'https://www.omnix.co.ke',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],
})
