/**
 * Governed R2 lifecycle for marketing media.
 *
 * New objects are written to a separate private quarantine bucket. Pending
 * records never contain a public URL and admins preview them through short-
 * lived signed URLs. Approval copies the object into the public media bucket;
 * rejection/deletion removes it from whichever store currently owns it.
 */
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getSetting } from '@/lib/platform-settings'

const REGION_DEFAULT = 'auto'
const PUBLIC_MEDIA_BUCKET_DEFAULT = process.env.S3_MEDIA_BUCKET || 'omnix-media'

interface MediaStorage {
  s3: S3Client
  publicBucket: string
  quarantineBucket: string
  publicBase: string
}

async function mediaStorage(): Promise<MediaStorage> {
  const [endpoint, accessKeyId, secretAccessKey, regionRaw, publicBucketRaw, quarantineBucketRaw, publicUrlRaw] =
    await Promise.all([
      getSetting('s3.endpoint'),
      getSetting('s3.access_key_id'),
      getSetting('s3.secret_access_key'),
      getSetting('s3.region'),
      getSetting('s3.media_bucket'),
      getSetting('s3.media_quarantine_bucket'),
      getSetting('s3.public_url'),
    ])

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials are missing. Configure the storage credentials before uploading media.')
  }
  if (!publicUrlRaw) {
    throw new Error('The media public base URL is missing.')
  }
  if (!quarantineBucketRaw) {
    throw new Error('A private media quarantine bucket is required. It must not be the public media bucket.')
  }

  const publicBucket = publicBucketRaw ?? PUBLIC_MEDIA_BUCKET_DEFAULT
  if (quarantineBucketRaw === publicBucket) {
    throw new Error('The media quarantine bucket must be separate from the public media bucket.')
  }

  return {
    s3: new S3Client({
      region: regionRaw ?? REGION_DEFAULT,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    }),
    publicBucket,
    quarantineBucket: quarantineBucketRaw,
    publicBase: publicUrlRaw.replace(/\/$/, ''),
  }
}

function objectStem(filename: string): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const extension = (filename.split('.').pop() || 'bin').toLowerCase().slice(0, 8)
  const name = filename
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'file'
  const nonce = crypto.randomUUID()
  return `${year}/${month}/${name}-${nonce}.${extension}`
}

function encodeCopySource(bucket: string, key: string): string {
  return `${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`
}

export async function uploadMediaToQuarantine(options: {
  filename: string
  contentType: string
  bytes: Buffer | Uint8Array
}): Promise<{ quarantineKey: string; sizeBytes: number }> {
  const storage = await mediaStorage()
  const quarantineKey = `quarantine/${objectStem(options.filename)}`
  const body = options.bytes instanceof Buffer ? options.bytes : Buffer.from(options.bytes)

  await storage.s3.send(new PutObjectCommand({
    Bucket: storage.quarantineBucket,
    Key: quarantineKey,
    Body: body,
    ContentType: options.contentType,
    CacheControl: 'private, no-store',
    Metadata: { publication: 'pending-review' },
  }))

  return { quarantineKey, sizeBytes: body.length }
}

export async function getQuarantinePreviewUrl(quarantineKey: string): Promise<string> {
  const storage = await mediaStorage()
  return getSignedUrl(
    storage.s3,
    new GetObjectCommand({ Bucket: storage.quarantineBucket, Key: quarantineKey }),
    { expiresIn: 10 * 60 },
  )
}

export async function promoteQuarantinedMedia(options: {
  quarantineKey: string
  contentType: string
}): Promise<{ key: string; url: string }> {
  const storage = await mediaStorage()
  const key = options.quarantineKey.replace(/^quarantine\//, 'media/')

  await storage.s3.send(new CopyObjectCommand({
    Bucket: storage.publicBucket,
    Key: key,
    CopySource: encodeCopySource(storage.quarantineBucket, options.quarantineKey),
    ContentType: options.contentType,
    CacheControl: 'public, max-age=31536000, immutable',
    MetadataDirective: 'REPLACE',
    Metadata: { publication: 'approved' },
  }))

  return { key, url: `${storage.publicBase}/${key}` }
}

export async function deleteQuarantinedMedia(key: string): Promise<void> {
  const storage = await mediaStorage()
  await storage.s3.send(new DeleteObjectCommand({ Bucket: storage.quarantineBucket, Key: key }))
}

export async function deletePublishedMedia(key: string): Promise<void> {
  const storage = await mediaStorage()
  await storage.s3.send(new DeleteObjectCommand({ Bucket: storage.publicBucket, Key: key }))
}

export const ACCEPTED_MEDIA_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
  'video/mp4',
  'video/webm',
] as const

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024
