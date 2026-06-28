/**
 * Tests for the context-window registry. Coverage:
 *   - Exact model matches
 *   - Family-prefix matches scoped per provider
 *   - Provider defaults when no model matches
 *   - Hard floor for unknown providers
 *   - getPromptBudget reserves response headroom
 */
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CONTEXT_WINDOW,
  getContextWindow,
  getPromptBudget,
} from '@/services/ai/context-windows'

describe('getContextWindow — exact model match', () => {
  it('returns 128k for gpt-4o', () => {
    expect(getContextWindow('openai', 'gpt-4o')).toBe(128_000)
  })

  it('returns 200k for claude-3-5-sonnet-20241022', () => {
    expect(getContextWindow('anthropic', 'claude-3-5-sonnet-20241022')).toBe(200_000)
  })

  it('returns 64k for deepseek-chat', () => {
    expect(getContextWindow('deepseek', 'deepseek-chat')).toBe(64_000)
  })

  it('returns 128k for llama-3.3-70b-versatile on Groq', () => {
    expect(getContextWindow('groq', 'llama-3.3-70b-versatile')).toBe(128_000)
  })

  it('returns 8k for the small Groq vision preview', () => {
    expect(getContextWindow('groq', 'llama-3.2-90b-vision-preview')).toBe(8_192)
  })
})

describe('getContextWindow — family-prefix match', () => {
  it('matches an unknown but family-prefixed Claude as 200k', () => {
    // Hypothetical dated suffix not in the exact table.
    expect(getContextWindow('anthropic', 'claude-3-7-sonnet-20250101')).toBe(200_000)
  })

  it('matches an OpenRouter slug via vendor prefix', () => {
    expect(getContextWindow('openrouter', 'meta-llama/llama-3.3-99b-future:free')).toBe(128_000)
  })

  it('falls back to 8k for openrouter gpt-oss family', () => {
    expect(getContextWindow('openrouter', 'openai/gpt-oss-7b:free')).toBe(8_192)
  })

  it('does not cross provider boundaries: openrouter gemini still matches', () => {
    expect(getContextWindow('openrouter', 'google/gemini-1.5-pro')).toBe(1_000_000)
  })
})

describe('getContextWindow — defaults', () => {
  it('returns 8192 for unknown Groq model', () => {
    // Groq default is 8192; an unknown model returns the provider default.
    expect(getContextWindow('groq', 'totally-made-up-model')).toBe(8_192)
  })

  it('returns 128k for unknown OpenAI model (provider default)', () => {
    expect(getContextWindow('openai', 'gpt-future-mini')).toBe(128_000)
  })

  it('returns 200k for unknown Anthropic model', () => {
    expect(getContextWindow('anthropic', 'claude-future')).toBe(200_000)
  })

  it('falls back to DEFAULT_CONTEXT_WINDOW for empty model', () => {
    // No provider hint either → just the hard floor.
    expect(getContextWindow('custom', '')).toBe(DEFAULT_CONTEXT_WINDOW)
  })

  it('returns the floor for a truly unknown provider', () => {
    // @ts-expect-error — exercising the fallthrough explicitly.
    expect(getContextWindow('not-a-real-provider', 'totally-unknown')).toBe(DEFAULT_CONTEXT_WINDOW)
  })
})

describe('getPromptBudget', () => {
  it('reserves the requested completion headroom on a large model', () => {
    const window = getContextWindow('openai', 'gpt-4o') // 128_000
    expect(getPromptBudget('openai', 'gpt-4o', 1024)).toBe(window - 1024)
  })

  it('keeps at least 512 tokens of headroom on tiny windows', () => {
    // Custom provider default is 8192; a 1024 reserve = 7168, but the
    // floor is still satisfied (>= 512).
    expect(getPromptBudget('custom', 'tiny', 1024)).toBe(8_192 - 1024)
  })

  it('caps the reserve at half the window so prompt-budget stays positive', () => {
    // If a caller passes a huge reserve, we cap it at window/2.
    const half = Math.floor(8_192 / 2)
    expect(getPromptBudget('custom', 'tiny', 100_000)).toBe(8_192 - half)
  })

  it('returns a positive budget for every known provider', () => {
    const providers = ['groq', 'openrouter', 'deepseek', 'google', 'openai', 'anthropic', 'custom'] as const
    for (const p of providers) {
      expect(getPromptBudget(p, '')).toBeGreaterThan(0)
    }
  })
})
