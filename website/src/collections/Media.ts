import type { CollectionConfig } from 'payload'
import { ownerOnly, ownerOrSupport } from '../access'

/**
 * Media — uploads collection.
 * Local disk for dev; will switch to Cloudflare R2 via @payloadcms/storage-s3
 * in production (env-driven).
 */
export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    staticDir: 'media',
    imageSizes: [
      { name: 'thumbnail', width: 400, height: 300, position: 'centre' },
      { name: 'card', width: 768, height: 576, position: 'centre' },
      { name: 'feature', width: 1200, height: 800, position: 'centre' },
      { name: 'og', width: 1200, height: 630, position: 'centre' },
    ],
    adminThumbnail: 'thumbnail',
    mimeTypes: ['image/*', 'video/mp4'],
  },
  access: {
    read: () => true,
    create: ownerOrSupport,
    update: ownerOrSupport,
    delete: ownerOnly,
  },
  fields: [
    { name: 'alt', type: 'text', required: true },
    { name: 'caption', type: 'text' },
  ],
}
