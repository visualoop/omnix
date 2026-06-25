/**
 * R2 client for *public* marketing images.
 *
 * Separate from r2-backups.ts because the backup bucket is private
 * + encrypted; media bucket is public-read so the CDN can serve images
 * to the marketing site directly.
 *
 * Reuses the same S3 credentials (s3.access_key_id + s3.secret_access_key)
 * but with the media-specific bucket + public URL prefix.
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSetting } from '@/lib/platform-settings'

const REGION_DEFAULT = 'auto'
const MEDIA_BUCKET_DEFAULT = process.env.S3_BUCKET || 'omnix-media'

async function mediaClient(): Promise<{ s3: S3Client; bucket: string; publicBase: string }> {
  const [endpoint, accessKeyId, secretAccessKey, regionRaw, bucketRaw, publicUrlRaw] =
    await Promise.all([
      getSetting('s3.endpoint'),
      getSetting('s3.access_key_id'),
      getSetting('s3.secret_access_key'),
      getSetting('s3.region'),
      getSetting('s3.media_bucket'),
      getSetting('s3.public_url'),
    ])
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'R2 credentials missing — set s3.endpoint / s3.access_key_id / s3.secret_access_key in /admin/settings before uploading media.',
    )
  }
  if (!publicUrlRaw) {
    throw new Error(
      'Media public URL missing — set s3.public_url in /admin/settings (e.g. the R2 pub-*.r2.dev domain).',
    )
  }
  const region = regionRaw ?? REGION_DEFAULT
  const bucket = bucketRaw ?? MEDIA_BUCKET_DEFAULT
  const s3 = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  })
  return { s3, bucket, publicBase: publicUrlRaw.replace(/\/$/, '') }
}

/**
 * Upload an image. Returns the public CDN URL.
 *
 * Key format: `media/{yyyy}/{mm}/{slug}-{rand}.{ext}` — chronological
 * + slug stays unique even if the same filename is uploaded twice.
 */
export async function uploadMedia(opts: {
  filename: string
  contentType: string
  bytes: Buffer | Uint8Array
}): Promise<{ key: string; url: string; bucket: string; sizeBytes: number }> {
  const c = await mediaClient()
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const ext = (opts.filename.split('.').pop() || 'bin').toLowerCase().slice(0, 8)
  const baseName = opts.filename
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'file'
  const rand = Math.random().toString(36).slice(2, 8)
  const key = `media/${yyyy}/${mm}/${baseName}-${rand}.${ext}`

  const buf = opts.bytes instanceof Buffer ? opts.bytes : Buffer.from(opts.bytes)

  await c.s3.send(
    new PutObjectCommand({
      Bucket: c.bucket,
      Key: key,
      Body: buf,
      ContentType: opts.contentType,
      // 1 year, immutable — the key has a random suffix so we never
      // rewrite the same URL.
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  return {
    key,
    url: `${c.publicBase}/${key}`,
    bucket: c.bucket,
    sizeBytes: buf.length,
  }
}

/** Hard-delete a media object (admin only). */
export async function deleteMedia(key: string): Promise<void> {
  const c = await mediaClient()
  await c.s3.send(new DeleteObjectCommand({ Bucket: c.bucket, Key: key }))
}

/** Accept list for the upload endpoint. */
export const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
  'image/svg+xml',
  'image/gif',
] as const

/** Max bytes allowed per upload (8 MB) — keep page weight sane. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
