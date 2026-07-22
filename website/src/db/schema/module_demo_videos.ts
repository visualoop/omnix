/**
 * module_demo_videos — admin-managed YouTube demo videos for the five product
 * pages (pharmacy · retail · hospitality · hardware · salon).
 *
 * One row per product (`product` is unique). We persist the NORMALISED
 * 11-character YouTube video ID only — never arbitrary embed HTML and never
 * the raw admin-entered URL. The public resolver re-validates every field and
 * fails closed, and the public embed is always rendered from the fixed
 * youtube-nocookie.com origin.
 *
 * `summary` is a required concise text summary that doubles as the transcript
 * fallback shown next to the embed. No API keys or secrets live here.
 */
import { pgTable, text, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const moduleDemoVideos = pgTable(
  'module_demo_videos',
  {
    id: text('id').primaryKey(),
    /** Fixed product enum key; one video per product. */
    product: text('product').notNull(),
    /** Normalised 11-char YouTube video ID; '' until an admin sets one. */
    videoId: text('video_id').notNull().default(''),
    /** Accessible, human title used for the iframe title + heading. */
    title: text('title').notNull().default(''),
    /** Required concise text summary / transcript fallback shown with the embed. */
    summary: text('summary').notNull().default(''),
    /** Public visibility gate; a video only renders publicly when published. */
    published: boolean('published').notNull().default(false),
    /** Admin identity of the last editor (audit-friendly), kept if the user is removed. */
    updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    productUnique: uniqueIndex('module_demo_videos_product_uidx').on(t.product),
    publishedIdx: index('module_demo_videos_published_idx').on(t.published),
  }),
)
