import type { LLMChatMessage } from '@/types/api'

/**
 * Context calculator — estimates how many TOKENS an LLM request will use before
 * it is sent, so Explore mode can enforce a per-model context-window limit.
 *
 * LLM context windows are measured in tokens, not bytes. We use a lightweight,
 * dependency-free bilingual estimate (good enough for a pre-send guardrail — the
 * model still enforces the real limit):
 *   - CJK characters (Chinese ideographs, kana, CJK punctuation, fullwidth
 *     forms) count as ~1 token each.
 *   - Remaining (mostly Latin) text counts as ~1 token per 4 characters.
 * Byte length is deliberately NOT used: it is a language-inconsistent proxy
 * (English ~4 bytes/token, Chinese ~2–3), which both over- and under-counts.
 */

const CJK_RE = /[　-鿿＀-￯]/g
/** Per-message framing overhead (role + delimiters) in tokens, à la OpenAI. */
const PER_MESSAGE_OVERHEAD = 4

/** Estimate the token count of a single string (bilingual-aware). */
export function estimateTokens(text: string): number {
  if (!text) return 0
  const cjk = (text.match(CJK_RE) || []).length
  const rest = text.length - cjk
  return cjk + Math.ceil(rest / 4)
}

/** Flat per-image vision-token allowance (rough; real cost varies by model). */
const PER_IMAGE_TOKENS = 800

/** Estimate the total tokens of the messages array as it is sent to the API. */
export function estimateContextTokens(messages: LLMChatMessage[]): number {
  let total = 0
  for (const m of messages) {
    total += PER_MESSAGE_OVERHEAD
    if (typeof m.content === 'string') {
      total += estimateTokens(m.content)
    } else {
      // Multi-modal parts: count text by chars, images at a flat allowance
      // (never the base64 data URL).
      for (const part of m.content) {
        if (part.type === 'text') total += estimateTokens(part.text)
        else total += PER_IMAGE_TOKENS
      }
    }
  }
  return total
}

export interface ContextUsage {
  /** Estimated token count of the payload. */
  tokens: number
  /** The limit it was measured against, in tokens. */
  limit: number
  /** Usage as a whole-number percent of the limit (can exceed 100). */
  percent: number
  /** True when the payload is strictly larger than the limit. */
  over: boolean
}

export function contextUsage(messages: LLMChatMessage[], limit: number): ContextUsage {
  const tokens = estimateContextTokens(messages)
  return {
    tokens,
    limit,
    percent: limit > 0 ? Math.round((tokens / limit) * 100) : 0,
    over: tokens > limit,
  }
}

/** Format a token count compactly: 1500 → "1.5K", 128000 → "128K", 800 → "800". */
export function formatTokens(n: number): string {
  if (n < 1000) return String(n)
  const k = n / 1000
  return `${k.toFixed(1).replace(/\.0$/, '')}K`
}
