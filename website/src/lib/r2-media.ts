/**
 * Governed R2 lifecycle for marketing media.
 *
 * Platform admins may publish directly to the public media bucket. Teams that
 * want a second-person review can additionally configure a separate private
 * quarantine bucket; pending records use short-lived signed preview URLs and
 * are copied to the public bucket only when approved.
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

interface MediaStorageSettings {
  endpoint?: string
  accessKeyId?: string
  secretAccessKey?: string
  region?: string
  publicBucket: string
  quarantineBucket?: string
  publicUrl?: string
}

interface MediaStorage {
  s3: S3Client
  publicBucket: string
  quarantineBucket: string | null
  publicBase: string
}

export interface MediaStorageStatus {
  publishReady: boolean
  reviewReady: boolean
  publicBucket: string
  quarantineBucket: string | null
  missingPublishingSettings: string[]
  reviewIssue: string | null
}

async function loadMediaStorageSettings(): Promise<MediaStorageSettings> {
  const [endpoint, accessKeyId, secretAccessKey, region, publicBucketRaw, quarantineBucket, publicUrl] =
    await Promise.all([
      getSetting('s3.endpoint'),
      getSetting('s3.access_key_id'),
      getSetting('s3.secret_access_key'),
      getSetting('s3.region'),
      getSetting('s3.media_bucket'),
      getSetting('s3.media_quarantine_bucket'),
      getSetting('s3.public_url'),
    ])

  return {
    endpoint,
    accessKeyId,
    secretAccessKey,
    region,
    publicBucket: publicBucketRaw ?? PUBLIC_MEDIA_BUCKET_DEFAULT,
    quarantineBucket,
    publicUrl,
  }
}

export async function getMediaStorageStatus(): Promise<MediaStorageStatus> {
  const settings = await loadMediaStorageSettings()
  const missingPublishingSettings = [
    !settings.endpoint ? 'S3 endpoint' : null,
    !settings.accessKeyId ? 'access key ID' : null,
    !settings.secretAccessKey ? 'secret access key' : null,
    !settings.publicUrl ? 'media public base URL' : null,
  ].filter((value): value is string => value !== null)

  const reviewIssue = !settings.quarantineBucket
    ? 'No private review bucket is configured. Direct admin publishing still works.'
    : settings.quarantineBucket === settings.publicBucket
      ? 'The review bucket matches the public media bucket. Use a separate private bucket for review mode.'
      : null

  return {
    publishReady: missingPublishingSettings.length === 0,
    reviewReady: missingPublishingSettings.length === 0 && reviewIssue === null,
    publicBucket: settings.publicBucket,
    quarantineBucket: settings.quarantineBucket ?? null,
    missingPublishingSettings,
    reviewIssue,
  }
}

async function mediaStorage(options: { requireQuarantine?: boolean } = {}): Promise<MediaStorage> {
  const settings = await loadMediaStorageSettings()

  if (!settings.endpoint || !settings.accessKeyId || !settings.secretAccessKey) {
    throw new Error('R2 credentials are missing. Configure the storage credentials before uploading media.')
  }
  if (!settings.publicUrl) {
    throw new Error('The media public base URL is missing. Add it in Admin → Settings → Storage & media.')
  }

  if (options.requireQuarantine && !settings.quarantineBucket) {
    throw new Error('Private review is not configured. Add a separate private media review bucket in Admin → Settings, or publish the image directly.')
  }
  if (options.requireQuarantine && settings.quarantineBucket === settings.publicBucket) {
    throw new Error('Private review needs a bucket separate from the public media bucket. Direct admin publishing does not require it.')
  }

  return {
    s3: new S3Client({
      region: settings.region ?? REGION_DEFAULT,
      endpoint: settings.endpoint,
      credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
      forcePathStyle: true,
    }),
    publicBucket: settings.publicBucket,
    quarantineBucket:
      settings.quarantineBucket && settings.quarantineBucket !== settings.publicBucket
        ? settings.quarantineBucket
        : null,
    publicBase: settings.publicUrl.replace(/\/$/, ''),
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

export async function uploadPublishedMedia(options: {
  filename: string
  contentType: string
  bytes: Buffer | Uint8Array
}): Promise<{ key: string; url: string; sizeBytes: number }> {
  const storage = await mediaStorage()
  const key = `media/${objectStem(options.filename)}`
  const body = options.bytes instanceof Buffer ? options.bytes : Buffer.from(options.bytes)

  await storage.s3.send(new PutObjectCommand({
    Bucket: storage.publicBucket,
    Key: key,
    Body: body,
    ContentType: options.contentType,
    CacheControl: 'public, max-age=31536000, immutable',
    Metadata: { publication: 'approved', source: 'platform-admin' },
  }))

  return { key, url: `${storage.publicBase}/${key}`, sizeBytes: body.length }
}

export async function uploadMediaToQuarantine(options: {
  filename: string
  contentType: string
  bytes: Buffer | Uint8Array
}): Promise<{ quarantineKey: string; sizeBytes: number }> {
  const storage = await mediaStorage({ requireQuarantine: true })
  const quarantineKey = `quarantine/${objectStem(options.filename)}`
  const body = options.bytes instanceof Buffer ? options.bytes : Buffer.from(options.bytes)

  await storage.s3.send(new PutObjectCommand({
    Bucket: storage.quarantineBucket!,
    Key: quarantineKey,
    Body: body,
    ContentType: options.contentType,
    CacheControl: 'private, no-store',
    Metadata: { publication: 'pending-review' },
  }))

  return { quarantineKey, sizeBytes: body.length }
}

export async function getQuarantinePreviewUrl(quarantineKey: string): Promise<string> {
  const storage = await mediaStorage({ requireQuarantine: true })
  return getSignedUrl(
    storage.s3,
    new GetObjectCommand({ Bucket: storage.quarantineBucket!, Key: quarantineKey }),
    { expiresIn: 10 * 60 },
  )
}

export async function promoteQuarantinedMedia(options: {
  quarantineKey: string
  contentType: string
}): Promise<{ key: string; url: string }> {
  const storage = await mediaStorage({ requireQuarantine: true })
  const key = options.quarantineKey.replace(/^quarantine\//, 'media/')

  await storage.s3.send(new CopyObjectCommand({
    Bucket: storage.publicBucket,
    Key: key,
    CopySource: encodeCopySource(storage.quarantineBucket!, options.quarantineKey),
    ContentType: options.contentType,
    CacheControl: 'public, max-age=31536000, immutable',
    MetadataDirective: 'REPLACE',
    Metadata: { publication: 'approved' },
  }))

  return { key, url: `${storage.publicBase}/${key}` }
}

export async function deleteQuarantinedMedia(key: string): Promise<void> {
  const storage = await mediaStorage({ requireQuarantine: true })
  await storage.s3.send(new DeleteObjectCommand({ Bucket: storage.quarantineBucket!, Key: key }))
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
