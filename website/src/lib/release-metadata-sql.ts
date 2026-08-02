import { sql, type SQL } from 'drizzle-orm'
import { releases } from '@/db/schema/releases'

interface DesktopMetadataMergeInput {
  variant: string
  variantAssets: Record<string, unknown>
  syncMetadata: Record<string, string>
}

/**
 * Build the conflict-update expression used by concurrent desktop matrix jobs.
 *
 * The expression reads metadata from the row locked by PostgreSQL's conflict
 * update, so no job can replace a variant committed by another job. Parameters
 * used as JSON object keys or JSON `->` operands must remain explicitly typed:
 * PostgreSQL cannot infer an unknown placeholder in either overloaded position.
 */
export function buildDesktopMetadataMergeSql({
  variant,
  variantAssets,
  syncMetadata,
}: DesktopMetadataMergeInput): SQL {
  const variantKey = sql`${variant}::text`

  return sql`(
    jsonb_set(
      coalesce(${releases.metadata}, '{}'::jsonb),
      '{variants}',
      coalesce(${releases.metadata}->'variants', '{}'::jsonb)
        || jsonb_build_object(
          ${variantKey},
          coalesce(${releases.metadata}->'variants'->${variantKey}, '{}'::jsonb)
            || ${JSON.stringify(variantAssets)}::jsonb
        )
    ) || ${JSON.stringify(syncMetadata)}::jsonb
  )`
}
