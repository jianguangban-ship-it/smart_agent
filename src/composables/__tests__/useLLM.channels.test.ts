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

describe('useLLM independent channels', () => {
  it('exposes separate task/explore message arrays and loading flags', () => {
    const llm = useLLM()
    expect(llm.taskCoachMessages.value).toEqual([])
    expect(llm.exploreCoachMessages.value).toEqual([])
    expect(llm.isTaskCoachLoading.value).toBe(false)
    expect(llm.isExploreCoachLoading.value).toBe(false)
    expect(typeof llm.requestTaskCoach).toBe('function')
    expect(typeof llm.requestExploreCoach).toBe('function')
    expect(typeof llm.cancelExploreCoach).toBe('function')
  })

  it('task and explore message arrays are separate instances', () => {
    const llm = useLLM()
    llm.taskCoachMessages.value.push({
      id: 't1', role: 'assistant', content: 'task answer', timestamp: 1,
    })
    llm.cancelExploreCoach()
    expect(llm.taskCoachMessages.value.map(m => m.content)).toEqual(['task answer'])
  })
})
