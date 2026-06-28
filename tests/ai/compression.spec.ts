/**
 * Tests for the conversation compression layer. Coverage:
 *   - Token estimation roughly tracks length
 *   - digestMessage handles strings, multi-part, images, whitespace
 *   - compressMessages bypasses small conversations
 *   - compressMessages preserves all system messages + last N turns
 *   - compressMessages emits a single synthetic summary for the middle
 *   - compressMessages still cuts further if even the trimmed shape exceeds budget
 */
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_KEEP_TAIL_TURNS,
  compressMessages,
  digestMessage,
  estimateMessageTokens,
  estimateTokens,
} from '@/services/ai/compression'
import type { ChatMessage } from '@/services/ai/types'

function userMsg(content: string): ChatMessage { return { role: 'user', content } }
function asstMsg(content: string): ChatMessage { return { role: 'assistant', content } }
function systemMsg(content: string): ChatMessage { return { role: 'system', content } }

describe('estimateMessageTokens', () => {
  it('counts text content roughly at chars/4', () => {
    const m = userMsg('a'.repeat(100))
    // 100/4 + 5 overhead = ~30
    expect(estimateMessageTokens(m)).toBeGreaterThanOrEqual(25)
    expect(estimateMessageTokens(m)).toBeLessThanOrEqual(35)
  })

  it('handles multi-part content', () => {
    const m: ChatMessage = {
      role: 'user',
      content: [
        { type: 'text', text: 'hello world' },
        { type: 'text', text: 'more text' },
      ],
    }
    expect(estimateMessageTokens(m)).toBeGreaterThan(5)
  })

  it('charges roughly 1024 tokens per image', () => {
    const m: ChatMessage = {
      role: 'user',
      content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }],
    }
    expect(estimateMessageTokens(m)).toBeGreaterThanOrEqual(1024)
  })
})

describe('estimateTokens', () => {
  it('sums message tokens', () => {
    const msgs = [userMsg('hi'), asstMsg('hello')]
    const sum = estimateTokens(msgs)
    expect(sum).toBe(estimateMessageTokens(msgs[0]) + estimateMessageTokens(msgs[1]))
  })

  it('handles empty array', () => {
    expect(estimateTokens([])).toBe(0)
  })
})

describe('digestMessage', () => {
  it('clips long strings with an ellipsis', () => {
    const result = digestMessage(userMsg('a'.repeat(500)), 40)
    expect(result.length).toBeLessThanOrEqual(40)
    expect(result.endsWith('…')).toBe(true)
  })

  it('returns the full text when short', () => {
    expect(digestMessage(userMsg('quick note'))).toBe('quick note')
  })

  it('normalises internal whitespace', () => {
    expect(digestMessage(userMsg('line\n\nbreak\t\there'))).toBe('line break here')
  })

  it('marks image attachments', () => {
    const m: ChatMessage = {
      role: 'user',
      content: [
        { type: 'text', text: 'see this' },
        { type: 'image_url', image_url: { url: 'x' } },
      ],
    }
    expect(digestMessage(m)).toContain('[1 image]')
  })

  it('marks multiple images', () => {
    const m: ChatMessage = {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: 'x' } },
        { type: 'image_url', image_url: { url: 'y' } },
      ],
    }
    expect(digestMessage(m)).toContain('[2 images]')
  })
})

describe('compressMessages — short conversation passes through', () => {
  it('returns unchanged when under threshold', () => {
    const msgs = [userMsg('hi'), asstMsg('hello')]
    const r = compressMessages(msgs, { budget: 10_000 })
    expect(r.compressed).toBe(false)
    expect(r.messages).toBe(msgs)
    expect(r.droppedMessageCount).toBe(0)
  })
})

describe('compressMessages — long conversation gets compacted', () => {
  // Build a conversation that comfortably exceeds the threshold.
  function bigConversation(turns: number, charsPerMsg = 800): ChatMessage[] {
    const out: ChatMessage[] = [systemMsg('You are Omnix AI.')]
    for (let i = 0; i < turns; i += 1) {
      out.push(userMsg(`user turn ${i}: ${'x'.repeat(charsPerMsg)}`))
      out.push(asstMsg(`assistant turn ${i}: ${'y'.repeat(charsPerMsg)}`))
    }
    return out
  }

  it('compresses when total tokens exceed threshold × budget', () => {
    const msgs = bigConversation(12) // 1 system + 24 body messages, lots of text
    const r = compressMessages(msgs, { budget: 2_000 }) // small budget forces compression
    expect(r.compressed).toBe(true)
    expect(r.droppedMessageCount).toBeGreaterThan(0)
    expect(r.messages.length).toBeLessThan(msgs.length)
  })

  it('keeps every leading system message verbatim', () => {
    const msgs: ChatMessage[] = [
      systemMsg('persona'),
      systemMsg('persona-extra'),
      ...bigConversation(10).slice(1),
    ]
    const r = compressMessages(msgs, { budget: 2_000 })
    expect(r.compressed).toBe(true)
    expect(r.messages[0]).toBe(msgs[0])
    expect(r.messages[1]).toBe(msgs[1])
  })

  it('preserves the last keepTailTurns × 2 messages verbatim', () => {
    const msgs = bigConversation(10)
    // Budget triggers compression (orig ≈ 4.2k tokens > 0.75 × 4k = 3k)
    // but is large enough that the summary + tail still fits in 4k,
    // so the secondary "shave oldest tail" pass doesn't run.
    const r = compressMessages(msgs, { budget: 4_000 })
    expect(r.compressed).toBe(true)
    const expectedTail = msgs.slice(msgs.length - DEFAULT_KEEP_TAIL_TURNS * 2)
    const actualTail = r.messages.slice(r.messages.length - expectedTail.length)
    expect(actualTail).toEqual(expectedTail)
  })

  it('emits exactly one synthetic summary in the middle', () => {
    const msgs = bigConversation(10)
    const r = compressMessages(msgs, { budget: 2_000 })
    const summaries = r.messages.filter(
      (m) => typeof m.content === 'string' && m.content.startsWith('[Earlier conversation summary'),
    )
    expect(summaries).toHaveLength(1)
  })

  it('reports finalTokens below the original', () => {
    const msgs = bigConversation(10)
    const r = compressMessages(msgs, { budget: 2_000 })
    expect(r.finalTokens).toBeLessThan(r.originalTokens)
  })
})

describe('compressMessages — body shorter than keep window', () => {
  it('does not compress when there is nothing to drop', () => {
    // Three short user/assistant pairs — fewer than DEFAULT_KEEP_TAIL_TURNS × 2
    const msgs: ChatMessage[] = [
      systemMsg('persona'),
      userMsg('a'.repeat(2000)),
      asstMsg('b'.repeat(2000)),
    ]
    const r = compressMessages(msgs, { budget: 500 }) // would trigger by tokens
    // No middle to summarise → leave untouched.
    expect(r.compressed).toBe(false)
    expect(r.messages).toBe(msgs)
  })
})
