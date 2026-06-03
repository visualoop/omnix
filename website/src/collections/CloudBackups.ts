import type { CollectionConfig } from 'payload'
import { allowSystem, customerOwnedOrStaff, ownerOnly, ownerOrSystem } from '../access'

/**
 * CloudBackups — server-side index of encrypted SQLite backups uploaded to R2.
 *
 * The desktop app:
 *   1. POSTs to /api/cloud-backups/presigned-upload → gets a one-time PUT URL
 *      + a backup ID to use as the R2 key suffix
 *   2. Uploads the encrypted+gzipped sqlite blob to that presigned URL directly
 *   3. POSTs to /api/cloud-backups/finalize with size + sha256 + clientKeyHint
 *
 * Restore flow (rare):
 *   1. GET /api/cloud-backups?licenseId=X → list of backup metadata
 *   2. POST /api/cloud-backups/:id/download-url → presigned GET URL
 *   3. Desktop downloads, verifies sha256, decrypts with the customer's key,
 *      restores the SQLite file.
 *
 * Encryption: AES-256-GCM. The key is derived from the customer's password +
 * machineId. The server NEVER sees the plaintext database — only the encrypted
 * blob and metadata (size, sha256, machineId).
 */
export const CloudBackups: CollectionConfig = {
  slug: 'cloud-backups',
  admin: {
    useAsTitle: 'objectKey',
    defaultColumns: ['license', 'machineId', 'sizeBytes', 'createdAt', 'status'],
    description: 'Encrypted SQLite backups uploaded by paid customers.',
  },
  access: {
    // Customers see their own; staff see all; system can write.
    read: customerOwnedOrStaff,
    create: ({ req }) => allowSystem(req) || Boolean(req.user),
    update: ownerOrSystem,
    delete: ownerOnly,
  },
  fields: [
    // ── Identity ────────────────────────────────────────────
    {
      name: 'license',
      type: 'relationship',
      relationTo: 'licenses',
      required: true,
      index: true,
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      required: true,
      index: true,
    },
    {
      name: 'machineId',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'Hardware fingerprint of the device that uploaded.' },
    },
    {
      name: 'machine',
      type: 'relationship',
      relationTo: 'machines',
      admin: { description: 'Linked Machine record (if registered).' },
    },

    // ── R2 storage ───────────────────────────────────────────
    {
      name: 'objectKey',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'R2 object key, e.g. backups/<licenseId>/<machineId>/<isoTs>-<id>.sqlite.gz.enc' },
    },
    {
      name: 'bucket',
      type: 'text',
      defaultValue: 'omnix-backups',
      admin: { description: 'R2 bucket name. Defaults to omnix-backups.' },
    },

    // ── Integrity ────────────────────────────────────────────
    {
      name: 'sizeBytes',
      type: 'number',
      admin: { description: 'Final encrypted+gzipped size in bytes. Set on finalize.' },
    },
    {
      name: 'sha256',
      type: 'text',
      admin: { description: 'SHA-256 of the encrypted blob. Verified on restore.' },
    },
    {
      name: 'clientKeyHint',
      type: 'text',
      admin: {
        description:
          'Hint for which encryption key the client used (e.g. first 8 chars of HMAC). Helps customers identify which password to use on restore. Never the key itself.',
      },
    },

    // ── Lifecycle ────────────────────────────────────────────
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending — presigned URL issued, upload not yet confirmed', value: 'pending' },
        { label: 'Uploaded — finalize endpoint received the size + sha256', value: 'uploaded' },
        { label: 'Pruned — past retentionDays, R2 object deleted', value: 'pruned' },
        { label: 'Quarantined — flagged by support', value: 'quarantined' },
      ],
      index: true,
    },
    {
      name: 'pruneAfter',
      type: 'date',
      admin: {
        description:
          'When this backup is eligible for pruning. Set on upload from Settings.cloudBackupRetentionDays.',
      },
    },
    {
      name: 'finalizedAt',
      type: 'date',
      admin: { description: 'Timestamp the desktop confirmed upload via /finalize.' },
    },

    // ── Diagnostic ───────────────────────────────────────────
    { name: 'desktopVersion', type: 'text', admin: { description: 'Omnix version on the device that uploaded.' } },
    { name: 'sourceRows', type: 'number', admin: { description: 'Rough row count from main tables, optional.' } },
    { name: 'sourceSizeBytes', type: 'number', admin: { description: 'Plaintext SQLite size, optional.' } },
  ],
  timestamps: true,
}
