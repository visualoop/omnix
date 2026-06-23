/**
 * R2 (S3-compatible) client for cloud-backup uploads/downloads.
 *
 * Reads s3.endpoint, s3.access_key_id, s3.secret_access_key,
 * s3.bucket from platform_settings (admin-editable) with env fallback.
 */
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getSetting } from '@/lib/platform-settings'

const REGION_DEFAULT = 'auto'
const BACKUP_BUCKET_DEFAULT = process.env.R2_BACKUP_BUCKET || 'omnix-backups'

async function client(): Promise<{ s3: S3Client; bucket: string }> {
  const [endpoint, accessKeyId, secretAccessKey, regionRaw, bucketRaw] = await Promise.all([
    getSetting('s3.endpoint'),
    getSetting('s3.access_key_id'),
    getSetting('s3.secret_access_key'),
    getSetting('s3.region'),
    getSetting('s3.bucket'),
  ])
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('S3 credentials missing — set s3.endpoint / s3.access_key_id / s3.secret_access_key in /admin/settings')
  }
  const region = regionRaw ?? REGION_DEFAULT
  const bucket = bucketRaw ?? BACKUP_BUCKET_DEFAULT
  const s3 = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  })
  return { s3, bucket }
}

/** Issue a one-time PUT URL (valid 5 minutes) for the desktop to upload to. */
export async function presignUpload(opts: {
  key: string
  contentType?: string
  contentLengthRange?: [number, number]
  bucket?: string
  expiresInSec?: number
}): Promise<{ url: string; bucket: string; key: string; expiresAt: string }> {
  const c = await client()
  const bucket = opts.bucket ?? c.bucket
  const expiresIn = opts.expiresInSec ?? 5 * 60
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: opts.key,
    ContentType: opts.contentType ?? 'application/octet-stream',
  })
  const url = await getSignedUrl(c.s3, cmd, { expiresIn })
  return {
    url,
    bucket,
    key: opts.key,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  }
}

/** Issue a one-time GET URL (valid 5 minutes) for the desktop to download a backup. */
export async function presignDownload(opts: {
  key: string
  bucket?: string
  expiresInSec?: number
}): Promise<{ url: string; expiresAt: string }> {
  const c = await client()
  const bucket = opts.bucket ?? c.bucket
  const expiresIn = opts.expiresInSec ?? 5 * 60
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: opts.key })
  const url = await getSignedUrl(c.s3, cmd, { expiresIn })
  return { url, expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() }
}

/** Server-side delete (used when pruning past retention). */
export async function deleteObject(key: string, bucket?: string): Promise<void> {
  const c = await client()
  await c.s3.send(new DeleteObjectCommand({ Bucket: bucket ?? c.bucket, Key: key }))
}

/** HEAD an object — used to verify upload completed before finalize. */
export async function headObject(key: string, bucket?: string): Promise<{ size: number; etag?: string }> {
  const c = await client()
  const out = await c.s3.send(new HeadObjectCommand({ Bucket: bucket ?? c.bucket, Key: key }))
  return { size: out.ContentLength ?? 0, etag: out.ETag }
}

/** Build the canonical R2 key for a backup. */
export function buildBackupKey(licenseId: string | number, machineId: string, backupId: string): string {
  // Trim machineId to first 16 hex chars to keep keys readable; full id is in DB.
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) // yyyymmddhhmmss
  return `backups/${licenseId}/${machineId.slice(0, 16)}/${ts}-${backupId}.sqlite.gz.enc`
}

export const BACKUP_BUCKET_NAME = BACKUP_BUCKET_DEFAULT
