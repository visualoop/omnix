/**
 * R2 (S3-compatible) client for cloud-backup uploads/downloads.
 *
 * R2 lives at https://<account>.r2.cloudflarestorage.com. We use the AWS S3
 * SDK with `forcePathStyle: false` (R2 supports virtual-host style with the
 * `bucket.<accountid>.r2.cloudflarestorage.com` domain) and S3-compatible
 * SigV4 auth. Region must be 'auto' for R2.
 *
 * The bucket for backups is `omnix-backups` (separate from `omnix-media`).
 * Public access disabled — all reads must be presigned.
 */
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const REGION = 'auto'
const BACKUP_BUCKET = process.env.R2_BACKUP_BUCKET || 'omnix-backups'

let _client: S3Client | null = null

function client(): S3Client {
  if (_client) return _client
  const endpoint = process.env.S3_ENDPOINT
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials missing: S3_ENDPOINT / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY')
  }
  _client = new S3Client({
    region: REGION,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true, // R2 with the account-scoped endpoint requires path-style
  })
  return _client
}

/** Issue a one-time PUT URL (valid 5 minutes) for the desktop to upload to. */
export async function presignUpload(opts: {
  key: string
  contentType?: string
  contentLengthRange?: [number, number]
  bucket?: string
  expiresInSec?: number
}): Promise<{ url: string; bucket: string; key: string; expiresAt: string }> {
  const bucket = opts.bucket ?? BACKUP_BUCKET
  const expiresIn = opts.expiresInSec ?? 5 * 60
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: opts.key,
    ContentType: opts.contentType ?? 'application/octet-stream',
  })
  const url = await getSignedUrl(client(), cmd, { expiresIn })
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
  const bucket = opts.bucket ?? BACKUP_BUCKET
  const expiresIn = opts.expiresInSec ?? 5 * 60
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: opts.key })
  const url = await getSignedUrl(client(), cmd, { expiresIn })
  return { url, expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() }
}

/** Server-side delete (used when pruning past retention). */
export async function deleteObject(key: string, bucket?: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: bucket ?? BACKUP_BUCKET, Key: key }))
}

/** HEAD an object — used to verify upload completed before finalize. */
export async function headObject(key: string, bucket?: string): Promise<{ size: number; etag?: string }> {
  const out = await client().send(new HeadObjectCommand({ Bucket: bucket ?? BACKUP_BUCKET, Key: key }))
  return { size: out.ContentLength ?? 0, etag: out.ETag }
}

/** Build the canonical R2 key for a backup. */
export function buildBackupKey(licenseId: string | number, machineId: string, backupId: string): string {
  // Trim machineId to first 16 hex chars to keep keys readable; full id is in DB.
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) // yyyymmddhhmmss
  return `backups/${licenseId}/${machineId.slice(0, 16)}/${ts}-${backupId}.sqlite.gz.enc`
}

export const BACKUP_BUCKET_NAME = BACKUP_BUCKET
