import { describe, it, expect } from 'vitest'
import {
  estimateTokens,
  estimateContextTokens,
  contextUsage,
  formatTokens,
} from '../contextCalculator'
import { getContextLimitTokens, DEFAULT_CONTEXT_LIMIT_TOKENS } from '@/config/llm'
import type { LLMChatMessage } from '@/types/api'

describe('estimateTokens', () => {
  it('returns 0 for empty text', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('estimates Latin text at ~1 token per 4 chars', () => {
    expect(estimateTokens('hello world')).toBe(Math.ceil(11 / 4)) // 3
  })

  it('counts each CJK character as ~1 token', () => {
    expect(estimateTokens('你好吗')).toBe(3)
  })

  it('estimates more tokens for Chinese than equal-length ASCII', () => {
    const zh = estimateTokens('你好世界吗') // 5 CJK → 5
    const en = estimateTokens('abcde')       // 5 ASCII → 2
    expect(zh).toBeGreaterThan(en)
  })
})

describe('estimateContextTokens', () => {
  it('adds per-message framing overhead and grows with more messages', () => {
    const one: LLMChatMessage[] = [{ role: 'user', content: 'hi' }]
    const two: LLMChatMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
    ]
    expect(estimateContextTokens(one)).toBeGreaterThan(estimateTokens('hi')) // overhead added
    expect(estimateContextTokens(two)).toBeGreaterThan(estimateContextTokens(one))
  })
})

describe('contextUsage', () => {
  it('reports under-limit usage as not over', () => {
    const u = contextUsage([{ role: 'user', content: 'hi' }], 1000)
    expect(u.over).toBe(false)
    expect(u.limit).toBe(1000)
    expect(u.tokens).toBeGreaterThan(0)
  })

  it('flags payloads over the limit with percent > 100', () => {
    const big: LLMChatMessage[] = [{ role: 'user', content: 'x'.repeat(400) }]
    const u = contextUsage(big, 10)
    expect(u.over).toBe(true)
    expect(u.percent).toBeGreaterThan(100)
  })

  it('treats exactly-at-limit as not over (strict greater-than)', () => {
    const msgs: LLMChatMessage[] = [{ role: 'user', content: 'data' }]
    const exact = estimateContextTokens(msgs)
    expect(contextUsage(msgs, exact).over).toBe(false)
    expect(contextUsage(msgs, exact - 1).over).toBe(true)
  })

  it('avoids divide-by-zero when limit is 0', () => {
    expect(contextUsage([{ role: 'user', content: 'a' }], 0).percent).toBe(0)
  })
})

describe('formatTokens', () => {
  it('formats sub-1000 as an integer', () => {
    expect(formatTokens(800)).toBe('800')
  })
  it('formats thousands with a K suffix, trimming .0', () => {
    expect(formatTokens(1500)).toBe('1.5K')
    expect(formatTokens(128_000)).toBe('128K')
    expect(formatTokens(200_000)).toBe('200K')
  })
})

describe('getContextLimitTokens', () => {
  it('returns real per-model windows', () => {
    expect(getContextLimitTokens('glm-4.7-flash')).toBe(128_000)
    expect(getContextLimitTokens('claude-opus-4-8')).toBe(200_000)
    expect(getContextLimitTokens('MiniMax-Text-01')).toBe(245_000)
  })

  it('resolves the most-specific match first (gpt-3.5 vs gpt-4)', () => {
    expect(getContextLimitTokens('gpt-3.5-turbo')).toBe(16_385)
    expect(getContextLimitTokens('gpt-4o-mini')).toBe(128_000)
  })

  it('is case-insensitive and falls back to the default for unknown models', () => {
    expect(getContextLimitTokens('CLAUDE-sonnet-4-6')).toBe(200_000)
    expect(getContextLimitTokens('some-other-model')).toBe(DEFAULT_CONTEXT_LIMIT_TOKENS)
  })
})
