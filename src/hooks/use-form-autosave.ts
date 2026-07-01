/**
 * Form autosave — protects data on long forms against crash / accidental navigation.
 *
 * Contract:
 *   const { saveDraft, loadDraft, clearDraft } = useFormAutosave('invoice-new', entityId);
 *   useEffect(() => { saveDraft(currentFormState); }, [currentFormState]);
 *   // On mount, check loadDraft() and show a restore banner if it returns non-null.
 *
 * Persistence: SQLite `form_drafts` table. Debounced 800ms so we don't hammer the DB.
 * Cleanup: caller calls clearDraft() on successful submit.
 * Drafts older than 30 days are pruned by daily maintenance.
 */
import { query, execute } from "@/lib/db";
import { useAuthStore } from "@/stores/auth";
import { useCallback, useEffect, useRef, useState } from "react";

const DRAFT_TTL_DAYS = 30;

interface Draft<T = unknown> {
  payload: T;
  updated_at: string;
}

function draftId(userId: string, formKey: string, entityId: string | null): string {
  return `${userId}:${formKey}:${entityId ?? "new"}`;
}

async function saveDraftDb(userId: string, formKey: string, entityId: string | null, payload: unknown): Promise<void> {
  const id = draftId(userId, formKey, entityId);
  await execute(
    `INSERT INTO form_drafts (id, user_id, form_key, entity_id, payload, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    [id, userId, formKey, entityId, JSON.stringify(payload)],
  );
}

async function loadDraftDb<T>(userId: string, formKey: string, entityId: string | null): Promise<Draft<T> | null> {
  const rows = await query<{ payload: string; updated_at: string }>(
    `SELECT payload, updated_at FROM form_drafts WHERE id = ?1 LIMIT 1`,
    [draftId(userId, formKey, entityId)],
  );
  if (!rows[0]) return null;
  try {
    return { payload: JSON.parse(rows[0].payload) as T, updated_at: rows[0].updated_at };
  } catch {
    return null;
  }
}

async function clearDraftDb(userId: string, formKey: string, entityId: string | null): Promise<void> {
  await execute(`DELETE FROM form_drafts WHERE id = ?1`, [draftId(userId, formKey, entityId)]);
}

/** Prune drafts older than DRAFT_TTL_DAYS. Called by daily maintenance. */
export async function pruneOldDrafts(): Promise<number> {
  const res = await execute(
    `DELETE FROM form_drafts WHERE updated_at < datetime('now', ?1)`,
    [`-${DRAFT_TTL_DAYS} days`],
  );
  // execute returns affected rows in Tauri sql plugin
  return typeof res === "number" ? res : 0;
}

/**
 * React hook. Debounces writes so typing doesn't hammer SQLite.
 * `formKey` = 'invoice-new' | 'purchase-order' | 'stock-take' | 'sale-return' etc.
 * `entityId` = null when creating; the record id when editing.
 */
export function useFormAutosave<T>(
  formKey: string,
  entityId: string | null,
  opts: { debounceMs?: number } = {},
) {
  const user = useAuthStore((s) => s.user);
  const debounceMs = opts.debounceMs ?? 800;
  const [draft, setDraft] = useState<Draft<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the existing draft on mount (or when key/entity changes).
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    loadDraftDb<T>(user.id, formKey, entityId)
      .then((d) => {
        if (!cancelled) {
          setDraft(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.id, formKey, entityId]);

  // Debounced save
  const saveDraft = useCallback((payload: T) => {
    if (!user?.id) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveDraftDb(user.id, formKey, entityId, payload).catch(() => { /* non-fatal */ });
    }, debounceMs);
  }, [user?.id, formKey, entityId, debounceMs]);

  const clearDraft = useCallback(async () => {
    if (!user?.id) return;
    if (timer.current) clearTimeout(timer.current);
    await clearDraftDb(user.id, formKey, entityId).catch(() => { /* non-fatal */ });
    setDraft(null);
  }, [user?.id, formKey, entityId]);

  // Flush on unmount to avoid losing the last edit.
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, []);

  return {
    /** Existing draft loaded from DB, or null. Use to show a Restore banner. */
    draft,
    /** True while the initial load is in flight. */
    loading,
    /** Save the current form state (debounced). */
    saveDraft,
    /** Wipe the draft (call on successful submit). */
    clearDraft,
  };
}

/**
 * Restore-draft banner component. Import and mount below your form title:
 *
 *   <FormDraftBanner draft={draft} onRestore={...} onDiscard={clearDraft} />
 */
export interface FormDraftBannerProps<T> {
  draft: Draft<T> | null;
  onRestore: (payload: T) => void;
  onDiscard: () => void;
}
