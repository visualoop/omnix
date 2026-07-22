import { z } from 'zod'

/**
 * Strict admin input schema for module demo videos.
 *
 * Kept separate from the browser-safe YouTube helpers so public product pages
 * do not download the Zod runtime. `url` may be empty to clear an unpublished
 * entry; publication completeness is enforced by the admin route.
 */
export const ModuleDemoVideoInput = z
  .object({
    product: z.enum(['pharmacy', 'retail', 'hospitality', 'hardware', 'salon']),
    url: z.string().trim().max(500),
    title: z.string().trim().max(160),
    summary: z.string().trim().max(2000),
    published: z.boolean(),
  })
  .strict()

export type ModuleDemoVideoInputType = z.infer<typeof ModuleDemoVideoInput>
