import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

const storage: Record<string, string> = {}
beforeAll(() => {
  ;(globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
    key: () => null, length: 0,
  } as Storage
})

import {
  coachHistory, addRecord, recordsForChannel,
  startNewSession, clearHistory,
  currentSessionId, setSessionId,
} from '../useCoachHistory'

beforeEach(() => {
  Object.keys(storage).forEach(k => delete storage[k])
  clearHistory()
})

describe('useCoachHistory channel scoping', () => {
  it('tags new records with the given channel and filters by it', () => {
    startNewSession('task')
    addRecord('user', 'task q', 'task')
    addRecord('assistant', 'task a', 'task')
    startNewSession('explore')
    addRecord('user', 'explore q', 'explore')

    expect(recordsForChannel('task').map(r => r.content)).toEqual(['task a', 'task q'])
    expect(recordsForChannel('explore').map(r => r.content)).toEqual(['explore q'])
  })

  it('treats legacy untagged records as task channel', () => {
    coachHistory.value = [
      { id: 'a', role: 'user', content: 'legacy', timestamp: 1 },
    ]
    expect(recordsForChannel('task').map(r => r.content)).toEqual(['legacy'])
    expect(recordsForChannel('explore')).toEqual([])
  })

  it('keeps per-channel sessions independent', () => {
    startNewSession('task')
    addRecord('user', 't1', 'task')
    startNewSession('explore')
    addRecord('user', 'e1', 'explore')
    addRecord('assistant', 't2', 'task')
    const taskSids = new Set(recordsForChannel('task').map(r => r.sessionId))
    const expSids = new Set(recordsForChannel('explore').map(r => r.sessionId))
    expect([...taskSids].some(s => expSids.has(s!))).toBe(false)
  })
})

describe('useCoachHistory currentSessionId back-compat mirror', () => {
  it('clearHistory() leaves currentSessionId.value === null', () => {
    startNewSession('task')
    expect(currentSessionId.value).not.toBeNull()
    clearHistory()
    expect(currentSessionId.value).toBeNull()
  })

  it('mirrors the task session after startNewSession("task")', () => {
    startNewSession('task')
    const rec = addRecord('user', 'x', 'task')
    expect(currentSessionId.value).not.toBeNull()
    expect(rec.sessionId).toBe(currentSessionId.value)
  })

  it('startNewSession("explore") does NOT change currentSessionId', () => {
    startNewSession('task')
    const before = currentSessionId.value
    expect(before).not.toBeNull()
    startNewSession('explore')
    expect(currentSessionId.value).toBe(before)
  })

  it('setSessionId only mirrors the task channel', () => {
    startNewSession('task')
    const before = currentSessionId.value
    expect(before).not.toBeNull()
    setSessionId('explore', 'zzz')
    expect(currentSessionId.value).toBe(before)
    setSessionId('task', 'abc')
    expect(currentSessionId.value).toBe('abc')
  })
})
