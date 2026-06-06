/**
 * Conversation persistence — backs the assistant panel with DB-stored
 * threads so the user can resume past chats and scroll back to any
 * historical message. Cheap CRUD over ai_conversations + ai_messages.
 */
import { execute, query } from "@/lib/db"

export interface Conversation {
  id: string
  user_id: string | null
  title: string | null
  pinned: number
  created_at: string
  updated_at: string
}

export interface ConversationMessage {
  id: string
  conversation_id: string
  role: "user" | "assistant" | "system" | "tool"
  content: string
  provider: string | null
  model: string | null
  tokens_in: number | null
  tokens_out: number | null
  latency_ms: number | null
  created_at: string
}

export interface CreatedMessage {
  provider?: string
  model?: string
  tokens_in?: number
  tokens_out?: number
  latency_ms?: number
}

const uid = () => crypto.randomUUID()

export async function listConversations(limit = 30): Promise<Conversation[]> {
  return query<Conversation>(
    `SELECT id, user_id, title, pinned, created_at, updated_at
       FROM ai_conversations
      ORDER BY pinned DESC, datetime(updated_at) DESC
      LIMIT ?1`,
    [limit],
  )
}

export async function createConversation(userId: string | null): Promise<string> {
  const id = uid()
  await execute(
    `INSERT INTO ai_conversations (id, user_id) VALUES (?1, ?2)`,
    [id, userId],
  )
  return id
}

export async function setConversationTitle(id: string, title: string): Promise<void> {
  const truncated = title.length > 80 ? title.slice(0, 77).trimEnd() + "…" : title
  await execute(
    `UPDATE ai_conversations SET title = ?2, updated_at = datetime('now') WHERE id = ?1`,
    [id, truncated],
  )
}

export async function touchConversation(id: string): Promise<void> {
  await execute(
    `UPDATE ai_conversations SET updated_at = datetime('now') WHERE id = ?1`,
    [id],
  )
}

export async function deleteConversation(id: string): Promise<void> {
  await execute(`DELETE FROM ai_conversations WHERE id = ?1`, [id])
}

export async function loadMessages(conversationId: string): Promise<ConversationMessage[]> {
  return query<ConversationMessage>(
    `SELECT id, conversation_id, role, content, provider, model, tokens_in, tokens_out, latency_ms, created_at
       FROM ai_messages
      WHERE conversation_id = ?1
      ORDER BY datetime(created_at) ASC`,
    [conversationId],
  )
}

export async function appendMessage(
  conversationId: string,
  role: ConversationMessage["role"],
  content: string,
  meta: CreatedMessage = {},
): Promise<string> {
  const id = uid()
  await execute(
    `INSERT INTO ai_messages
        (id, conversation_id, role, content, provider, model, tokens_in, tokens_out, latency_ms)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    [
      id, conversationId, role, content,
      meta.provider ?? null, meta.model ?? null,
      meta.tokens_in ?? null, meta.tokens_out ?? null, meta.latency_ms ?? null,
    ],
  )
  await touchConversation(conversationId)
  return id
}

export async function updateMessageContent(messageId: string, content: string, meta: CreatedMessage = {}): Promise<void> {
  await execute(
    `UPDATE ai_messages
        SET content = ?2,
            provider = COALESCE(?3, provider),
            model = COALESCE(?4, model),
            tokens_in = COALESCE(?5, tokens_in),
            tokens_out = COALESCE(?6, tokens_out),
            latency_ms = COALESCE(?7, latency_ms)
      WHERE id = ?1`,
    [
      messageId, content,
      meta.provider ?? null, meta.model ?? null,
      meta.tokens_in ?? null, meta.tokens_out ?? null, meta.latency_ms ?? null,
    ],
  )
}
