import { describe, it, expect, beforeAll } from 'vitest'

const storage: Record<string, string> = {}
beforeAll(() => {
  ;(globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
    clear: () => {}, key: () => null, length: 0,
  } as Storage
})

import { useLLM } from '../useLLM'

describe('useLLM regenerateExploreCoach', () => {
  it('is exposed as a function', () => {
    const llm = useLLM()
    expect(typeof llm.regenerateExploreCoach).toBe('function')
  })

  it('is a no-op (no network, no pushed turn) when there is no prior payload', async () => {
    const llm = useLLM()
    llm.exploreCoachMessages.value.push({ id: 'u1', role: 'user', content: 'hi', timestamp: 1 })
    const res = await llm.regenerateExploreCoach()
    expect(res).toBeNull()
    // No assistant placeholder pushed and no duplicate user turn.
    expect(llm.exploreCoachMessages.value.map(m => m.role)).toEqual(['user'])
  })
})
